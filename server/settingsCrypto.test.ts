import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("settings.encryptionHealth", () => {
  it("validates the configured server encryption secret through the internal API", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.settings.encryptionHealth()).resolves.toEqual({ configured: true });
  });
});
