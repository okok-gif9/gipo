import { describe, expect, it } from "vitest";

describe("Supabase story-turn migration artifacts", () => {
  it("keeps an atomic append RPC in the migration", async () => {
    const migration = await import("node:fs/promises").then(fs => fs.readFile(new URL("../supabase/migrations/0002_gipo_story_turn.sql", import.meta.url), "utf8"));
    expect(migration).toContain("for update");
    expect(migration).toContain("append_story_message");
    expect(migration).toContain("story_messages_run_sequence_idx");
  });

  it("keeps reproducible Edge Function source outside the browser deployment", async () => {
    const fs = await import("node:fs/promises");
    const storyTurn = await fs.readFile(new URL("../supabase/functions/story-turn/index.ts", import.meta.url), "utf8");
    const settings = await fs.readFile(new URL("../supabase/functions/save-integrations/index.ts", import.meta.url), "utf8");
    expect(storyTurn).toContain("append_story_message");
    expect(storyTurn).toContain("api.x.ai/v1/chat/completions");
    expect(settings).toContain("encryptSetting");
  });
});
