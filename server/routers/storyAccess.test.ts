import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canAccessStoryBot: vi.fn(),
  getStoryBotById: vi.fn(),
  getStoryRunForParticipant: vi.fn(),
  createStoryRun: vi.fn(),
  restartStoryRun: vi.fn(),
  archiveStoryRun: vi.fn(),
}));

vi.mock("../db", () => ({
  ...mocks,
  listStoryBotsForUser: vi.fn(),
  listPublicStoryBots: vi.fn(),
  createStoryBot: vi.fn(),
  updateOwnedStoryBot: vi.fn(),
  archiveOwnedStoryBot: vi.fn(),
  deleteOwnedStoryBot: vi.fn(),
  listStoryRuns: vi.fn(),
  listStoryMessages: vi.fn(),
}));

import { storyBotsRouter } from "./storyBots";
import { storyRunsRouter } from "./storyRuns";

const context = { user: { id: 7 } } as never;

describe("story access and lifecycle routers", () => {
  beforeEach(() => vi.resetAllMocks());

  it("does not disclose an inaccessible story bot", async () => {
    mocks.getStoryBotById.mockResolvedValue({ id: 8, ownerId: 99, visibility: "private", name: "Hidden archive" });
    mocks.canAccessStoryBot.mockResolvedValue(false);
    const caller = storyBotsRouter.createCaller(context);
    await expect(caller.get({ storyBotId: 8 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.getStoryBotById).not.toHaveBeenCalled();
  });

  it("returns an accessible public bot while keeping private access delegated to authorization", async () => {
    const storyBot = { id: 8, visibility: "public", name: "Aster" };
    mocks.canAccessStoryBot.mockResolvedValue(true);
    mocks.getStoryBotById.mockResolvedValue(storyBot);
    const caller = storyBotsRouter.createCaller(context);
    await expect(caller.get({ storyBotId: 8 })).resolves.toEqual(storyBot);
    expect(mocks.canAccessStoryBot).toHaveBeenCalledWith(7, 8);
  });

  it("returns an owned private bot when the ownership guard authorizes the caller", async () => {
    const ownedPrivateBot = { id: 8, ownerId: 7, visibility: "private", name: "My private archive" };
    mocks.canAccessStoryBot.mockResolvedValue(true);
    mocks.getStoryBotById.mockResolvedValue(ownedPrivateBot);
    const caller = storyBotsRouter.createCaller(context);
    await expect(caller.get({ storyBotId: 8 })).resolves.toEqual(ownedPrivateBot);
  });

  it("creates a run only after a participant selects an offered role", async () => {
    mocks.getStoryBotById.mockResolvedValue({ id: 8, name: "Aster", roleOptions: ["Captain"] });
    mocks.canAccessStoryBot.mockResolvedValue(true);
    mocks.createStoryRun.mockResolvedValue({ run: { id: 12 } });
    const caller = storyRunsRouter.createCaller(context);
    await expect(caller.create({ storyBotId: 8, selectedRole: "Intruder" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.create({ storyBotId: 8, selectedRole: "Captain" })).resolves.toEqual({ run: { id: 12 } });
    expect(mocks.createStoryRun).toHaveBeenCalledWith(7, { storyBotId: 8, selectedRole: "Captain", title: "Aster — Captain" });
  });

  it("restarts and archives only the participant's own story run", async () => {
    mocks.restartStoryRun.mockResolvedValue({ run: { id: 13 } });
    mocks.archiveStoryRun.mockResolvedValue(true);
    const caller = storyRunsRouter.createCaller(context);
    await expect(caller.restart({ storyRunId: 12 })).resolves.toEqual({ run: { id: 13 } });
    await expect(caller.archive({ storyRunId: 12 })).resolves.toEqual({ success: true });
    expect(mocks.restartStoryRun).toHaveBeenCalledWith(7, 12);
    expect(mocks.archiveStoryRun).toHaveBeenCalledWith(7, 12);
  });
});
