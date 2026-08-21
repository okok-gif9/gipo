import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
const serviceClient = () => { const keys = Deno.env.get("SUPABASE_SECRET_KEYS"); const key = keys ? JSON.parse(keys).default : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if (!key) throw new Error("SERVER_MISCONFIGURED"); return createClient(Deno.env.get("SUPABASE_URL")!, key); };

Deno.serve(async request => {
  if (request.method !== "POST") return json({ error: { code: "METHOD_NOT_ALLOWED" } }, 405);
  if (request.headers.get("x-gipo-schedule-secret") !== Deno.env.get("GIPO_SCHEDULE_SECRET")) return json({ error: { code: "UNAUTHORIZED" } }, 401);
  const service = serviceClient();
  const { data: profiles, error } = await service.from("profiles").select("id").eq("account_status", "deletion_pending").lte("deletion_effective_at", new Date().toISOString()).limit(50);
  if (error) return json({ error: { code: "QUERY_FAILED" } }, 500);
  let deleted = 0; const failures: string[] = [];
  for (const profile of profiles ?? []) { const { error: deleteError } = await service.auth.admin.deleteUser(profile.id); if (deleteError) failures.push(profile.id); else deleted += 1; }
  return json({ ok: true, deleted, failed: failures.length });
});
