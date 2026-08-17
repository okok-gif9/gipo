import { describe, expect, it } from "vitest";
import { productIdentity } from "../client/src/lib/productIdentity";

describe("shared product identity", () => {
  it("keeps the visible گیپو name and release marker configured", () => {
    expect(productIdentity.name).toBe("گیپو");
    expect(productIdentity.release).toBe("GIPO-2026.08.17");
  });
});
