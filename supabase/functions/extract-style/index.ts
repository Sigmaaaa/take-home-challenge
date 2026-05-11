import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const anthropicModel = "claude-sonnet-4-6";

const styleProfileTemplate = `{
  "global": {
    "formality_score": 0.0,
    "register": "",
    "avg_message_length": "",
    "length_variance": "",
    "primary_contexts": [],
    "language_mixing": false,
    "overall_tone": "",
    "social_orientation": "",
    "politeness_strategy": ""
  },
  "mid_level": {
    "sentence_rhythm": "",
    "avg_sentences_per_message": 0.0,
    "uses_bullet_points": false,
    "uses_numbered_lists": false,
    "paragraph_structure": "",
    "question_frequency": "",
    "rhetorical_questions": false,
    "opener_patterns": { "examples": [], "pattern": "" },
    "closer_patterns": { "examples": [], "pattern": "" },
    "structural_habits": [],
    "information_structure": "",
    "context_switching": "",
    "follow_up_behavior": "",
    "social_maintenance_frequency": "",
    "topic_management": ""
  },
  "local": {
    "emoji_usage": "",
    "emoji_style": { "examples": [], "pattern": "" },
    "exclamation_frequency": "",
    "question_mark_style": "",
    "period_usage": "",
    "comma_usage": "",
    "capitalization": "",
    "typo_tolerance": "",
    "typo_patterns": [],
    "prosodic_compensation": {
      "letter_repetition": { "examples": [], "pattern": "" },
      "punctuation_stacking": { "examples": [], "pattern": "" },
      "caps_for_emphasis": false
    },
    "filler_phrases": { "examples": [], "pattern": "" },
    "hedging_language": { "examples": [], "pattern": "" },
    "intensifiers": { "examples": [], "pattern": "" },
    "pronoun_ratio": {
      "I_frequency": "",
      "you_frequency": "",
      "we_frequency": ""
    },
    "vocabulary_level": "",
    "technical_vocabulary": false,
    "humor_style": "",
    "warmth_markers": { "examples": [], "pattern": "" },
    "sign_offs": { "examples": [], "pattern": "" }
  },
  "register_shifts": {
    "formal_triggers": [],
    "casual_triggers": [],
    "shift_smoothness": ""
  },
  "cognitive_spike": {
    "coarse_signal": "",
    "mid_signal": "",
    "fine_signal": ""
  },
  "extraction_metadata": {
    "message_count_estimate": 0,
    "word_count_estimate": 0,
    "data_confidence": "",
    "low_confidence_dimensions": [],
    "extraction_notes": ""
  }
}`;

type ExtractStyleRequest = {
  corpus_id: string;
};

type RegisterMessages = Record<"WHATSAPP" | "SLACK" | "EMAIL" | "GLOBAL", string[]>;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const estimateMessageCount = (rawText: string) =>
  rawText
    .split(/^---$/gm)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .length;

const estimateWordCount = (rawText: string) =>
  rawText.split(/\s+/).filter(Boolean).length;

function parseCorpusSections(corpusText: string): RegisterMessages {
  const sections: RegisterMessages = {
    WHATSAPP: [],
    SLACK: [],
    EMAIL: [],
    GLOBAL: [],
  };

  let current: keyof RegisterMessages = "GLOBAL";
  let buffer: string[] = [];

  const flush = () => {
    const msg = buffer.join(" ").trim();
    if (msg.length > 20) {
      sections[current].push(msg);
      if (current !== "GLOBAL") {
        sections.GLOBAL.push(msg);
      }
    }
    buffer = [];
  };

  for (const line of corpusText.split("\n")) {
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
      flush();
    } else if (trimmed) {
      buffer.push(trimmed);
    }
  }

  flush();
  return sections;
}

function buildCorpusSamples(sections: RegisterMessages) {
  return Object.fromEntries(
    Object.entries(sections).map(([reg, msgs]) => {
      const step = Math.max(1, Math.floor(msgs.length / 15));
      return [reg, msgs.filter((_, i) => i % step === 0).slice(0, 15)];
    }),
  );
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callClaude(prompt: string, systemPrompt: string, anthropicApiKey: string) {
  const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: anthropicModel,
      max_tokens: 8000,
      temperature: 0,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const anthropicRaw = await anthropicResponse.text();

  if (!anthropicResponse.ok) {
    throw new Error(`Anthropic API request failed: ${anthropicRaw}`);
  }

  let anthropicPayload: unknown;
  try {
    anthropicPayload = JSON.parse(anthropicRaw);
  } catch {
    throw new Error(`Anthropic API returned invalid JSON: ${anthropicRaw}`);
  }

  const raw = getTextFromAnthropicResponse(anthropicPayload).trim();
  if (!raw) {
    throw new Error("Anthropic API returned empty text output");
  }

  return raw;
}

async function callClaudeWithRetry(
  prompt: string,
  systemPrompt: string,
  anthropicApiKey: string,
  maxRetries = 2,
) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await callClaude(prompt, systemPrompt, anthropicApiKey);
      const cleaned = response
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      return JSON.parse(cleaned);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await sleep(1000 * (attempt + 1));
    }
  }
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

  let payload: ExtractStyleRequest;
  try {
    payload = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: corsHeaders },
    );
  }

  if (!isNonEmptyString(payload?.corpus_id)) {
    return new Response(
      JSON.stringify({ error: "`corpus_id` is required" }),
      { status: 400, headers: corsHeaders },
    );
  }

  const corpusId = payload.corpus_id.trim();

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: corpus, error: corpusError } = await supabase
    .from("corpora")
    .select("id, raw_text, source_type, source_label")
    .eq("id", corpusId)
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

  if (!isNonEmptyString(corpus.raw_text)) {
    return new Response(
      JSON.stringify({ error: "Corpus raw text is unavailable for extraction" }),
      { status: 400, headers: corsHeaders },
    );
  }

  const corpusText = corpus.raw_text;
  const messageCountEstimate = estimateMessageCount(corpusText);
  const wordCountEstimate = estimateWordCount(corpusText);

  const userPrompt = [
    "Analyze this writing corpus and return ONLY valid JSON matching the exact structure below.",
    "Do not include markdown, code fences, commentary, or any extra keys.",
    "",
    "Required JSON structure:",
    styleProfileTemplate,
    "",
    "Corpus metadata:",
    `- Source type: ${corpus.source_type ?? "unknown"} (e.g. mixed, email, slack, whatsapp, reddit)`,
    `- Source label: ${corpus.source_label ?? ""}`,
    "",
    "If the corpus contains source labels like [EMAIL], [SLACK], [WHATSAPP], use them to understand register context.",
    "If the corpus is unlabeled or the source type is unknown, infer the likely communication contexts from the writing style itself and note them in primary_contexts.",
    "Do not assume any specific platform.",
    "",
    "Estimated corpus stats from preprocessing:",
    `- message_count_estimate: ${messageCountEstimate}`,
    `- word_count_estimate: ${wordCountEstimate}`,
    `- data_confidence should be "high" if 50+ messages and 1500+ words`,
    `- data_confidence should be "medium" if 20-49 messages or 500-1499 words`,
    `- data_confidence should be "low" if under 20 messages or under 500 words`,
    "",
    "Corpus:",
    corpusText,
  ].join("\n");

  const extractionSystemPrompt = [
    "You are an expert computational psycholinguist. Analyze the writing corpus and extract a structured style profile. Return ONLY valid JSON, no markdown, no explanation.",
    "",
    "Assess your confidence based on evidence available. Distinguish carefully between:",
    "- \"not observed\": feature absent from corpus but may exist in real usage",
    "- \"not present\": feature definitively absent based on sufficient evidence",
    "For corpora under 20 messages, prefer \"not observed\" over \"not present\" for any feature with zero examples. Do not fabricate patterns not evidenced in the corpus.",
    "",
    "\"low_confidence_dimensions\" must only contain leaf-level field names - never section names like \"global\", \"mid_level\", \"local\", \"register_shifts\", or \"cognitive_spike\".",
    "",
    "Only use names from this exact list:",
    "formality_score, register, avg_message_length, length_variance, overall_tone, social_orientation, politeness_strategy, language_mixing,",
    "sentence_rhythm, avg_sentences_per_message, uses_bullet_points, uses_numbered_lists, paragraph_structure, question_frequency, rhetorical_questions, opener_patterns, closer_patterns, structural_habits, information_structure, context_switching, follow_up_behavior, social_maintenance_frequency, topic_management,",
    "emoji_usage, emoji_style, exclamation_frequency, question_mark_style, period_usage, comma_usage, capitalization, typo_tolerance, typo_patterns, prosodic_compensation, filler_phrases, hedging_language, intensifiers, pronoun_ratio, vocabulary_level, technical_vocabulary, humor_style, warmth_markers, sign_offs,",
    "formal_triggers, casual_triggers, shift_smoothness,",
    "coarse_signal, mid_signal, fine_signal",
    "",
    "If register_shifts as a whole has thin evidence, flag \"formal_triggers\", \"casual_triggers\", and \"shift_smoothness\" individually instead.",
    "",
    "Example valid response: [\"humor_style\", \"rhetorical_questions\", \"prosodic_compensation\"]",
    "Example INVALID response: [\"humor_style (sparse examples)\", \"register_shifts shift_smoothness\"]",
  ].join("\n");

  let profile: unknown;
  try {
    profile = await callClaudeWithRetry(
      userPrompt,
      extractionSystemPrompt,
      anthropicApiKey,
    );
  } catch (error) {
    console.error("Style extraction failed after retries", error);
    return new Response(
      JSON.stringify({
        error: "Style extraction failed after retries. Try a smaller corpus or try again.",
      }),
      { status: 500, headers: corsHeaders },
    );
  }

  const { error: deleteError } = await supabase
    .from("style_profiles")
    .delete()
    .eq("corpus_id", corpusId);

  if (deleteError) {
    return new Response(
      JSON.stringify({ error: deleteError.message }),
      { status: 500, headers: corsHeaders },
    );
  }

  const { data: styleProfile, error: insertError } = await supabase
    .from("style_profiles")
    .insert({
      corpus_id: corpusId,
      profile,
    })
    .select("id")
    .single();

  if (insertError) {
    return new Response(
      JSON.stringify({ error: insertError.message }),
      { status: 500, headers: corsHeaders },
    );
  }

  const sections = parseCorpusSections(corpusText);
  const samples = buildCorpusSamples(sections);
  const corpusStats = {
    message_count_estimate: messageCountEstimate,
    word_count_estimate: wordCountEstimate,
    register_counts: Object.fromEntries(
      Object.entries(sections).map(([reg, msgs]) => [reg, msgs.length]),
    ),
    sample_counts: Object.fromEntries(
      Object.entries(samples).map(([reg, msgs]) => [reg, msgs.length]),
    ),
  };

  const { error: clearRawTextError } = await supabase
    .from("corpora")
    .update({
      corpus_stats: corpusStats,
      corpus_samples: samples,
      raw_text: null,
      message_count: messageCountEstimate,
    })
    .eq("id", corpusId);

  if (clearRawTextError) {
    return new Response(
      JSON.stringify({ error: clearRawTextError.message }),
      { status: 500, headers: corsHeaders },
    );
  }

  return new Response(
    JSON.stringify({
      style_profile_id: styleProfile.id,
      profile,
    }),
    { status: 200, headers: corsHeaders },
  );
});
