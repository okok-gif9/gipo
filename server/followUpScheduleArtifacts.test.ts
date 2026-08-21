import { describe, expect, it } from "vitest";

describe("GIPO follow-up scheduler artifacts", () => {
  it("keeps the scheduler reproducible and consent-gated", async () => {
    const fs = await import("node:fs/promises");
    const migration = await fs.readFile(new URL("../supabase/migrations/0004_gipo_followup_schedule.sql", import.meta.url), "utf8");
    const dispatcher = await fs.readFile(new URL("../supabase/functions/follow-up-dispatch/index.ts", import.meta.url), "utf8");

    expect(migration).toContain("create extension if not exists pg_cron");
    expect(migration).toContain("create extension if not exists pg_net with schema extensions");
    expect(migration).toContain("gipo-follow-up-dispatch");
    expect(migration).toContain("*/30 * * * *");
    expect(migration).toContain("x-gipo-schedule-secret");
    expect(dispatcher).toContain("claim_due_follow_ups");
    expect(dispatcher).toContain("x-gipo-schedule-secret");
  });
});
