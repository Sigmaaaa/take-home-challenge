import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const anthropicModel = "claude-sonnet-4-6";

type GenerateRequest = {
  style_profile_id: string;
  prompt: string;
  context_type: string;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

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

  let payload: GenerateRequest;
  try {
    payload = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: corsHeaders },
    );
  }

  if (
    !isNonEmptyString(payload?.style_profile_id) ||
    !isNonEmptyString(payload?.prompt) ||
    !isNonEmptyString(payload?.context_type)
  ) {
    return new Response(
      JSON.stringify({
        error: "`style_profile_id`, `prompt`, and `context_type` are required strings",
      }),
      { status: 400, headers: corsHeaders },
    );
  }

  const styleProfileId = payload.style_profile_id.trim();
  const writingPrompt = payload.prompt.trim();
  const contextType = payload.context_type.trim();

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: styleProfileRow, error: styleProfileError } = await supabase
    .from("style_profiles")
    .select("id, profile")
    .eq("id", styleProfileId)
    .maybeSingle();

  if (styleProfileError) {
    return new Response(
      JSON.stringify({ error: styleProfileError.message }),
      { status: 500, headers: corsHeaders },
    );
  }

  if (!styleProfileRow) {
    return new Response(
      JSON.stringify({ error: "Style profile not found" }),
      { status: 404, headers: corsHeaders },
    );
  }

  const userPrompt = [
    "Style Profile:",
    JSON.stringify(styleProfileRow.profile),
    "",
    `Writing Context: ${contextType}`,
    `Prompt: ${writingPrompt}`,
    "",
    "Generate text that authentically matches this person's voice for the given context and prompt.",
  ].join("\n");

  const startedAt = Date.now();
  const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: anthropicModel,
      max_tokens: 1200,
      temperature: 0.8,
      system: [
        "You are a writing style transfer engine. Given a detailed psycholinguistic style profile extracted from someone's real writing, generate new text that authentically matches their voice, tone, and habits.",
        "",
        "Critical rules:",
        "- Use the style profile to internalize patterns, not copy phrases verbatim",
        "- Examples in the profile illustrate underlying habits - generate naturally within those habits",
        "- Separate style from content - match HOW they write, not WHAT they wrote about",
        "- Adapt register appropriately based on the context type provided - context_type is free text describing the situation, not a fixed category",
        "- Output only the generated text, nothing else",
        "- RESTRAINT IS KEY: deploy stylistic markers naturally, not as a checklist. One natural instance of this person writing, not a compilation of their greatest hits",
        "",
        "Additionally, avoid all AI writing tells:",
        "- No em-dashes under any circumstances",
        "- No ellipses (...) used for dramatic effect",
        "- No colon-introduced lists unless the person explicitly uses them in their corpus",
        "- No phrases like \"I wanted to reach out\", \"I hope this finds you well\", \"touch base\", \"circle back\", \"at the end of the day\"",
        "- No over-structured formatting - avoid bullet points unless the profile shows the person uses them",
        "- Write like a human wrote it fast, not like a language model trying to sound professional",
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
  });
  const latencyMs = Date.now() - startedAt;

  const anthropicRaw = await anthropicResponse.text();

  if (!anthropicResponse.ok) {
    return new Response(
      JSON.stringify({
        error: "Anthropic API request failed",
        status: anthropicResponse.status,
        raw_response: anthropicRaw,
      }),
      { status: 500, headers: corsHeaders },
    );
  }

  let anthropicPayload: unknown;
  try {
    anthropicPayload = JSON.parse(anthropicRaw);
  } catch {
    return new Response(
      JSON.stringify({
        error: "Anthropic API returned invalid JSON",
        raw_response: anthropicRaw,
      }),
      { status: 500, headers: corsHeaders },
    );
  }

  const output = getTextFromAnthropicResponse(anthropicPayload);

  if (!isNonEmptyString(output)) {
    return new Response(
      JSON.stringify({
        error: "Anthropic API returned empty text output",
        raw_response: anthropicRaw,
      }),
      { status: 500, headers: corsHeaders },
    );
  }

  const usage = typeof anthropicPayload === "object" && anthropicPayload !== null
    ? (anthropicPayload as {
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
      };
      id?: string;
      stop_reason?: string | null;
      stop_sequence?: string | null;
    })
    : {};

  const generationMetadata = {
    latency_ms: latencyMs,
    anthropic_id: usage.id ?? null,
    stop_reason: usage.stop_reason ?? null,
    stop_sequence: usage.stop_sequence ?? null,
    token_count: usage.usage
      ? {
        input_tokens: usage.usage.input_tokens ?? null,
        output_tokens: usage.usage.output_tokens ?? null,
      }
      : null,
  };

  const { data: generation, error: generationError } = await supabase
    .from("generations")
    .insert({
      style_profile_id: styleProfileId,
      prompt: writingPrompt,
      context_type: contextType,
      output,
      score: null,
      model: anthropicModel,
      pipeline_version: "v1",
      generation_metadata: generationMetadata,
    })
    .select("id")
    .single();

  if (generationError) {
    return new Response(
      JSON.stringify({ error: generationError.message }),
      { status: 500, headers: corsHeaders },
    );
  }

  return new Response(
    JSON.stringify({
      generation_id: generation.id,
      output,
    }),
    { status: 200, headers: corsHeaders },
  );
});
