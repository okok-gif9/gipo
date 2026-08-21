import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { decryptSetting } from "../_shared/crypto.ts";
import { corsHeaders, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { sendTelegramText, sha256, verifySecret } from "../_shared/telegram.ts";

const replyWithGrok = async (db: ReturnType<typeof serviceClient>, ownerId: string, runId: string, text: string, token: string, chatId: string) => {
  const { data: run } = await db.from("story_runs").select("*,story_bots!inner(*)").eq("id", runId).eq("participant_id", ownerId).maybeSingle();
  if (!run || run.status !== "active") return sendTelegramText(token, chatId, "داستان فعال پیدا نشد یا به پایان رسیده است.");
  const { data: settings } = await db.from("integration_settings").select("grok_api_key_ciphertext,grok_model").eq("user_id", ownerId).single();
  if (!settings?.grok_api_key_ciphertext) return sendTelegramText(token, chatId, "کلید Grok در تنظیمات حساب ثبت نشده است.");
  const { data: history } = await db.from("story_messages").select("role,content").eq("story_run_id", runId).order("sequence");
  await db.rpc("append_story_message", { p_story_run_id: runId, p_role: "user", p_content: text, p_channel: "telegram", p_media_kind: "none", p_media_reference: null });
  const bot = run.story_bots as Record<string, unknown>; const system = ["Stay in character. Continue the role-playing story in Persian.", `CHARACTER: ${bot.name}`, `INSTRUCTIONS: ${bot.behavioral_instruction}`, `PREMISE: ${bot.story_premise}`, `ROLE: ${run.selected_role}`, `STATE: ${run.state_summary}`].join("\n");
  const upstream = await fetch("https://api.x.ai/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${await decryptSetting(settings.grok_api_key_ciphertext)}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: settings.grok_model || "grok-4.6", messages: [{ role: "system", content: system }, ...(history ?? []), { role: "user", content: text }] }) });
  const response = await upstream.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }> } | null; const reply = response?.choices?.[0]?.message?.content?.trim();
  if (!upstream.ok || !reply) throw new Error("GROK_REQUEST_FAILED");
  await db.rpc("append_story_message", { p_story_run_id: runId, p_role: "assistant", p_content: reply, p_channel: "telegram", p_media_kind: "none", p_media_reference: null }); await sendTelegramText(token, chatId, reply);
};

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders }); if (request.method !== "POST") return json({ error: { code: "METHOD_NOT_ALLOWED" } }, 405);
  try {
    const ownerId = new URL(request.url).searchParams.get("owner"); if (!ownerId) return json({ error: { code: "NOT_FOUND" } }, 404); const db = serviceClient();
    const { data: settings } = await db.from("integration_settings").select("telegram_bot_token_ciphertext,telegram_webhook_secret_ciphertext").eq("user_id", ownerId).maybeSingle();
    if (!settings?.telegram_bot_token_ciphertext || !settings.telegram_webhook_secret_ciphertext) return json({ error: { code: "NOT_FOUND" } }, 404);
    if (!verifySecret(request.headers.get("x-telegram-bot-api-secret-token"), await decryptSetting(settings.telegram_webhook_secret_ciphertext))) return json({ error: { code: "UNAUTHORIZED" } }, 401);
    const update = await request.json() as { update_id?: number; message?: { text?: string; from?: { id?: number }; chat?: { id?: number } } }; if (!update.update_id) return json({ ok: true, ignored: true });
    const { data: inserted } = await db.from("telegram_updates").upsert({ update_id: String(update.update_id) }, { onConflict: "update_id", ignoreDuplicates: true }).select("update_id"); if (!inserted?.length) return json({ ok: true, duplicate: true });
    const text = update.message?.text?.trim(), telegramUserId = update.message?.from?.id, chatId = update.message?.chat?.id; if (!text || !telegramUserId || !chatId) return json({ ok: true, ignored: true }); const token = await decryptSetting(settings.telegram_bot_token_ciphertext);
    if (text.startsWith("/start")) { const code = text.split(/\s+/)[1]; const { data: link } = code ? await db.from("telegram_links").select("user_id,link_code_expires_at").eq("link_code_hash", await sha256(code)).maybeSingle() : { data: null }; if (!link || !link.link_code_expires_at || new Date(link.link_code_expires_at) < new Date()) await sendTelegramText(token, String(chatId), "کد پیوند معتبر نیست یا منقضی شده است."); else { await db.from("telegram_links").update({ telegram_user_id: String(telegramUserId), telegram_chat_id: String(chatId), link_code_hash: null, link_code_expires_at: null, linked_at: new Date().toISOString() }).eq("user_id", link.user_id); await sendTelegramText(token, String(chatId), "حساب شما با موفقیت پیوند شد."); } return json({ ok: true }); }
    const { data: link } = await db.from("telegram_links").select("user_id,active_story_run_id").eq("telegram_user_id", String(telegramUserId)).maybeSingle(); if (!link?.active_story_run_id) { await sendTelegramText(token, String(chatId), "ابتدا حساب را پیوند دهید و یک داستان فعال انتخاب کنید."); return json({ ok: true }); }
    await replyWithGrok(db, link.user_id, link.active_story_run_id, text, token, String(chatId)); return json({ ok: true });
  } catch (error) { console.error(error); return json({ error: { code: "TELEGRAM_WEBHOOK_ERROR" } }, 500); }
});
