import { createHash } from "node:crypto";
import type { Express, Request, Response } from "express";
import { z } from "zod";
import * as db from "./db";
import { buildStoryMessages, consumeGrokStream, requestGrokStream, resolveStoryState } from "./grokStoryProvider";
import { decryptSetting } from "./settingsCrypto";
import { extractTelegramMediaDirective, sendTelegramMedia, sendTelegramText } from "./telegramProvider";

const updateSchema = z.object({
  update_id: z.number().int(),
  message: z.object({
    text: z.string().optional(),
    from: z.object({ id: z.number().int() }).optional(),
    chat: z.object({ id: z.number().int() }),
  }).optional(),
});

const codeHash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

async function runTelegramStoryTurn(input: { ownerId: number; storyRunId: number; chatId: string; text: string; token: string }) {
  const story = await db.getStoryRunForParticipant(input.ownerId, input.storyRunId);
  if (!story) return sendTelegramText(input.token, input.chatId, "اجرای داستان فعال پیدا نشد. از وب‌سایت یک داستان را برای تلگرام انتخاب کنید.");
  if (story.run.status !== "active") return sendTelegramText(input.token, input.chatId, "این مسیر به پایان رسیده است. از وب‌سایت آن را دوباره شروع کنید.");
  const settings = await db.getIntegrationSettings(input.ownerId);
  if (!settings?.grokApiKeyCiphertext) return sendTelegramText(input.token, input.chatId, "کلید Grok در تنظیمات حساب ثبت نشده است.");
  const apiKey = decryptSetting(settings.grokApiKeyCiphertext);
  const history = await db.listStoryMessages(input.storyRunId);
  const messages = buildStoryMessages({ storyBot: story.storyBot, storyRun: story.run, messages: history, incomingMessage: input.text });
  await db.appendStoryMessage({ storyRunId: input.storyRunId, role: "user", content: input.text, channel: "telegram" });
  const stream = await requestGrokStream({ apiKey, model: settings.grokModel, messages });
  const rawReply = await consumeGrokStream(stream, () => undefined);
  const directive = extractTelegramMediaDirective(rawReply);
  await db.appendStoryMessage({ storyRunId: input.storyRunId, role: "assistant", content: directive.text, channel: "telegram", mediaKind: directive.media?.kind ?? "none", mediaReference: directive.media?.reference ?? null });
  try {
    const resolution = await resolveStoryState({ apiKey, model: settings.grokModel, storyBot: story.storyBot, storyRun: story.run, assistantReply: directive.text });
    await db.updateStoryRunState({ storyRunId: input.storyRunId, ...resolution });
  } catch (stateError) {
    console.warn("[TelegramWebhook] State resolution unavailable; reply has been preserved.", stateError);
  }
  await sendTelegramText(input.token, input.chatId, directive.text);
  if (directive.media && story.storyBot.allowTelegramMedia) await sendTelegramMedia({ token: input.token, chatId: input.chatId, ...directive.media });
}

export function registerTelegramWebhookRoutes(app: Express) {
  app.post("/api/telegram/:ownerId/webhook", async (req: Request, res: Response) => {
    try {
      const ownerId = Number(req.params.ownerId);
      if (!Number.isInteger(ownerId) || ownerId <= 0) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Bot configuration not found." } });
      const settings = await db.getIntegrationSettings(ownerId);
      if (!settings?.telegramBotTokenCiphertext || !settings.telegramWebhookSecretCiphertext) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Bot configuration not found." } });
      const expectedSecret = decryptSetting(settings.telegramWebhookSecretCiphertext);
      if (req.header("x-telegram-bot-api-secret-token") !== expectedSecret) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid webhook signature." } });
      const update = updateSchema.parse(req.body);
      if (!(await db.markTelegramUpdateProcessed(String(update.update_id)))) return res.json({ ok: true, duplicate: true });
      const text = update.message?.text?.trim(); const telegramUserId = update.message?.from?.id; const chatId = update.message?.chat.id;
      if (!text || !telegramUserId || !chatId) return res.json({ ok: true, ignored: true });
      const token = decryptSetting(settings.telegramBotTokenCiphertext);
      if (text.startsWith("/start")) {
        const code = text.split(/\s+/)[1];
        if (!code) { await sendTelegramText(token, String(chatId), "کد پیوند را از بخش تنظیمات سایت دریافت کنید و آن را مانند ‎/start CODE‎ بفرستید."); return res.json({ ok: true }); }
        const pending = await db.getTelegramLinkByCodeHash(codeHash(code));
        if (!pending || !pending.linkCodeExpiresAt || pending.linkCodeExpiresAt.getTime() < Date.now()) { await sendTelegramText(token, String(chatId), "این کد معتبر نیست یا منقضی شده است. از سایت یک کد تازه بسازید."); return res.json({ ok: true }); }
        await db.completeTelegramLink({ userId: pending.userId, telegramUserId: String(telegramUserId), telegramChatId: String(chatId) });
        await sendTelegramText(token, String(chatId), "حساب شما با موفقیت پیوند شد. اکنون از سایت یک داستان فعال را برای تلگرام انتخاب کنید.");
        return res.json({ ok: true });
      }
      const link = await db.getTelegramLinkByTelegramUserId(String(telegramUserId));
      if (!link?.activeStoryRunId) { await sendTelegramText(token, String(chatId), "ابتدا حساب را پیوند دهید و یک داستان فعال را از وب‌سایت انتخاب کنید."); return res.json({ ok: true }); }
      await runTelegramStoryTurn({ ownerId: link.userId, storyRunId: link.activeStoryRunId, chatId: String(chatId), text, token });
      return res.json({ ok: true });
    } catch (error) {
      console.error("[TelegramWebhook]", error);
      return res.status(500).json({ error: { code: "TELEGRAM_WEBHOOK_ERROR", message: "Webhook processing failed." } });
    }
  });
}
