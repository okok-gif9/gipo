import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { parse as parseCookie } from "cookie";
import { z } from "zod";
import * as db from "../db";
import { decryptSetting, encryptSetting } from "../settingsCrypto";
import { followUpPreferenceInput, integrationSettingsInput } from "../storySchemas";
import { setTelegramWebhook } from "../telegramProvider";
import { hashTelegramLinkCode } from "../telegramIdentity";
import { protectedProcedure, router } from "../_core/trpc";
import { COOKIE_NAME } from "../../shared/const";
import { createHeartbeatJob, deleteHeartbeatJob, updateHeartbeatJob } from "../_core/heartbeat";

export const integrationRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const [settings, telegramLink] = await Promise.all([
      db.getIntegrationSettings(ctx.user.id),
      db.getTelegramLinkByUserId(ctx.user.id),
    ]);
    return {
      hasGrokApiKey: Boolean(settings?.grokApiKeyCiphertext),
      grokModel: settings?.grokModel ?? "grok-4.6",
      hasTelegramBotToken: Boolean(settings?.telegramBotTokenCiphertext),
      isTelegramLinked: Boolean(telegramLink?.telegramUserId),
      telegramActiveStoryRunId: telegramLink?.activeStoryRunId ?? null,
      linkCodeExpiresAt: telegramLink?.linkCodeExpiresAt ?? null,
    };
  }),
  update: protectedProcedure.input(integrationSettingsInput).mutation(async ({ ctx, input }) => {
    const changes: Parameters<typeof db.upsertIntegrationSettings>[1] = {};
    if (input.grokApiKey) changes.grokApiKeyCiphertext = encryptSetting(input.grokApiKey);
    if (input.grokModel) changes.grokModel = input.grokModel;
    if (input.telegramBotToken) {
      changes.telegramBotTokenCiphertext = encryptSetting(input.telegramBotToken);
      changes.telegramWebhookSecretCiphertext = encryptSetting(randomBytes(24).toString("base64url"));
    }
    await db.upsertIntegrationSettings(ctx.user.id, changes);
    return { success: true } as const;
  }),
  createTelegramLinkCode: protectedProcedure.mutation(async ({ ctx }) => {
    const settings = await db.getIntegrationSettings(ctx.user.id);
    if (!settings?.telegramBotTokenCiphertext) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Save a Telegram bot token before linking Telegram." });
    }
    const code = randomBytes(9).toString("base64url");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.upsertTelegramLinkCode(ctx.user.id, hashTelegramLinkCode(code), expiresAt);
    return { code, expiresAt };
  }),
  activateTelegramWebhook: protectedProcedure.mutation(async ({ ctx }) => {
    const settings = await db.getIntegrationSettings(ctx.user.id);
    if (!settings?.telegramBotTokenCiphertext || !settings.telegramWebhookSecretCiphertext) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Save a Telegram bot token before activating the webhook." });
    }
    const host = ctx.req.get("host");
    if (!host) throw new TRPCError({ code: "BAD_REQUEST", message: "Unable to determine the public site URL." });
    const protocol = (ctx.req.get("x-forwarded-proto") ?? ctx.req.protocol ?? "https").split(",")[0] ?? "https";
    const url = `${protocol}://${host}/api/telegram/${ctx.user.id}/webhook`;
    await setTelegramWebhook({
      token: decryptSetting(settings.telegramBotTokenCiphertext),
      secretToken: decryptSetting(settings.telegramWebhookSecretCiphertext),
      url,
    });
    return { success: true, webhookUrl: url } as const;
  }),
  setTelegramActiveStory: protectedProcedure
    .input(z.object({ storyRunId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const storyRun = await db.getStoryRunForParticipant(ctx.user.id, input.storyRunId);
      if (!storyRun) throw new TRPCError({ code: "NOT_FOUND", message: "Story run not found." });
      const current = await db.getTelegramLinkByUserId(ctx.user.id);
      if (!current?.telegramUserId) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Link your Telegram account first." });
      }
      const dbConnection = await db.getDb();
      if (!dbConnection) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { telegramLinks } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await dbConnection.update(telegramLinks).set({ activeStoryRunId: input.storyRunId }).where(eq(telegramLinks.userId, ctx.user.id));
      return { success: true } as const;
    }),
  getFollowUp: protectedProcedure
    .input(z.object({ storyRunId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const storyRun = await db.getStoryRunForParticipant(ctx.user.id, input.storyRunId);
      if (!storyRun) throw new TRPCError({ code: "NOT_FOUND", message: "Story run not found." });
      return db.getFollowUpPreference(input.storyRunId);
    }),
  updateFollowUp: protectedProcedure.input(followUpPreferenceInput).mutation(async ({ ctx, input }) => {
    const storyRun = await db.getStoryRunForParticipant(ctx.user.id, input.storyRunId);
    if (!storyRun) throw new TRPCError({ code: "NOT_FOUND", message: "Story run not found." });
    const existing = await db.getFollowUpPreference(input.storyRunId);
    const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
    if (!sessionToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in again before scheduling a follow-up." });
    if (!input.isOptedIn) {
      if (existing?.scheduleCronTaskUid) await deleteHeartbeatJob(existing.scheduleCronTaskUid, sessionToken);
      await db.upsertFollowUpPreference({ ...input, scheduleCronTaskUid: null });
      return { success: true, enabled: false } as const;
    }
    const job = existing?.scheduleCronTaskUid
      ? await updateHeartbeatJob(existing.scheduleCronTaskUid, { cron: "0 0 */6 * * *", enable: true }, sessionToken).then(() => ({ taskUid: existing.scheduleCronTaskUid }))
      : await createHeartbeatJob({
          name: `story-followup-${input.storyRunId}`,
          cron: "0 0 */6 * * *",
          path: "/api/scheduled/story-follow-up",
          description: `Consent-based story follow-up for run ${input.storyRunId}`,
        }, sessionToken);
    await db.upsertFollowUpPreference({ ...input, scheduleCronTaskUid: job.taskUid });
    return { success: true } as const;
  }),
});
