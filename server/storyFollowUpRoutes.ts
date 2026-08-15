import type { Express, Request, Response } from "express";
import * as db from "./db";
import { buildStoryMessages, consumeGrokStream, requestGrokStream, resolveStoryState } from "./grokStoryProvider";
import { decryptSetting } from "./settingsCrypto";
import { sendTelegramText } from "./telegramProvider";
import { sdk } from "./_core/sdk";

export function registerStoryFollowUpRoutes(app: Express) {
  app.post("/api/scheduled/story-follow-up", async (req: Request, res: Response) => {
    try {
      const cronUser = await sdk.authenticateRequest(req);
      if (!cronUser.isCron || !cronUser.taskUid) return res.status(403).json({ error: "cron-only" });
      const preference = await db.getFollowUpPreferenceByTaskUid(cronUser.taskUid);
      if (!preference || !preference.isOptedIn) return res.json({ ok: true, skipped: "disabled-or-orphan" });
      const story = await db.getStoryRunById(preference.storyRunId);
      if (!story || story.run.status !== "active") return res.json({ ok: true, skipped: "run-not-active" });
      const cutoff = Date.now() - preference.inactivityHours * 60 * 60 * 1000;
      if (story.run.lastInteractionAt.getTime() > cutoff) return res.json({ ok: true, skipped: "recently-active" });
      if (preference.lastFollowUpAt && preference.lastFollowUpAt.getTime() >= story.run.lastInteractionAt.getTime()) return res.json({ ok: true, skipped: "already-followed-up" });
      const [link, settings] = await Promise.all([db.getTelegramLinkByUserId(story.run.participantId), db.getIntegrationSettings(story.run.participantId)]);
      if (!link?.telegramChatId || !settings?.grokApiKeyCiphertext || !settings.telegramBotTokenCiphertext) return res.json({ ok: true, skipped: "integration-unavailable" });
      const apiKey = decryptSetting(settings.grokApiKeyCiphertext);
      const history = await db.listStoryMessages(story.run.id);
      const messages = buildStoryMessages({ storyBot: story.storyBot, storyRun: story.run, messages: history, incomingMessage: "The player has been away. Send one short, in-character Telegram nudge that invites their return without inventing major plot events." });
      const stream = await requestGrokStream({ apiKey, model: settings.grokModel, messages });
      const reply = await consumeGrokStream(stream, () => undefined);
      await db.appendStoryMessage({ storyRunId: story.run.id, role: "assistant", content: reply, channel: "telegram" });
      try {
        const resolution = await resolveStoryState({ apiKey, model: settings.grokModel, storyBot: story.storyBot, storyRun: story.run, assistantReply: reply });
        await db.updateStoryRunState({ storyRunId: story.run.id, ...resolution });
      } catch (stateError) {
        console.warn("[StoryFollowUp] State resolution unavailable; reply has been preserved.", stateError);
      }
      await sendTelegramText(decryptSetting(settings.telegramBotTokenCiphertext), link.telegramChatId, reply);
      await db.updateFollowUpSentAt(story.run.id);
      return res.json({ ok: true, delivered: true });
    } catch (error) {
      console.error("[StoryFollowUp]", error);
      return res.status(500).json({ error: String(error), timestamp: new Date().toISOString() });
    }
  });
}
