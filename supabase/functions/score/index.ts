import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const anthropicModel = "claude-sonnet-4-6";

type ScoreRequest = {
  generation_id: string;
};

type RegisterMessages = Record<string, string[]>;
type ScorePayload = Record<string, unknown>;

type NumericStat = {
  mean: number;
  std: number;
  n: number;
  ci: number;
  reliable: boolean;
};

type BinaryRateStat = {
  rate: number;
  reliable: boolean;
  n: number;
};

type RegisterStats = {
  exclamation: NumericStat;
  period: NumericStat;
  question: NumericStat;
  sentence_length: NumericStat;
  emoji_rate: BinaryRateStat;
  doubling_rate: BinaryRateStat;
} | null;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const safeLower = (value: unknown) =>
  typeof value === "string" ? value.toLowerCase() : "";

function inferRegister(contextType: string): string {
  const ct = contextType?.toLowerCase() ?? "";
  if (ct.includes("email")) return "EMAIL";
  if (ct.includes("slack")) return "SLACK";
  if (ct.includes("whatsapp") || ct.includes("text") || ct.includes("casual")) {
    return "WHATSAPP";
  }
  return "GLOBAL";
}

const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

const std = (arr: number[]) => {
  const m = mean(arr);
  return Math.max(
    Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length),
    0.001,
  );
};

const ci = (stdVal: number, n: number) =>
  1.96 * stdVal / Math.sqrt(Math.max(n, 1));

const reliable = (meanVal: number, ciVal: number) =>
  meanVal === 0 ? false : ciVal < meanVal * 0.5;

function parseCorpusByRegister(rawText: string): RegisterMessages {
  const sections: RegisterMessages = {
    WHATSAPP: [],
    SLACK: [],
    EMAIL: [],
    GLOBAL: [],
  };

  let current = "GLOBAL";
  let buffer: string[] = [];

  const flushBuffer = () => {
    const msg = buffer.join(" ").trim();
    if (msg.length > 20) {
      sections[current].push(msg);
      sections.GLOBAL.push(msg);
    }
    buffer = [];
  };

  for (const line of rawText.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.includes("[WHATSAPP]")) {
      current = "WHATSAPP";
      continue;
    }
    if (trimmed.includes("[SLACK]")) {
      current = "SLACK";
      continue;
    }
    if (trimmed.includes("[EMAIL]")) {
      current = "EMAIL";
      continue;
    }
    if (trimmed === "---") {
      flushBuffer();
    } else if (trimmed) {
      buffer.push(trimmed);
    }
  }

  flushBuffer();
  return sections;
}

function computeStats(messages: string[]): RegisterStats {
  if (!messages.length) return null;

  const emojiRegex =
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2702}-\u{27B0}]/gu;
  const doublingRegex = /\b(\w+)\s+\1\b/gi;

  const stats = {
    excl: [] as number[],
    periods: [] as number[],
    questions: [] as number[],
    lengths: [] as number[],
    emoji: [] as number[],
    doubling: [] as number[],
  };

  for (const msg of messages) {
    const words = msg.split(/\s+/).filter(Boolean);
    const wc = Math.max(words.length, 1);
    const sents = msg.split(/[.!?]+/).filter((s) => s.trim());
    const sc = Math.max(sents.length, 1);

    stats.excl.push((msg.match(/!/g) || []).length / wc);
    stats.periods.push((msg.match(/\./g) || []).length / wc);
    stats.questions.push((msg.match(/\?/g) || []).length / sc);
    stats.lengths.push(wc / sc);
    stats.emoji.push((msg.match(emojiRegex) || []).length > 0 ? 1 : 0);
    stats.doubling.push((msg.match(doublingRegex) || []).length > 0 ? 1 : 0);
  }

  const n = messages.length;
  const exclamationMean = mean(stats.excl);
  const exclamationStd = std(stats.excl);
  const exclamationCi = ci(exclamationStd, n);

  const periodMean = mean(stats.periods);
  const periodStd = std(stats.periods);
  const periodCi = ci(periodStd, n);

  const questionMean = mean(stats.questions);
  const questionStd = std(stats.questions);
  const questionCi = ci(questionStd, n);

  const sentenceLengthMean = mean(stats.lengths);
  const sentenceLengthStd = std(stats.lengths);
  const sentenceLengthCi = ci(sentenceLengthStd, n);

  const emojiRate = mean(stats.emoji);
  const doublingRate = mean(stats.doubling);

  return {
    exclamation: {
      mean: exclamationMean,
      std: exclamationStd,
      n,
      ci: exclamationCi,
      reliable: reliable(exclamationMean, exclamationCi),
    },
    period: {
      mean: periodMean,
      std: periodStd,
      n,
      ci: periodCi,
      reliable: reliable(periodMean, periodCi),
    },
    question: {
      mean: questionMean,
      std: questionStd,
      n,
      ci: questionCi,
      reliable: reliable(questionMean, questionCi),
    },
    sentence_length: {
      mean: sentenceLengthMean,
      std: sentenceLengthStd,
      n,
      ci: sentenceLengthCi,
      reliable: reliable(sentenceLengthMean, sentenceLengthCi),
    },
    emoji_rate: { rate: emojiRate, reliable: n >= 15, n },
    doubling_rate: { rate: doublingRate, reliable: n >= 15, n },
  };
}

const gaussian = (val: number, meanVal: number, stdVal: number) =>
  Math.exp(-0.5 * ((val - meanVal) / stdVal) ** 2);

const binaryScore = (val: number, rate: number) => {
  const tendency = rate >= 0.5 ? rate : 1 - rate;
  const expected = rate >= 0.5 ? 1 : 0;
  const weight = (tendency - 0.5) * 2;
  return 0.5 + 0.5 * weight * (val === expected ? 1 : -1);
};

const hedgeScore = (text: string) => {
  const patterns = [
    /\bjust\b/i,
    /\bmaybe\b/i,
    /\bprobably\b/i,
    /\bhopefully\b/i,
    /\bi think\b/i,
    /\bi guess\b/i,
    /\bi feel\b/i,
    /\bno rush\b/i,
    /\bno pressure\b/i,
    /\bwhenever\b/i,
    /\bwondering\b/i,
  ];
  const hits = patterns.filter((p) => p.test(text)).length;
  return Math.min(hits / 2, 1.0);
};

function scoreProgrammatic(
  output: string,
  statsByRegister: Record<string, RegisterStats>,
  profile: any,
  contextType: string,
) {
  const contextKey = safeLower(contextType);
  const register = inferRegister(contextType);
  const stats = statsByRegister[register] ?? statsByRegister.GLOBAL;

  if (!stats) {
    return {
      score: 0.5,
      breakdown: {},
      register_used: register,
      reliable_feature_count: 0,
      total_features: 7,
    };
  }

  const emojiRegex =
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2702}-\u{27B0}]/gu;
  const doublingRegex = /\b(\w+)\s+\1\b/gi;
  const words = output.split(/\s+/).filter(Boolean);
  const wc = Math.max(words.length, 1);
  const sents = output.split(/[.!?]+/).filter((s) => s.trim());
  const sc = Math.max(sents.length, 1);

  const bd: Record<string, number> = {};
  bd.exclamation_density = gaussian(
    (output.match(/!/g) || []).length / wc,
    stats.exclamation.mean,
    stats.exclamation.std,
  );
  bd.period_usage = gaussian(
    (output.match(/\./g) || []).length / wc,
    stats.period.mean,
    stats.period.std,
  );
  bd.question_frequency = gaussian(
    (output.match(/\?/g) || []).length / sc,
    stats.question.mean,
    stats.question.std,
  );
  bd.sentence_length = Math.max(
    gaussian(wc / sc, stats.sentence_length.mean, stats.sentence_length.std),
    0.5,
  );

  const hasEmoji = (output.match(emojiRegex) || []).length > 0 ? 1 : 0;
  const profileEmoji = safeLower(profile?.local?.emoji_usage);
  if (
    ["slack", "text", "whatsapp"].includes(contextKey) &&
    ["moderate", "frequent"].includes(profileEmoji)
  ) {
    bd.emoji_present = hasEmoji ? 1.0 : 0.3;
  } else {
    bd.emoji_present = binaryScore(hasEmoji, stats.emoji_rate.rate);
  }

  bd.doubling_pattern = binaryScore(
    (output.match(doublingRegex) || []).length > 0 ? 1 : 0,
    stats.doubling_rate.rate,
  );
  bd.hedging_present = hedgeScore(output);

  const featureReliability: Record<string, boolean> = {
    exclamation_density: stats.exclamation.reliable,
    period_usage: stats.period.reliable,
    question_frequency: stats.question.reliable,
    sentence_length: stats.sentence_length.reliable,
    emoji_present: stats.emoji_rate.reliable,
    doubling_pattern: stats.doubling_rate.reliable,
    hedging_present: true,
  };

  const reliableScores = Object.entries(bd)
    .filter(([key]) => featureReliability[key] !== false)
    .map(([, value]) => value);

  const score = reliableScores.length > 0
    ? reliableScores.reduce((a, b) => a + b, 0) / reliableScores.length
    : 0.5;

  const reliableFeatureCount = Object.values(featureReliability)
    .filter(Boolean)
    .length;

  return {
    score,
    breakdown: bd,
    register_used: register,
    reliable_feature_count: reliableFeatureCount,
    total_features: 7,
  };
}

const getTextFromAnthropicResponse = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return "";
  const content = (payload as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";

  return content
    .filter((block) =>
      typeof block === "object" &&
      block !== null &&
      "type" in block &&
      "text" in block &&
      (block as { type?: string }).type === "text"
    )
    .map((block) => (block as { text?: string }).text ?? "")
    .join("")
    .trim();
};

async function scoreLLMJudge(output: string, profile: any) {
  const profileSubset = {
    global: profile.global,
    mid_level: profile.mid_level,
  };

  const prompt = `You are evaluating how well a generated text matches a person's writing style profile.

Score ONLY higher-level style dimensions - register, discourse structure, social orientation, politeness. Do not evaluate surface features like emoji or punctuation.

Style Profile:
${JSON.stringify(profileSubset, null, 2)}

Generated Text:
${output}

Return ONLY valid JSON, no markdown:
{
  "register_match": <float 0-1>,
  "information_structure_match": <float 0-1>,
  "social_orientation_match": <float 0-1>,
  "politeness_strategy_match": <float 0-1>,
  "opener_closer_match": <float 0-1>,
  "reasoning": "<one sentence>"
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: anthropicModel,
      max_tokens: 500,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const rawResponse = await response.text();
  if (!response.ok) {
    throw new Error(`LLM judge failed: ${response.status} ${rawResponse}`);
  }

  let data: unknown;
  try {
    data = JSON.parse(rawResponse);
  } catch {
    throw new Error(`LLM judge returned invalid API JSON: ${rawResponse}`);
  }

  const raw = getTextFromAnthropicResponse(data)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let result: Record<string, unknown>;
  try {
    result = JSON.parse(raw);
  } catch {
    throw new Error(`LLM judge returned invalid score JSON: ${raw}`);
  }

  const scoreKeys = [
    "register_match",
    "information_structure_match",
    "social_orientation_match",
    "politeness_strategy_match",
    "opener_closer_match",
  ];

  const scores = scoreKeys.map((key) => {
    const value = result[key];
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new Error(`LLM judge missing numeric field: ${key}`);
    }
    return value;
  });

  return {
    score: scores.reduce((a, b) => a + b, 0) / scores.length,
    breakdown: result,
    reasoning: typeof result.reasoning === "string" ? result.reasoning : "",
  };
}

async function scoreStyleEmbedding(output: string, corpusSamples: string[]) {
  try {
    const hfToken = Deno.env.get("HF_API_TOKEN");
    console.log("HF token present:", !!hfToken, "length:", hfToken?.length ?? 0);
    if (!hfToken) throw new Error("HF_API_TOKEN missing");
    if (corpusSamples.length === 0) throw new Error("No corpus samples available");

    const texts = [output, ...corpusSamples.slice(0, 20)];
    const response = await fetch(
      "https://router.huggingface.co/hf-inference/models/AnnaWegmann/Style-Embedding/pipeline/feature-extraction",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${hfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: texts }),
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!response.ok) throw new Error(`HF API error: ${response.status}`);

    const embeddings = await response.json() as number[][];
    if (!Array.isArray(embeddings) || embeddings.length < 2) {
      throw new Error("Invalid embeddings response");
    }

    const cosineSim = (a: number[], b: number[]) => {
      const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
      const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
      const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
      return dot / (normA * normB);
    };

    const genEmbedding = embeddings[0];
    const corpusEmbeddings = embeddings.slice(1);
    const similarities = corpusEmbeddings.map((e) => cosineSim(genEmbedding, e));
    const avgSim = similarities.reduce((a, b) => a + b, 0) / similarities.length;

    const baselineSims: number[] = [];
    for (let i = 0; i < Math.min(corpusEmbeddings.length - 1, 10); i++) {
      baselineSims.push(cosineSim(corpusEmbeddings[i], corpusEmbeddings[i + 1]));
    }
    const baseline = baselineSims.length
      ? baselineSims.reduce((a, b) => a + b, 0) / baselineSims.length
      : avgSim;
    const normalizedRaw = (avgSim + 1) / 2;
    const normalizedBaseline = (baseline + 1) / 2;
    const normalized = Math.min(
      Math.max(normalizedRaw / normalizedBaseline * 0.85, 0),
      1,
    );

    return { score: normalized, raw: avgSim, baseline, available: true };
  } catch (err) {
    console.error("Style embedding failed, falling back:", err);
    return { score: null, available: false, error: String(err) };
  }
}

function getWeights(
  _contextType: string,
  n: number,
  embeddingAvailable: boolean,
  reliableFeatureCount: number,
) {
  const dataRatio = Math.min(n / 50, 1);
  const reliabilityRatio = Math.min(reliableFeatureCount / 7, 1);
  const progWeight = 0.35 * dataRatio * reliabilityRatio;
  const llmWeight = 0.30 + (0.35 - progWeight);

  if (!embeddingAvailable) {
    return {
      embedding: 0,
      programmatic: progWeight + 0.175,
      llm: llmWeight + 0.175,
    };
  }
  return { embedding: 0.35, programmatic: progWeight, llm: llmWeight };
}

async function scoreWithLLMOnly(
  generation: { output: string; context_type: string },
  profile: { profile: any },
  corpusSourceType: string,
) {
  const llmResult = await scoreLLMJudge(generation.output, profile.profile);
  return {
    overall_score: Math.round(llmResult.score * 1000) / 1000,
    weights_used: { embedding: 0, programmatic: 0, llm: 1 },
    register_used: inferRegister(generation.context_type),
    register_sample_count: 0,
    source_type: corpusSourceType,
    data_quality: {
      n_messages: 0,
      data_confidence: "low",
      reliable_features: 0,
      total_features: 7,
      note: "Corpus samples unavailable - using LLM judge only",
    },
    style_embedding: {
      score: null,
      available: false,
      error: "corpus_samples unavailable",
    },
    programmatic: {
      score: null,
      skipped: true,
      reason: "corpus_samples unavailable",
      reliable_feature_count: 0,
      total_features: 7,
    },
    llm_judge: llmResult,
  } satisfies ScorePayload;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: corsHeaders },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (!supabaseUrl || !serviceRoleKey || !anthropicApiKey) {
    return new Response(
      JSON.stringify({ error: "Required environment variables are missing" }),
      { status: 500, headers: corsHeaders },
    );
  }

  let payload: ScoreRequest;
  try {
    payload = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: corsHeaders },
    );
  }

  if (!isNonEmptyString(payload?.generation_id)) {
    return new Response(
      JSON.stringify({ error: "`generation_id` is required" }),
      { status: 400, headers: corsHeaders },
    );
  }

  const generationId = payload.generation_id.trim();

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: generation, error: generationError } = await supabase
      .from("generations")
      .select("id, output, context_type, style_profile_id")
      .eq("id", generationId)
      .maybeSingle();

    if (generationError) {
      return new Response(
        JSON.stringify({ error: generationError.message }),
        { status: 500, headers: corsHeaders },
      );
    }

    if (!generation) {
      return new Response(
        JSON.stringify({ error: "Generation not found" }),
        { status: 404, headers: corsHeaders },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("style_profiles")
      .select("id, profile, corpus_id")
      .eq("id", generation.style_profile_id)
      .maybeSingle();

    if (profileError) {
      return new Response(
        JSON.stringify({ error: profileError.message }),
        { status: 500, headers: corsHeaders },
      );
    }

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "Style profile not found" }),
        { status: 404, headers: corsHeaders },
      );
    }

    const { data: corpus, error: corpusError } = await supabase
      .from("corpora")
      .select("id, source_type, corpus_samples, corpus_stats")
      .eq("id", profile.corpus_id)
      .maybeSingle();

    if (corpusError) {
      return new Response(
        JSON.stringify({ error: corpusError.message }),
        { status: 500, headers: corsHeaders },
      );
    }

    if (!corpus) {
      return new Response(
        JSON.stringify({ error: "Corpus not found" }),
        { status: 404, headers: corsHeaders },
      );
    }

    const corpusSamplesByRegister = corpus.corpus_samples as RegisterMessages | null;
    const sampleValues = corpusSamplesByRegister ? Object.values(corpusSamplesByRegister) : [];
    const hasSamples = sampleValues.some((msgs) => Array.isArray(msgs) && msgs.length > 0);

    if (!corpusSamplesByRegister || !hasSamples) {
      const scorePayload = await scoreWithLLMOnly(generation, profile, corpus.source_type);

      const { error: updateError } = await supabase
        .from("generations")
        .update({ score: scorePayload })
        .eq("id", generationId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: corsHeaders },
        );
      }

      return new Response(JSON.stringify(scorePayload), {
        status: 200,
        headers: corsHeaders,
      });
    }

    const statsByRegister: Record<string, RegisterStats> = {};
    for (const [reg, msgs] of Object.entries(corpusSamplesByRegister)) {
      statsByRegister[reg] = computeStats(msgs);
    }

    const register = inferRegister(generation.context_type);
    const registerSamples = (corpusSamplesByRegister[register]?.length ?? 0) >= 5
      ? corpusSamplesByRegister[register]
      : corpusSamplesByRegister.GLOBAL ?? [];

    const [progResult, llmResult, embResult] = await Promise.all([
      Promise.resolve(
        scoreProgrammatic(
          generation.output,
          statsByRegister,
          profile.profile,
          generation.context_type,
        ),
      ),
      scoreLLMJudge(generation.output, profile.profile),
      scoreStyleEmbedding(generation.output, registerSamples),
    ]);

    const weights = getWeights(
      generation.context_type,
      registerSamples.length,
      embResult.available,
      progResult.reliable_feature_count,
    );
    const embScore = embResult.available && embResult.score !== null ? embResult.score : 0;
    const overall =
      embScore * weights.embedding +
      progResult.score * weights.programmatic +
      llmResult.score * weights.llm;

    const nMessages = registerSamples.length;
    const dataQuality = {
      n_messages: nMessages,
      data_confidence: nMessages >= 50
        ? "high"
        : nMessages >= 20
        ? "medium"
        : "low",
      reliable_features: progResult.reliable_feature_count,
      total_features: 7,
      note: nMessages < 20
        ? "Small corpus - programmatic scorer down-weighted, LLM judge prioritized"
        : nMessages < 50
        ? "Medium corpus - some features may have wide confidence intervals"
        : "Sufficient data for reliable scoring across all dimensions",
    };

    const scorePayload = {
      overall_score: Math.round(overall * 1000) / 1000,
      weights_used: weights,
      register_used: register,
      register_sample_count: registerSamples.length,
      source_type: corpus.source_type,
      data_quality: dataQuality,
      style_embedding: embResult,
      programmatic: progResult,
      llm_judge: llmResult,
    };

    const { error: updateError } = await supabase
      .from("generations")
      .update({ score: scorePayload })
      .eq("id", generationId);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: corsHeaders },
      );
    }

    return new Response(JSON.stringify(scorePayload), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Scoring failed",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: corsHeaders },
    );
  }
});
