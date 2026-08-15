import { hashTelegramLinkCode } from "./telegramIdentity";

export type PendingTelegramLink = {
  userId: number;
  linkCodeExpiresAt: Date | null;
};

export async function resolveTelegramStart(input: {
  code: string | undefined;
  telegramUserId: string;
  telegramChatId: string;
  now?: number;
  getPending: (hash: string) => Promise<PendingTelegramLink | undefined>;
  complete: (input: { userId: number; telegramUserId: string; telegramChatId: string }) => Promise<void>;
}) {
  if (!input.code) return { status: "missing" as const };
  const pending = await input.getPending(hashTelegramLinkCode(input.code));
  if (!pending || !pending.linkCodeExpiresAt || pending.linkCodeExpiresAt.getTime() < (input.now ?? Date.now())) {
    return { status: "invalid" as const };
  }
  await input.complete({ userId: pending.userId, telegramUserId: input.telegramUserId, telegramChatId: input.telegramChatId });
  return { status: "linked" as const, userId: pending.userId };
}
