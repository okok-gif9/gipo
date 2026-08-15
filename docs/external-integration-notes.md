# External Integration Notes

## xAI / Grok

The integration uses xAI's OpenAI-compatible Chat Completions endpoint at `https://api.x.ai/v1/chat/completions`, authenticated with a bearer API key. The web chat uses Server-Sent Events by submitting `stream: true`; streamed payloads contain text deltas and end with a `[DONE]` frame. A separate structured-output request updates story state and validates whether a story has genuinely ended. xAI documents `response_format.type = "json_schema"` for schema-constrained JSON results.

Sources: [xAI Quickstart](https://docs.x.ai/developers/quickstart), [Chat API reference](https://docs.x.ai/developers/rest-api-reference/inference/chat), [Streaming](https://docs.x.ai/developers/model-capabilities/text/streaming), and [Structured Outputs](https://docs.x.ai/developers/model-capabilities/text/structured-outputs).

## Telegram Bot API

Telegram delivers bot updates through a configured HTTPS webhook via `setWebhook`. Each webhook request can carry the configured `X-Telegram-Bot-Api-Secret-Token` header, which the server verifies. Incoming update identifiers are persisted to make repeated deliveries idempotent. The application sends ordinary replies with `sendMessage` and can conditionally send a saved sticker file identifier or an HTTPS GIF with `sendSticker` / `sendAnimation`.

Sources: [Telegram Bot API](https://core.telegram.org/bots/api) and [Telegram webhook guide](https://core.telegram.org/bots/webhooks).
