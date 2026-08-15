import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /** Surrogate primary key. Auto-incremented numeric value managed by the database. */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const storyBots = mysqlTable(
  "storyBots",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description").notNull(),
    avatarSymbol: varchar("avatarSymbol", { length: 12 }).default("✦").notNull(),
    behavioralInstruction: text("behavioralInstruction").notNull(),
    storyPremise: text("storyPremise").notNull(),
    roleOptions: json("roleOptions").$type<string[]>().notNull(),
    worldRules: text("worldRules").notNull(),
    endingConditions: text("endingConditions").notNull(),
    visibility: mysqlEnum("visibility", ["public", "private"]).default("private").notNull(),
    allowTelegramMedia: boolean("allowTelegramMedia").default(false).notNull(),
    isArchived: boolean("isArchived").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("storyBots_ownerId_idx").on(table.ownerId),
    index("storyBots_visibility_idx").on(table.visibility),
  ],
);

export const storyBotAccess = mysqlTable(
  "storyBotAccess",
  {
    id: int("id").autoincrement().primaryKey(),
    storyBotId: int("storyBotId")
      .notNull()
      .references(() => storyBots.id, { onDelete: "cascade" }),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("storyBotAccess_bot_user_unique").on(table.storyBotId, table.userId),
    index("storyBotAccess_userId_idx").on(table.userId),
  ],
);

export const storyRuns = mysqlTable(
  "storyRuns",
  {
    id: int("id").autoincrement().primaryKey(),
    storyBotId: int("storyBotId")
      .notNull()
      .references(() => storyBots.id, { onDelete: "cascade" }),
    participantId: int("participantId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 180 }).notNull(),
    selectedRole: varchar("selectedRole", { length: 160 }).notNull(),
    status: mysqlEnum("status", ["active", "ended", "archived"]).default("active").notNull(),
    stateSummary: text("stateSummary").notNull(),
    stateJson: json("stateJson").$type<Record<string, unknown>>().notNull(),
    endingTitle: varchar("endingTitle", { length: 180 }),
    endingText: text("endingText"),
    messageCount: int("messageCount").default(0).notNull(),
    lastInteractionAt: timestamp("lastInteractionAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("storyRuns_participantId_idx").on(table.participantId),
    index("storyRuns_storyBotId_idx").on(table.storyBotId),
    index("storyRuns_status_updated_idx").on(table.participantId, table.status, table.updatedAt),
  ],
);

export const storyMessages = mysqlTable(
  "storyMessages",
  {
    id: int("id").autoincrement().primaryKey(),
    storyRunId: int("storyRunId")
      .notNull()
      .references(() => storyRuns.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
    content: text("content").notNull(),
    channel: mysqlEnum("channel", ["web", "telegram", "system"]).notNull(),
    sequence: int("sequence").notNull(),
    mediaKind: mysqlEnum("mediaKind", ["none", "sticker", "gif"]).default("none").notNull(),
    mediaReference: text("mediaReference"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("storyMessages_run_sequence_unique").on(table.storyRunId, table.sequence),
    index("storyMessages_run_created_idx").on(table.storyRunId, table.createdAt),
  ],
);

export const userIntegrationSettings = mysqlTable("userIntegrationSettings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  grokApiKeyCiphertext: text("grokApiKeyCiphertext"),
  grokModel: varchar("grokModel", { length: 80 }).default("grok-4.6").notNull(),
  telegramBotTokenCiphertext: text("telegramBotTokenCiphertext"),
  telegramWebhookSecretCiphertext: text("telegramWebhookSecretCiphertext"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const telegramLinks = mysqlTable(
  "telegramLinks",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    telegramUserId: varchar("telegramUserId", { length: 32 }).unique(),
    telegramChatId: varchar("telegramChatId", { length: 32 }),
    linkCodeHash: varchar("linkCodeHash", { length: 128 }),
    linkCodeExpiresAt: timestamp("linkCodeExpiresAt"),
    activeStoryRunId: int("activeStoryRunId").references(() => storyRuns.id, { onDelete: "set null" }),
    linkedAt: timestamp("linkedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("telegramLinks_telegramUserId_idx").on(table.telegramUserId)],
);

export const telegramUpdates = mysqlTable("telegramUpdates", {
  id: int("id").autoincrement().primaryKey(),
  updateId: varchar("updateId", { length: 32 }).notNull().unique(),
  processedAt: timestamp("processedAt").defaultNow().notNull(),
});

export const followUpPreferences = mysqlTable(
  "followUpPreferences",
  {
    id: int("id").autoincrement().primaryKey(),
    storyRunId: int("storyRunId")
      .notNull()
      .references(() => storyRuns.id, { onDelete: "cascade" })
      .unique(),
    isOptedIn: boolean("isOptedIn").default(false).notNull(),
    inactivityHours: int("inactivityHours").default(48).notNull(),
    lastFollowUpAt: timestamp("lastFollowUpAt"),
    scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("followUpPreferences_schedule_uid_idx").on(table.scheduleCronTaskUid)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type StoryBot = typeof storyBots.$inferSelect;
export type StoryRun = typeof storyRuns.$inferSelect;
export type StoryMessage = typeof storyMessages.$inferSelect;
