import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json; charset=utf-8" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });
const serviceClient = () => { const keys = Deno.env.get("SUPABASE_SECRET_KEYS"); const key = keys ? JSON.parse(keys).default : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if (!key) throw new Error("SERVER_MISCONFIGURED"); return createClient(Deno.env.get("SUPABASE_URL")!, key); };
const normalizeHandle = (value: string) => value.trim().toLowerCase();

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: { code: "METHOD_NOT_ALLOWED" } }, 405);
  try {
    const input = await request.json() as { handle?: string };
    const handle = normalizeHandle(input.handle ?? "");
    if (!/^[a-z0-9_]{3,24}$/.test(handle)) return json({ available: false, reason: "INVALID_HANDLE" }, 422);
    const { data, error } = await serviceClient().from("profiles").select("id").ilike("public_handle", handle).limit(1);
    if (error) throw error;
    return json({ available: (data?.length ?? 0) === 0 });
  } catch {
    return json({ error: { code: "HANDLE_CHECK_FAILED", message: "بررسی شناسه ممکن نشد." } }, 500);
  }
});
