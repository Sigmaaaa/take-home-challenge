import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type DeleteGenerationRequest = {
  generation_id: string;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

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

  let payload: DeleteGenerationRequest;
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

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: existing, error: lookupError } = await supabase
    .from("generations")
    .select("id")
    .eq("id", generationId)
    .maybeSingle();

  if (lookupError) {
    return new Response(
      JSON.stringify({ error: lookupError.message }),
      { status: 500, headers: corsHeaders },
    );
  }

  if (!existing) {
    return new Response(
      JSON.stringify({ error: "Generation not found" }),
      { status: 404, headers: corsHeaders },
    );
  }

  const { error: deleteError } = await supabase
    .from("generations")
    .delete()
    .eq("id", generationId);

  if (deleteError) {
    return new Response(
      JSON.stringify({ error: deleteError.message }),
      { status: 500, headers: corsHeaders },
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: corsHeaders },
  );
});
