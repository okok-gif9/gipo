import { describe, expect, it } from "vitest";

describe("Supabase story-turn migration artifacts", () => {
  it("keeps an atomic append RPC in the migration", async () => {
    const migration = await import("node:fs/promises").then(fs => fs.readFile(new URL("../supabase/migrations/0002_gipo_story_turn.sql", import.meta.url), "utf8"));
    expect(migration).toContain("for update");
    expect(migration).toContain("append_story_message");
    expect(migration).toContain("story_messages_run_sequence_idx");
  });
});
