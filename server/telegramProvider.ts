import { z } from "zod";

const telegramResultSchema = z.object({ ok: z.boolean(), description: z.string().optional() });

async function telegramRequest(token: string, method: string, body: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = telegramResultSchema.safeParse(await response.json().catch(() => ({})));
  if (!response.ok || !parsed.success || !parsed.data.ok) throw new Error(parsed.success ? parsed.data.description ?? "Telegram request failed." : "Telegram response was invalid.");
}

export async function setTelegramWebhook(input: { token: string; url: string; secretToken: string }) {
  await telegramRequest(input.token, "setWebhook", {
    url: input.url,
    secret_token: input.secretToken,
    allowed_updates: ["message"],
  });
}

export async function sendTelegramText(token: string, chatId: string, text: string) {
  await telegramRequest(token, "sendMessage", { chat_id: chatId, text: text.slice(0, 4_000) });
}

export async function sendTelegramMedia(input: { token: string; chatId: string; kind: "sticker" | "gif"; reference: string }) {
  await telegramRequest(input.token, input.kind === "sticker" ? "sendSticker" : "sendAnimation", {
    chat_id: input.chatId,
    [input.kind === "sticker" ? "sticker" : "animation"]: input.reference,
  });
}

export function extractTelegramMediaDirective(text: string) {
  const match = text.match(/\[\[TELEGRAM_MEDIA:(sticker|gif):([^\]\n]+)\]\]/);
  if (!match) return { text, media: null };
  const kind = match[1] as "sticker" | "gif";
  const reference = match[2].trim();
  const isValid = kind === "gif"
    ? /^https:\/\/[^\s]+$/i.test(reference)
    : /^[A-Za-z0-9_:-]{8,}$/.test(reference);
  return {
    text: text.replace(match[0], "").trim(),
    media: isValid ? { kind, reference } : null,
  };
}
