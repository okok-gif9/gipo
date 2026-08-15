import { z } from "zod";

const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);

export const storyBotInput = z.object({
  name: requiredText("Name", 120),
  description: requiredText("Description", 2_000),
  avatarSymbol: z.string().trim().min(1).max(12).default("✦"),
  behavioralInstruction: requiredText("Behavioral instruction", 12_000),
  storyPremise: requiredText("Story premise", 12_000),
  roleOptions: z.array(requiredText("Role", 160)).min(1).max(12),
  worldRules: requiredText("World rules", 8_000),
  endingConditions: requiredText("Ending conditions", 8_000),
  visibility: z.enum(["public", "private"]),
  allowTelegramMedia: z.boolean().default(false),
});

export const storyRunInput = z.object({
  storyBotId: z.number().int().positive(),
  selectedRole: requiredText("Selected role", 160),
  title: requiredText("Story title", 180).optional(),
});

export const storyMessageInput = z.object({
  storyRunId: z.number().int().positive(),
  content: requiredText("Message", 6_000),
});

export const integrationSettingsInput = z
  .object({
    grokApiKey: z.string().trim().min(12).max(1_000).optional(),
    grokModel: z.string().trim().min(3).max(80).optional(),
    telegramBotToken: z.string().trim().min(20).max(1_000).optional(),
  })
  .refine(input => Object.values(input).some(value => value !== undefined), {
    message: "Provide at least one setting to update.",
  });

export const followUpPreferenceInput = z.object({
  storyRunId: z.number().int().positive(),
  isOptedIn: z.boolean(),
  inactivityHours: z.number().int().min(24).max(24 * 30),
});

export type StoryBotInput = z.infer<typeof storyBotInput>;
