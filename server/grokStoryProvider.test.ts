import { describe, expect, it } from "vitest";
import { buildStoryMessages } from "./grokStoryProvider";
import type { StoryBot, StoryMessage, StoryRun } from "../drizzle/schema";

const storyBot = {
  id: 1,
  ownerId: 1,
  name: "Aster",
  description: "A careful starship navigator.",
  avatarSymbol: "✦",
  behavioralInstruction: "Speak with calm precision.",
  storyPremise: "A ship must cross a collapsing nebula.",
  roleOptions: ["Captain"],
  worldRules: "The map is incomplete.",
  endingConditions: "Reach a safe harbor or lose the ship.",
  visibility: "private",
  allowTelegramMedia: false,
  isArchived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies StoryBot;

const storyRun = {
  id: 1,
  storyBotId: 1,
  participantId: 1,
  title: "Nebula run",
  selectedRole: "Captain",
  status: "active",
  stateSummary: "The bridge awaits a decision.",
  stateJson: { flags: [] },
  endingTitle: null,
  endingText: null,
  messageCount: 1,
  lastInteractionAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies StoryRun;

describe("buildStoryMessages", () => {
  it("injects character, role and state while retaining every previous conversation message", () => {
    const messages = [{ id: 1, storyRunId: 1, role: "user", content: "Set a course.", channel: "web", sequence: 1, mediaKind: "none", mediaReference: null, createdAt: new Date() }] satisfies StoryMessage[];
    const result = buildStoryMessages({ storyBot, storyRun, messages, incomingMessage: "Take us through the blue corridor." });

    expect(result[0]?.role).toBe("system");
    expect(result[0]?.content).toContain("PLAYER ROLE: Captain");
    expect(result).toHaveLength(3);
    expect(result[1]?.content).toBe("Set a course.");
    expect(result[2]?.content).toBe("Take us through the blue corridor.");
  });
});
