import { describe, expect, it, vi } from "vitest";
import { resolveTelegramStart } from "./telegramLinking";

describe("resolveTelegramStart", () => {
  it("links a valid unexpired code to the incoming Telegram identity", async () => {
    const complete = vi.fn().mockResolvedValue(undefined);
    const result = await resolveTelegramStart({
      code: "short-lived-code", telegramUserId: "551", telegramChatId: "889", now: 1_000,
      getPending: vi.fn().mockResolvedValue({ userId: 9, linkCodeExpiresAt: new Date(1_001) }), complete,
    });
    expect(result).toEqual({ status: "linked", userId: 9 });
    expect(complete).toHaveBeenCalledWith({ userId: 9, telegramUserId: "551", telegramChatId: "889" });
  });

  it("rejects missing, unknown, and expired codes without linking", async () => {
    const complete = vi.fn();
    const getPending = vi.fn().mockResolvedValue(undefined);
    await expect(resolveTelegramStart({ code: undefined, telegramUserId: "1", telegramChatId: "2", getPending, complete })).resolves.toEqual({ status: "missing" });
    await expect(resolveTelegramStart({ code: "unknown", telegramUserId: "1", telegramChatId: "2", getPending, complete })).resolves.toEqual({ status: "invalid" });
    await expect(resolveTelegramStart({ code: "expired", telegramUserId: "1", telegramChatId: "2", now: 1_000, getPending: vi.fn().mockResolvedValue({ userId: 3, linkCodeExpiresAt: new Date(999) }), complete })).resolves.toEqual({ status: "invalid" });
    expect(complete).not.toHaveBeenCalled();
  });
});
