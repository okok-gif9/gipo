import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { storyBotInput } from "../storySchemas";
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

const storyBotIdInput = z.object({ storyBotId: z.number().int().positive() });

export const storyBotsRouter = router({
  listAccessible: protectedProcedure.query(({ ctx }) => db.listStoryBotsForUser(ctx.user.id)),
  listPublic: protectedProcedure.query(() => db.listPublicStoryBots()),
  get: protectedProcedure.input(storyBotIdInput).query(async ({ ctx, input }) => {
    if (!(await db.canAccessStoryBot(ctx.user.id, input.storyBotId))) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Story bot not found." });
    }
    return db.getStoryBotById(input.storyBotId);
  }),
  create: protectedProcedure.input(storyBotInput).mutation(({ ctx, input }) => db.createStoryBot(ctx.user.id, input)),
  update: protectedProcedure
    .input(storyBotIdInput.extend({ changes: storyBotInput.partial() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await db.updateOwnedStoryBot(ctx.user.id, input.storyBotId, input.changes);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "You cannot edit this story bot." });
      return updated;
    }),
  archive: protectedProcedure.input(storyBotIdInput).mutation(async ({ ctx, input }) => {
    if (!(await db.archiveOwnedStoryBot(ctx.user.id, input.storyBotId))) {
      throw new TRPCError({ code: "NOT_FOUND", message: "You cannot delete this story bot." });
    }
    return { success: true } as const;
  }),
  delete: protectedProcedure.input(storyBotIdInput).mutation(async ({ ctx, input }) => {
    if (!(await db.deleteOwnedStoryBot(ctx.user.id, input.storyBotId))) {
      throw new TRPCError({ code: "NOT_FOUND", message: "You cannot delete this story bot." });
    }
    return { success: true } as const;
  }),
});
