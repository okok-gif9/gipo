import { describe, expect, it } from "vitest";

describe("GIPO reference-informed visual shell", () => {
  it("keeps the independent narrative shell and accessible motion safeguards in source", async () => {
    const fs = await import("node:fs/promises");
    const pagesApp = await fs.readFile(new URL("../client/src/pages/SupabasePagesApp.tsx", import.meta.url), "utf8");
    const styles = await fs.readFile(new URL("../client/src/index.css", import.meta.url), "utf8");
    const html = await fs.readFile(new URL("../client/index.html", import.meta.url), "utf8");
    const manifest = await fs.readFile(new URL("../client/public/site.webmanifest", import.meta.url), "utf8");

    expect(pagesApp).toContain("function GipoSideNav");
    expect(pagesApp).toContain("function GipoDashboard");
    expect(pagesApp).toContain("function GipoChat");
    expect(pagesApp).toContain("useReducedMotion");
    expect(pagesApp).toContain("whileTap={reduceMotion ? undefined");
    expect(pagesApp).not.toContain("Sparkles");
    expect(pagesApp).not.toContain("function AuthScreen({ onSignedIn");
    expect(pagesApp).not.toContain("onSignedIn={() => void supabase?.auth.getSession()");
    expect(styles).toContain(".gipo-side-nav");
    expect(styles).toContain(".gipo-mobile-nav");
    expect(styles).toContain("prefers-reduced-motion");
    expect(html).toContain("gipo-open-frame-favicon_76319d8c.svg");
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('rel="manifest"');
    expect(manifest).toContain("gipo-open-frame-favicon_76319d8c.svg");
  });
});
