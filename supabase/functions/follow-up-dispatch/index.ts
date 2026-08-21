import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { decryptSetting } from "../_shared/crypto.ts";
import { json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { sendTelegramText } from "../_shared/telegram.ts";

Deno.serve(async request => {
  if (request.method !== "POST") return json({ error: { code: "METHOD_NOT_ALLOWED" } }, 405);
  if (request.headers.get("x-gipo-schedule-secret") !== Deno.env.get("GIPO_SCHEDULE_SECRET")) return json({ error: { code: "UNAUTHORIZED" } }, 401);
  const db = serviceClient(); const { data: due, error } = await db.rpc("claim_due_follow_ups", { p_limit: 25 }); if (error) return json({ error: { code: "CLAIM_FAILED" } }, 500);
  let sent = 0;
  for (const candidate of due ?? []) {
    try {
      const { data: run } = await db.from("story_runs").select("*,story_bots!inner(*)").eq("id", candidate.story_run_id).single(); const { data: link } = await db.from("telegram_links").select("telegram_chat_id").eq("user_id", run.participant_id).maybeSingle(); const { data: settings } = await db.from("integration_settings").select("grok_api_key_ciphertext,grok_model,telegram_bot_token_ciphertext").eq("user_id", run.participant_id).maybeSingle();
      if (!link?.telegram_chat_id || !settings?.grok_api_key_ciphertext || !settings.telegram_bot_token_ciphertext) throw new Error("INTEGRATION_UNAVAILABLE");
      const upstream = await fetch("https://api.x.ai/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${await decryptSetting(settings.grok_api_key_ciphertext)}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: settings.grok_model || "grok-4.6", messages: [{ role: "system", content: `Send one short Persian in-character Telegram nudge. Character: ${(run.story_bots as Record<string, unknown>).name}. Do not invent major plot events.` }] }) }); const result = await upstream.json() as { choices?: Array<{ message?: { content?: string } }> }; const text = result.choices?.[0]?.message?.content?.trim(); if (!text) throw new Error("GROK_REQUEST_FAILED");
      await sendTelegramText(await decryptSetting(settings.telegram_bot_token_ciphertext), link.telegram_chat_id, text); await db.rpc("append_story_message", { p_story_run_id: run.id, p_role: "assistant", p_content: text, p_channel: "telegram", p_media_kind: "none", p_media_reference: null }); await db.from("follow_up_preferences").update({ last_follow_up_at: new Date().toISOString() }).eq("story_run_id", run.id); await db.from("follow_up_deliveries").update({ status: "sent", sent_at: new Date().toISOString() }).eq("story_run_id", run.id).eq("interaction_at", candidate.interaction_at); sent += 1;
    } catch (failure) { await db.from("follow_up_deliveries").update({ status: "failed", error_code: failure instanceof Error ? failure.message : "FAILED" }).eq("story_run_id", candidate.story_run_id).eq("interaction_at", candidate.interaction_at); }
  }
  return json({ ok: true, claimed: due?.length ?? 0, sent });
});
