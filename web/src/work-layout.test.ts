import { describe, expect, it } from "vitest";
import { workMode } from "./work-layout";

describe("workMode", () => {
  it("maps each LeftView to a workbench mode", () => {
    expect(workMode("settings")).toBe("settings");
    expect(workMode("environment")).toBe("environment");
    expect(workMode("override")).toBe("override");
    expect(workMode("collection")).toBe("request");
    expect(workMode("history")).toBe("request");
  });
});
