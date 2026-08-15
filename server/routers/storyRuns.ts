import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { storyRunInput } from "../storySchemas";
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

const runIdInput = z.object({ storyRunId: z.number().int().positive() });

export const storyRunsRouter = router({
  list: protectedProcedure.query(({ ctx }) => db.listStoryRuns(ctx.user.id)),
  get: protectedProcedure.input(runIdInput).query(async ({ ctx, input }) => {
    const storyRun = await db.getStoryRunForParticipant(ctx.user.id, input.storyRunId);
    if (!storyRun) throw new TRPCError({ code: "NOT_FOUND", message: "Story run not found." });
    const messages = await db.listStoryMessages(input.storyRunId);
    return { ...storyRun, messages };
  }),
  create: protectedProcedure.input(storyRunInput).mutation(async ({ ctx, input }) => {
    const storyBot = await db.getStoryBotById(input.storyBotId);
    if (!storyBot || !(await db.canAccessStoryBot(ctx.user.id, input.storyBotId))) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Story bot not found." });
    }
    if (!storyBot.roleOptions.includes(input.selectedRole)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Choose one of this story's available roles." });
    }
    const title = input.title ?? `${storyBot.name} — ${input.selectedRole}`;
    return db.createStoryRun(ctx.user.id, { ...input, title });
  }),
  restart: protectedProcedure.input(runIdInput).mutation(async ({ ctx, input }) => {
    const restarted = await db.restartStoryRun(ctx.user.id, input.storyRunId);
    if (!restarted) throw new TRPCError({ code: "NOT_FOUND", message: "Story run not found." });
    return restarted;
  }),
  archive: protectedProcedure.input(runIdInput).mutation(async ({ ctx, input }) => {
    if (!(await db.archiveStoryRun(ctx.user.id, input.storyRunId))) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Story run not found." });
    }
    return { success: true } as const;
  }),
});
