import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json; charset=utf-8" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });
const requireBearer = (request: Request) => { const value = request.headers.get("authorization"); if (!value?.startsWith("Bearer ")) throw new Error("AUTH_REQUIRED"); return value; };
const publishableKey = () => { const keys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"); return keys ? JSON.parse(keys).default : Deno.env.get("SUPABASE_ANON_KEY")!; };
const clientFor = (authorization: string) => createClient(Deno.env.get("SUPABASE_URL")!, publishableKey(), { global: { headers: { Authorization: authorization } } });
const serviceClient = () => { const keys = Deno.env.get("SUPABASE_SECRET_KEYS"); const key = keys ? JSON.parse(keys).default : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if (!key) throw new Error("SERVER_MISCONFIGURED"); return createClient(Deno.env.get("SUPABASE_URL")!, key); };
const deletionWindowMs = 14 * 24 * 60 * 60 * 1000;

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: { code: "METHOD_NOT_ALLOWED" } }, 405);
  try {
    const authorization = requireBearer(request);
    const auth = clientFor(authorization);
    const { data: { user } } = await auth.auth.getUser();
    if (!user) throw new Error("AUTH_REQUIRED");
    const input = await request.json() as { action?: "request_deletion" | "cancel_deletion"; confirmation?: string };
    const service = serviceClient();
    const { data: profile, error: profileError } = await service.from("profiles").select("account_status,deletion_effective_at").eq("id", user.id).single();
    if (profileError || !profile) throw new Error("PROFILE_NOT_FOUND");
    if (input.action === "request_deletion") {
      if (input.confirmation !== "حذف حساب") throw new Error("CONFIRMATION_REQUIRED");
      if (profile.account_status === "deletion_pending") return json({ status: "deletion_pending", deletionEffectiveAt: profile.deletion_effective_at });
      const now = new Date(); const deletionEffectiveAt = new Date(now.getTime() + deletionWindowMs).toISOString();
      const { error: updateError } = await service.from("profiles").update({ account_status: "deletion_pending", deletion_requested_at: now.toISOString(), deletion_effective_at: deletionEffectiveAt }).eq("id", user.id);
      if (updateError) throw updateError;
      await service.from("integration_settings").delete().eq("user_id", user.id);
      await service.auth.admin.signOut(user.id, "global");
      return json({ status: "deletion_pending", deletionEffectiveAt });
    }
    if (input.action === "cancel_deletion") {
      if (profile.account_status !== "deletion_pending") throw new Error("NO_DELETION_REQUEST");
      if (!profile.deletion_effective_at || new Date(profile.deletion_effective_at).getTime() <= Date.now()) throw new Error("DELETION_WINDOW_EXPIRED");
      const { error: updateError } = await service.from("profiles").update({ account_status: "active", deletion_requested_at: null, deletion_effective_at: null }).eq("id", user.id);
      if (updateError) throw updateError;
      return json({ status: "active" });
    }
    throw new Error("VALIDATION_ERROR");
  } catch (error) {
    const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
    const status = code === "AUTH_REQUIRED" ? 401 : ["CONFIRMATION_REQUIRED", "NO_DELETION_REQUEST", "DELETION_WINDOW_EXPIRED", "VALIDATION_ERROR"].includes(code) ? 422 : 500;
    return json({ error: { code, message: "مدیریت حذف حساب ممکن نشد." } }, status);
  }
});
