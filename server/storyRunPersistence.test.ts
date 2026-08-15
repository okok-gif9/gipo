import { describe, expect, it, vi } from "vitest";
import { persistStoryRunState } from "./storyRunPersistence";

describe("persistStoryRunState", () => {
  it("persists structured state, end transition, and activity timestamps against the selected run", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const now = new Date("2026-08-15T10:00:00.000Z");
    const condition = { runId: 12 };
    await persistStoryRunState({
      db: { update }, table: "story_runs", storyRunId: 12,
      changes: { stateSummary: "The bridge is secure.", stateJson: { ending: true }, status: "ended", endingTitle: "Safe harbor", endingText: "The crew returns home." },
      whereStoryRunId: id => ({ runId: id }), now,
    });
    expect(update).toHaveBeenCalledWith("story_runs");
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: "ended", endingTitle: "Safe harbor", stateJson: { ending: true }, updatedAt: now, lastInteractionAt: now }));
    expect(where).toHaveBeenCalledWith(condition);
  });
});
