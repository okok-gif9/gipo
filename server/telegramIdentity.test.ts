import { describe, expect, it } from "vitest";
import { hashTelegramLinkCode } from "./telegramIdentity";

describe("hashTelegramLinkCode", () => {
  it("uses a stable, non-plaintext value for one-time Telegram linking", () => {
    const first = hashTelegramLinkCode("temporary-link-code");
    expect(first).toHaveLength(64);
    expect(first).toBe(hashTelegramLinkCode("temporary-link-code"));
    expect(first).not.toContain("temporary-link-code");
    expect(first).not.toBe(hashTelegramLinkCode("a-different-code"));
  });
});
