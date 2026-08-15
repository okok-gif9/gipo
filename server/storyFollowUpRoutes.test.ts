import { describe, expect, it } from "vitest";
import { shouldSendFollowUp } from "./storyFollowUpRoutes";

describe("shouldSendFollowUp", () => {
  const now = Date.UTC(2026, 0, 2, 12);
  it("sends only for an opted-in inactive run without a newer follow-up", () => {
    expect(shouldSendFollowUp({ isOptedIn: true, inactivityHours: 24, lastInteractionAt: new Date(now - 25 * 60 * 60 * 1000), lastFollowUpAt: null, now })).toBe(true);
    expect(shouldSendFollowUp({ isOptedIn: false, inactivityHours: 24, lastInteractionAt: new Date(now - 25 * 60 * 60 * 1000), lastFollowUpAt: null, now })).toBe(false);
    expect(shouldSendFollowUp({ isOptedIn: true, inactivityHours: 24, lastInteractionAt: new Date(now - 2 * 60 * 60 * 1000), lastFollowUpAt: null, now })).toBe(false);
    expect(shouldSendFollowUp({ isOptedIn: true, inactivityHours: 24, lastInteractionAt: new Date(now - 25 * 60 * 60 * 1000), lastFollowUpAt: new Date(now - 20 * 60 * 60 * 1000), now })).toBe(false);
  });
});
