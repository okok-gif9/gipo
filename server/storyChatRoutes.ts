import type { Express, Request, Response } from "express";
import { z } from "zod";
import * as db from "./db";
import {
  buildStoryMessages,
  consumeGrokStream,
  GrokConfigurationError,
  requestGrokStream,
  resolveStoryState,
} from "./grokStoryProvider";
import { decryptSetting } from "./settingsCrypto";
import { sdk } from "./_core/sdk";

const bodySchema = z.object({ content: z.string().trim().min(1).max(6_000) });

export function isStoryRunActive(status: string) {
  return status === "active";
}

function sendEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function userFacingError(error: unknown) {
  if (error instanceof GrokConfigurationError) return error.message;
  if (error instanceof z.ZodError) return "Your message is invalid. Please adjust it and try again.";
  const message = error instanceof Error ? error.message : "Unable to continue the story.";
  if (/401|unauthorized|api key/i.test(message)) return "Your Grok API key was rejected. Update it in Settings and try again.";
  if (/429|rate limit|quota/i.test(message)) return "Grok is temporarily rate-limited. Please wait a moment and retry.";
  return "The story could not be continued right now. Your message was saved; please try again.";
}

export function registerStoryChatRoutes(app: Express) {
  app.post("/api/story-runs/:storyRunId/stream", async (req: Request, res: Response) => {
    const controller = new AbortController();
    let requestFinished = false;
    res.on("close", () => {
      if (!requestFinished) controller.abort();
    });

    try {
      const user = await sdk.authenticateRequest(req);
      const storyRunId = Number(req.params.storyRunId);
      if (!Number.isInteger(storyRunId) || storyRunId <= 0) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid story run." } });
      }
      const input = bodySchema.parse(req.body);
      const story = await db.getStoryRunForParticipant(user.id, storyRunId);
      if (!story) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Story run not found." } });
      if (!isStoryRunActive(story.run.status)) {
        return res.status(409).json({ error: { code: "STORY_ENDED", message: "This story has ended. Restart it to take a new path." } });
      }
      const settings = await db.getIntegrationSettings(user.id);
      const apiKey = settings?.grokApiKeyCiphertext ? decryptSetting(settings.grokApiKeyCiphertext) : undefined;
      const history = await db.listStoryMessages(storyRunId);
      const messages = buildStoryMessages({
        storyBot: story.storyBot,
        storyRun: story.run,
        messages: history,
        incomingMessage: input.content,
      });
      await db.appendStoryMessage({ storyRunId, role: "user", content: input.content, channel: "web" });

      res.status(200).set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.flushHeaders();
      sendEvent(res, "ready", { storyRunId });

      const stream = await requestGrokStream({
        apiKey: apiKey ?? "",
        model: settings?.grokModel ?? "grok-4.6",
        messages,
        signal: controller.signal,
      });
      const assistantReply = await consumeGrokStream(stream, delta => sendEvent(res, "delta", { delta }));
      await db.appendStoryMessage({ storyRunId, role: "assistant", content: assistantReply, channel: "web" });
      let resolution: Awaited<ReturnType<typeof resolveStoryState>> = {
        stateSummary: story.run.stateSummary,
        stateJson: story.run.stateJson,
        status: "active",
        endingTitle: null,
        endingText: null,
      };
      try {
        resolution = await resolveStoryState({
          apiKey: apiKey ?? "",
          model: settings?.grokModel ?? "grok-4.6",
          storyBot: story.storyBot,
          storyRun: story.run,
          assistantReply,
        });
        await db.updateStoryRunState({ storyRunId, ...resolution });
      } catch (stateError) {
        console.warn("[StoryStream] State resolution unavailable; reply has been preserved.", stateError);
      }
      sendEvent(res, "complete", { assistantReply, resolution });
      requestFinished = true;
      res.end();
    } catch (error) {
      if (controller.signal.aborted) return;
      if (!res.headersSent) {
        return res.status(500).json({ error: { code: "STORY_STREAM_ERROR", message: userFacingError(error) } });
      }
      sendEvent(res, "error", { message: userFacingError(error) });
      requestFinished = true;
      res.end();
    }
  });
}
