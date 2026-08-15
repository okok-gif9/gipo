import { and, desc, eq, inArray, max, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  followUpPreferences,
  InsertUser,
  storyBotAccess,
  storyBots,
  storyMessages,
  storyRuns,
  telegramLinks,
  telegramUpdates,
  userIntegrationSettings,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import type { StoryBotInput } from "./storySchemas";
import { persistStoryRunState } from "./storyRunPersistence";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database connection is unavailable.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await requireDb();
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    const value = user[field];
    if (value !== undefined) {
      values[field] = value ?? null;
      updateSet[field] = value ?? null;
    }
  }

  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await requireDb();
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listStoryBotsForUser(userId: number) {
  const db = await requireDb();
  const shared = await db
    .select({ storyBotId: storyBotAccess.storyBotId })
    .from(storyBotAccess)
    .where(eq(storyBotAccess.userId, userId));
  const accessConditions = [eq(storyBots.ownerId, userId), eq(storyBots.visibility, "public")];
  if (shared.length > 0) accessConditions.push(inArray(storyBots.id, shared.map(row => row.storyBotId)));

  return db
    .select()
    .from(storyBots)
    .where(and(eq(storyBots.isArchived, false), or(...accessConditions)))
    .orderBy(desc(storyBots.updatedAt));
}

export async function listPublicStoryBots() {
  const db = await requireDb();
  return db
    .select()
    .from(storyBots)
    .where(and(eq(storyBots.isArchived, false), eq(storyBots.visibility, "public")))
    .orderBy(desc(storyBots.updatedAt));
}

export async function getStoryBotById(storyBotId: number) {
  const db = await requireDb();
  const result = await db.select().from(storyBots).where(eq(storyBots.id, storyBotId)).limit(1);
  return result[0];
}

export async function canAccessStoryBot(userId: number, storyBotId: number) {
  const storyBot = await getStoryBotById(storyBotId);
  if (!storyBot || storyBot.isArchived) return false;
  if (storyBot.ownerId === userId || storyBot.visibility === "public") return true;

  const db = await requireDb();
  const result = await db
    .select({ id: storyBotAccess.id })
    .from(storyBotAccess)
    .where(and(eq(storyBotAccess.storyBotId, storyBotId), eq(storyBotAccess.userId, userId)))
    .limit(1);
  return Boolean(result[0]);
}

export async function createStoryBot(ownerId: number, input: StoryBotInput) {
  const db = await requireDb();
  const result = await db.insert(storyBots).values({ ownerId, ...input });
  const storyBotId = Number(result[0].insertId);
  return getStoryBotById(storyBotId);
}

export async function updateOwnedStoryBot(ownerId: number, storyBotId: number, input: Partial<StoryBotInput>) {
  const db = await requireDb();
  const result = await db
    .update(storyBots)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(storyBots.id, storyBotId), eq(storyBots.ownerId, ownerId)));
  if (result[0].affectedRows === 0) return undefined;
  return getStoryBotById(storyBotId);
}

export async function archiveOwnedStoryBot(ownerId: number, storyBotId: number) {
  const db = await requireDb();
  const result = await db
    .update(storyBots)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(and(eq(storyBots.id, storyBotId), eq(storyBots.ownerId, ownerId)));
  return result[0].affectedRows > 0;
}

export async function deleteOwnedStoryBot(ownerId: number, storyBotId: number) {
  const db = await requireDb();
  const result = await db
    .delete(storyBots)
    .where(and(eq(storyBots.id, storyBotId), eq(storyBots.ownerId, ownerId)));
  return result[0].affectedRows > 0;
}

export async function listStoryRuns(participantId: number) {
  const db = await requireDb();
  return db
    .select({ run: storyRuns, storyBot: storyBots })
    .from(storyRuns)
    .innerJoin(storyBots, eq(storyRuns.storyBotId, storyBots.id))
    .where(eq(storyRuns.participantId, participantId))
    .orderBy(desc(storyRuns.updatedAt));
}

export async function getStoryRunForParticipant(participantId: number, storyRunId: number) {
  const db = await requireDb();
  const result = await db
    .select({ run: storyRuns, storyBot: storyBots })
    .from(storyRuns)
    .innerJoin(storyBots, eq(storyRuns.storyBotId, storyBots.id))
    .where(and(eq(storyRuns.id, storyRunId), eq(storyRuns.participantId, participantId)))
    .limit(1);
  return result[0];
}

export async function getStoryRunById(storyRunId: number) {
  const db = await requireDb();
  const result = await db
    .select({ run: storyRuns, storyBot: storyBots })
    .from(storyRuns)
    .innerJoin(storyBots, eq(storyRuns.storyBotId, storyBots.id))
    .where(eq(storyRuns.id, storyRunId))
    .limit(1);
  return result[0];
}

export async function createStoryRun(
  participantId: number,
  input: { storyBotId: number; selectedRole: string; title: string },
) {
  const db = await requireDb();
  const result = await db.insert(storyRuns).values({
    storyBotId: input.storyBotId,
    participantId,
    selectedRole: input.selectedRole,
    title: input.title,
    stateSummary: "The story has just begun. Establish the opening scene and player intent.",
    stateJson: { flags: [], milestones: [], ending: false },
  });
  return getStoryRunForParticipant(participantId, Number(result[0].insertId));
}

export async function restartStoryRun(participantId: number, storyRunId: number) {
  const existing = await getStoryRunForParticipant(participantId, storyRunId);
  if (!existing) return undefined;
  return createStoryRun(participantId, {
    storyBotId: existing.run.storyBotId,
    selectedRole: existing.run.selectedRole,
    title: `${existing.storyBot.name} — a new path`,
  });
}

export async function archiveStoryRun(participantId: number, storyRunId: number) {
  const db = await requireDb();
  const result = await db
    .update(storyRuns)
    .set({ status: "archived", updatedAt: new Date() })
    .where(and(eq(storyRuns.id, storyRunId), eq(storyRuns.participantId, participantId)));
  return result[0].affectedRows > 0;
}

export async function listStoryMessages(storyRunId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(storyMessages)
    .where(eq(storyMessages.storyRunId, storyRunId))
    .orderBy(storyMessages.sequence);
}

export async function appendStoryMessage(input: {
  storyRunId: number;
  role: "user" | "assistant" | "system";
  content: string;
  channel: "web" | "telegram" | "system";
  mediaKind?: "none" | "sticker" | "gif";
  mediaReference?: string | null;
}) {
  const db = await requireDb();
  const previous = await db
    .select({ sequence: max(storyMessages.sequence) })
    .from(storyMessages)
    .where(eq(storyMessages.storyRunId, input.storyRunId));
  const sequence = Number(previous[0]?.sequence ?? 0) + 1;
  const result = await db.insert(storyMessages).values({ ...input, sequence, mediaKind: input.mediaKind ?? "none" });
  await db
    .update(storyRuns)
    .set({
      messageCount: sql`${storyRuns.messageCount} + 1`,
      lastInteractionAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(storyRuns.id, input.storyRunId));
  return Number(result[0].insertId);
}

export async function updateStoryRunState(input: {
  storyRunId: number;
  stateSummary: string;
  stateJson: Record<string, unknown>;
  status: "active" | "ended";
  endingTitle?: string | null;
  endingText?: string | null;
}) {
  const db = await requireDb();
  const { storyRunId, ...changes } = input;
  await persistStoryRunState({ db, table: storyRuns, storyRunId, changes, whereStoryRunId: id => eq(storyRuns.id, id) });
}

export async function getIntegrationSettings(userId: number) {
  const db = await requireDb();
  const result = await db
    .select()
    .from(userIntegrationSettings)
    .where(eq(userIntegrationSettings.userId, userId))
    .limit(1);
  return result[0];
}

export async function upsertIntegrationSettings(
  userId: number,
  input: {
    grokApiKeyCiphertext?: string;
    grokModel?: string;
    telegramBotTokenCiphertext?: string;
    telegramWebhookSecretCiphertext?: string;
  },
) {
  const db = await requireDb();
  await db
    .insert(userIntegrationSettings)
    .values({ userId, ...input })
    .onDuplicateKeyUpdate({ set: { ...input, updatedAt: new Date() } });
  return getIntegrationSettings(userId);
}

export async function getTelegramLinkByUserId(userId: number) {
  const db = await requireDb();
  const result = await db.select().from(telegramLinks).where(eq(telegramLinks.userId, userId)).limit(1);
  return result[0];
}

export async function getTelegramLinkByTelegramUserId(telegramUserId: string) {
  const db = await requireDb();
  const result = await db
    .select()
    .from(telegramLinks)
    .where(eq(telegramLinks.telegramUserId, telegramUserId))
    .limit(1);
  return result[0];
}

export async function getTelegramLinkByCodeHash(linkCodeHash: string) {
  const db = await requireDb();
  const result = await db
    .select()
    .from(telegramLinks)
    .where(eq(telegramLinks.linkCodeHash, linkCodeHash))
    .limit(1);
  return result[0];
}

export async function completeTelegramLink(input: { userId: number; telegramUserId: string; telegramChatId: string }) {
  const db = await requireDb();
  await db
    .update(telegramLinks)
    .set({
      telegramUserId: input.telegramUserId,
      telegramChatId: input.telegramChatId,
      linkCodeHash: null,
      linkCodeExpiresAt: null,
      linkedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(telegramLinks.userId, input.userId));
}

export async function markTelegramUpdateProcessed(updateId: string) {
  const db = await requireDb();
  try {
    await db.insert(telegramUpdates).values({ updateId });
    return true;
  } catch {
    return false;
  }
}

export async function upsertTelegramLinkCode(userId: number, linkCodeHash: string, linkCodeExpiresAt: Date) {
  const db = await requireDb();
  await db
    .insert(telegramLinks)
    .values({ userId, linkCodeHash, linkCodeExpiresAt })
    .onDuplicateKeyUpdate({ set: { linkCodeHash, linkCodeExpiresAt, updatedAt: new Date() } });
}

export async function upsertFollowUpPreference(input: {
  storyRunId: number;
  isOptedIn: boolean;
  inactivityHours: number;
  scheduleCronTaskUid?: string | null;
}) {
  const db = await requireDb();
  await db
    .insert(followUpPreferences)
    .values(input)
    .onDuplicateKeyUpdate({ set: { ...input, updatedAt: new Date() } });
}

export async function getFollowUpPreference(storyRunId: number) {
  const db = await requireDb();
  const result = await db
    .select()
    .from(followUpPreferences)
    .where(eq(followUpPreferences.storyRunId, storyRunId))
    .limit(1);
  return result[0];
}

export async function getFollowUpPreferenceByTaskUid(scheduleCronTaskUid: string) {
  const db = await requireDb();
  const result = await db
    .select()
    .from(followUpPreferences)
    .where(eq(followUpPreferences.scheduleCronTaskUid, scheduleCronTaskUid))
    .limit(1);
  return result[0];
}

export async function updateFollowUpSentAt(storyRunId: number) {
  const db = await requireDb();
  await db
    .update(followUpPreferences)
    .set({ lastFollowUpAt: new Date(), updatedAt: new Date() })
    .where(eq(followUpPreferences.storyRunId, storyRunId));
}
