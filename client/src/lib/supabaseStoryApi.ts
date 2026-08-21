type StoryResolution = { stateSummary: string; stateJson: Record<string, unknown>; status: "active" | "ended"; endingTitle: string | null; endingText: string | null };
export type StoryTurnEvent =
  | { event: "ready"; data: { storyRunId: string } }
  | { event: "delta"; data: { delta: string } }
  | { event: "complete"; data: { assistantReply: string; resolution: StoryResolution } }
  | { event: "error"; data: { code: string; message: string } };

const projectUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const endpoint = (name: string) => {
  if (!projectUrl) throw new Error("Supabase is not configured.");
  return `${projectUrl}/functions/v1/${name}`;
};
const parseEvent = (frame: string): StoryTurnEvent | null => {
  const event = frame.match(/^event:\s*(.+)$/m)?.[1]; const raw = frame.match(/^data:\s*(.+)$/m)?.[1];
  if (!event || !raw) return null;
  try { return { event, data: JSON.parse(raw) } as StoryTurnEvent; } catch { return null; }
};
async function message(response: Response) {
  const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return body?.error?.message ?? "درخواست سرویس ناموفق بود.";
}
export async function streamStoryTurn(input: { accessToken: string; storyRunId: string; content: string; onEvent: (event: StoryTurnEvent) => void }) {
  const response = await fetch(endpoint("story-turn"), { method: "POST", headers: { Authorization: `Bearer ${input.accessToken}`, apikey: anonKey ?? "", "Content-Type": "application/json" }, body: JSON.stringify({ storyRunId: input.storyRunId, content: input.content }) });
  if (!response.ok || !response.body) throw new Error(await message(response));
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
  while (true) {
    const { value, done } = await reader.read(); buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const frames = buffer.split("\n\n"); buffer = frames.pop() ?? "";
    for (const frame of frames) { const event = parseEvent(frame); if (event) input.onEvent(event); }
    if (done) break;
  }
  const event = parseEvent(buffer); if (event) input.onEvent(event);
}
export async function saveGrokSettings(input: { accessToken: string; grokApiKey?: string; grokModel?: string; telegramBotToken?: string; telegramWebhookSecret?: string }) {
  const response = await fetch(endpoint("save-integrations"), { method: "POST", headers: { Authorization: `Bearer ${input.accessToken}`, apikey: anonKey ?? "", "Content-Type": "application/json" }, body: JSON.stringify({ grokApiKey: input.grokApiKey, grokModel: input.grokModel, telegramBotToken: input.telegramBotToken, telegramWebhookSecret: input.telegramWebhookSecret }) });
  if (!response.ok) throw new Error(await message(response));
  return response.json() as Promise<{ grokConfigured: boolean; grokModel: string; telegramConfigured?: boolean }>;
}

export async function manageAccountDeletion(input: { accessToken: string; action: "request_deletion" | "cancel_deletion"; confirmation?: string }) {
  const response = await fetch(endpoint("account-management"), {
    method: "POST",
    headers: { Authorization: `Bearer ${input.accessToken}`, apikey: anonKey ?? "", "Content-Type": "application/json" },
    body: JSON.stringify({ action: input.action, confirmation: input.confirmation }),
  });
  if (!response.ok) throw new Error(await message(response));
  return response.json() as Promise<{ status: "active" | "deletion_pending"; deletionEffectiveAt?: string }>;
}

export async function checkPublicHandle(handle: string) {
  const response = await fetch(endpoint("public-handle-availability"), {
    method: "POST",
    headers: { apikey: anonKey ?? "", "Content-Type": "application/json" },
    body: JSON.stringify({ handle }),
  });
  if (response.status === 422) return { available: false, reason: "INVALID_HANDLE" as const };
  if (!response.ok) throw new Error(await message(response));
  return response.json() as Promise<{ available: boolean }>;
}
