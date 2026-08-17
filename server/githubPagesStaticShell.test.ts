import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const readProjectFile = (relativePath: string) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

describe("GitHub Pages static deployment", () => {
  it("selects the Supabase shell only for the static deployment target", () => {
    const app = readProjectFile("client/src/App.tsx");
    expect(app).toContain('VITE_DEPLOY_TARGET === "github-pages"');
    expect(app).toContain("<SupabasePagesApp />");
  });

  it("builds with the repository base path and injects Supabase configuration from Actions secrets", () => {
    const workflow = readProjectFile(".github/workflows/pages.yml");
    expect(workflow).toContain("VITE_BASE_PATH: /gipo/");
    expect(workflow).toContain("VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}");
    expect(workflow).toContain("VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}");
    expect(workflow).toContain("actions/deploy-pages@v4");
  });
});
