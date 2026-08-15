import { describe, expect, it } from "vitest";
import { extractTelegramMediaDirective } from "./telegramProvider";

describe("extractTelegramMediaDirective", () => {
  it("removes an approved media directive from the visible story reply", () => {
    expect(extractTelegramMediaDirective("I found it. [[TELEGRAM_MEDIA:gif:https://example.test/scene.gif]]")).toEqual({
      text: "I found it.",
      media: { kind: "gif", reference: "https://example.test/scene.gif" },
    });
  });

  it("leaves ordinary narrative text unchanged", () => {
    expect(extractTelegramMediaDirective("The bell rings twice.")).toEqual({ text: "The bell rings twice.", media: null });
  });

  it("removes unsafe media references instead of sending them", () => {
    expect(extractTelegramMediaDirective("A signal arrives. [[TELEGRAM_MEDIA:gif:not-a-url]]")).toEqual({ text: "A signal arrives.", media: null });
  });
});
