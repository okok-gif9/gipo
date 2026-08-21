import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { encryptSetting } from "../_shared/crypto.ts";
import { corsHeaders, json, requireBearer } from "../_shared/http.ts";
import { clientFor } from "../_shared/supabase.ts";

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: { code: "METHOD_NOT_ALLOWED" } }, 405);
  try {
    const authorization = requireBearer(request); const input = await request.json() as { grokApiKey?: string; grokModel?: string };
    const grokApiKey = input.grokApiKey?.trim() ?? "", grokModel = input.grokModel?.trim() ?? "";
    if (!grokApiKey && !grokModel) throw new Error("VALIDATION_ERROR");
    if (grokApiKey && (grokApiKey.length < 16 || grokApiKey.length > 1000)) throw new Error("VALIDATION_ERROR");
    if (grokModel.length > 80) throw new Error("VALIDATION_ERROR");
    const db = clientFor(authorization); const { data: { user } } = await db.auth.getUser(); if (!user) throw new Error("AUTH_REQUIRED");
    const patch: Record<string, string> = { user_id: user.id }; if (grokApiKey) patch.grok_api_key_ciphertext = await encryptSetting(grokApiKey); if (grokModel) patch.grok_model = grokModel;
    const { data, error } = await db.from("integration_settings").upsert(patch, { onConflict: "user_id" }).select("grok_api_key_ciphertext,grok_model").single(); if (error) throw error;
    return json({ grokConfigured: Boolean(data.grok_api_key_ciphertext), grokModel: data.grok_model });
  } catch (error) { const code = error instanceof Error ? error.message : "INTERNAL_ERROR"; return json({ error: { code, message: "ذخیرهٔ تنظیمات Grok ممکن نشد." } }, code === "AUTH_REQUIRED" ? 401 : code === "VALIDATION_ERROR" ? 422 : 500); }
});
