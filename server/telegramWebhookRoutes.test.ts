import { describe, expect, it } from "vitest";
import { isValidTelegramWebhookSecret } from "./telegramWebhookRoutes";

describe("isValidTelegramWebhookSecret", () => {
  it("accepts the configured Telegram webhook secret only", () => {
    expect(isValidTelegramWebhookSecret("secret-123", "secret-123")).toBe(true);
    expect(isValidTelegramWebhookSecret("secret-124", "secret-123")).toBe(false);
    expect(isValidTelegramWebhookSecret(undefined, "secret-123")).toBe(false);
  });
});
