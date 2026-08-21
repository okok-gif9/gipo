export const telegramApi = async (token: string, method: string, payload: Record<string, unknown>) => {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null;
  if (!response.ok || !data?.ok) throw new Error(data?.description || "TELEGRAM_REQUEST_FAILED");
};
export const sendTelegramText = (token: string, chatId: string, text: string) => telegramApi(token, "sendMessage", { chat_id: chatId, text: text.slice(0, 4000) });
export const verifySecret = (received: string | null, expected: string) => {
  if (!received || received.length !== expected.length) return false;
  let mismatch = 0; for (let index = 0; index < expected.length; index += 1) mismatch |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  return mismatch === 0;
};
export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
