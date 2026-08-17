import { describe, expect, it } from "vitest";
import { getProductIdentity } from "./brandConfig";

describe("app identity endpoint configuration", () => {
  it("exposes the configured product title", () => {
    expect(getProductIdentity()).toEqual({ title: "گیپو" });
  });
});
