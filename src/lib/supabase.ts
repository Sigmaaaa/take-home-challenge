import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});

export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anonKey;

export async function callFn<T = any>(name: string, body: unknown): Promise<T> {
  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data as T;
}
