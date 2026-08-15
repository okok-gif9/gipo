import { describe, expect, it } from "vitest";
import { isStoryRunActive } from "./storyChatRoutes";

describe("isStoryRunActive", () => {
  it("allows messages only for active story runs", () => {
    expect(isStoryRunActive("active")).toBe(true);
    expect(isStoryRunActive("ended")).toBe(false);
    expect(isStoryRunActive("archived")).toBe(false);
  });
});
