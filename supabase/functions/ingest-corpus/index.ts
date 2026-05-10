import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type IngestCorpusRequest = {
  name: string;
  raw_text: string;
  source_type: string;
  source_label?: string | null;
  language?: string | null;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const countMessageDelimiters = (rawText: string) =>
  (rawText.match(/^---$/gm) ?? []).length;

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

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Supabase environment variables are missing" }),
      { status: 500, headers: corsHeaders },
    );
  }

  let payload: IngestCorpusRequest;
  try {
    payload = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: corsHeaders },
    );
  }

  if (
    !isNonEmptyString(payload?.name) ||
    !isNonEmptyString(payload?.raw_text) ||
    !isNonEmptyString(payload?.source_type)
  ) {
    return new Response(
      JSON.stringify({
        error: "`name`, `raw_text`, and `source_type` are required strings",
      }),
      { status: 400, headers: corsHeaders },
    );
  }

  const charCount = payload.raw_text.length;
  const messageCount = countMessageDelimiters(payload.raw_text);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase
    .from("corpora")
    .insert({
      name: payload.name.trim(),
      raw_text: payload.raw_text,
      source_type: payload.source_type.trim(),
      source_label: isNonEmptyString(payload.source_label)
        ? payload.source_label.trim()
        : null,
      language: isNonEmptyString(payload.language)
        ? payload.language.trim()
        : "en",
      char_count: charCount,
      message_count: messageCount,
    })
    .select("id")
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders },
    );
  }

  return new Response(
    JSON.stringify({ corpus_id: data.id }),
    { status: 200, headers: corsHeaders },
  );
});
