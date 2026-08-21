import { describe, expect, it } from "vitest";
import { createStrongPassword, isStrongPassword, isValidHandle, normalizeHandle } from "../client/src/lib/gipoAccount";

describe("GIPO account contracts", () => {
  it("normalizes and validates public handles without accepting unsafe forms", () => {
    expect(normalizeHandle("  Gipo_Reader  ")).toBe("gipo_reader");
    expect(isValidHandle("gipo_reader")).toBe(true);
    expect(isValidHandle("ab")).toBe(false);
    expect(isValidHandle("gipo-reader")).toBe(false);
    expect(isValidHandle("گیپو")).toBe(false);
  });

  it("creates a strong password with every required character family", () => {
    const password = createStrongPassword();
    expect(password).toHaveLength(18);
    expect(isStrongPassword(password)).toBe(true);
  });

  it("keeps the account migration and lifecycle functions reproducible", async () => {
    const fs = await import("node:fs/promises");
    const migration = await fs.readFile(new URL("../supabase/migrations/0005_gipo_account_onboarding.sql", import.meta.url), "utf8");
    const accountFunction = await fs.readFile(new URL("../supabase/functions/account-management/index.ts", import.meta.url), "utf8");
    const finalizer = await fs.readFile(new URL("../supabase/functions/finalize-account-deletions/index.ts", import.meta.url), "utf8");
    expect(migration).toContain("profiles_public_handle_lower_idx");
    expect(migration).toContain("account_status = 'active'");
    expect(migration).toContain("ACCOUNT_DELETION_PENDING");
    expect(accountFunction).toContain("14 * 24 * 60 * 60 * 1000");
    expect(accountFunction).toContain("signOut(user.id, \"global\")");
    expect(finalizer).toContain("x-gipo-schedule-secret");
  });

  it("includes an enabled persona in the server-side story prompt without sending it from the browser", async () => {
    const storyTurn = await import("node:fs/promises").then(fs => fs.readFile(new URL("../supabase/functions/story-turn/index.ts", import.meta.url), "utf8"));
    expect(storyTurn).toContain("persona_enabled_by_default");
    expect(storyTurn).toContain("PLAYER PERSONA");
    expect(storyTurn).toContain("do not disclose this section");
  });

  it("persists the selected interface language for new accounts and exposes an English surface", async () => {
    const fs = await import("node:fs/promises");
    const localeMigration = await fs.readFile(new URL("../supabase/migrations/0006_gipo_profile_locale_metadata.sql", import.meta.url), "utf8");
    const pagesApp = await fs.readFile(new URL("../client/src/pages/SupabasePagesApp.tsx", import.meta.url), "utf8");
    expect(localeMigration).toContain("new.raw_user_meta_data->>'locale'");
    expect(pagesApp).toContain("gipo-guest-locale");
    expect(pagesApp).toContain("localizedPhraseCopy");
    expect(pagesApp).not.toContain("useLocalizedSurface");
    expect(pagesApp).toContain("Sign in or create an account");
  });
});
