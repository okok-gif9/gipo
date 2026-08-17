import { describe, expect, it } from "vitest";

describe("Supabase public configuration", () => {
  it("authenticates the public project key against the lightweight settings endpoint", async () => {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_ANON_KEY;
    expect(url).toBeTruthy();
    expect(key).toBeTruthy();

    const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key! } });
    expect(response.ok).toBe(true);
  });
});
