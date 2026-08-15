import { describe, expect, it } from "vitest";
import { storyBotInput } from "./storySchemas";

const validBot = {
  name: "Aster",
  description: "A navigator",
  behavioralInstruction: "Speak calmly.",
  storyPremise: "Cross the nebula.",
  roleOptions: ["Captain"],
  worldRules: "Respect the map.",
  endingConditions: "Reach a harbor or lose the ship.",
  visibility: "private" as const,
};

describe("storyBotInput", () => {
  it("accepts a complete, ending-aware story bot configuration", () => {
    expect(storyBotInput.parse(validBot)).toMatchObject({ allowTelegramMedia: false, avatarSymbol: "✦" });
  });

  it("rejects a world without a selectable player role", () => {
    expect(() => storyBotInput.parse({ ...validBot, roleOptions: [] })).toThrow(/Too small: expected array/);
  });
});
