import { describe, expect, it } from "vitest";
import { methodClass } from "./method";
import {
  defaultResultTabs,
  msLabel,
  normalizePrepared,
  prettyBody,
  rawCombinedDump,
  sizeLabel,
  tabsAfterResultChange,
} from "./result-pane";

describe("normalizePrepared", () => {
  it("returns empty request when prepared is missing", () => {
    expect(normalizePrepared(undefined)).toEqual({
      name: "",
      method: "",
      url: "",
      query: {},
      headers: {},
      body: { type: "none" },
    });
    expect(normalizePrepared(null)).toEqual({
      name: "",
      method: "",
      url: "",
      query: {},
      headers: {},
      body: { type: "none" },
    });
  });

  it("fills missing fields on a partial prepared object", () => {
    expect(
      normalizePrepared({
        name: "x",
        method: "POST",
        url: "https://ex/{{id}}",
      } as never),
    ).toEqual({
      name: "x",
      method: "POST",
      url: "https://ex/{{id}}",
      query: {},
      headers: {},
      body: { type: "none" },
    });
  });
});

describe("rawCombinedDump", () => {
  it("joins dumps with separator", () => {
    expect(rawCombinedDump("REQ", "RES")).toBe("REQ\n\n----------\n\nRES");
  });

  it("uses 无 for empty sides", () => {
    expect(rawCombinedDump("", "")).toBe("无\n\n----------\n\n无");
    expect(rawCombinedDump(undefined, "RES")).toBe("无\n\n----------\n\nRES");
  });
});

describe("sizeLabel / prettyBody", () => {
  it("formats bytes", () => {
    expect(sizeLabel(12)).toBe("12 B");
    expect(sizeLabel(2048)).toBe("2.0 KB");
  });

  it("pretty-prints JSON and leaves plain text", () => {
    expect(prettyBody('{"a":1}')).toContain("\n");
    expect(prettyBody("not-json")).toBe("not-json");
  });
});

describe("msLabel", () => {
  it("keeps two decimals for sub-10 non-integers", () => {
    expect(msLabel(1.5)).toBe("1.50");
  });
});

describe("tabsAfterResultChange", () => {
  it("keeps previous tabs when result changes", () => {
    const prev = {
      primary: "request" as const,
      requestTab: "query" as const,
      responseTab: "headers" as const,
    };
    expect(tabsAfterResultChange(prev, { status: 500 })).toEqual(prev);
    expect(tabsAfterResultChange(prev, null)).toEqual(prev);
  });

  it("defaultResultTabs match first-result defaults", () => {
    expect(defaultResultTabs()).toEqual({
      primary: "response",
      requestTab: "overview",
      responseTab: "body",
    });
  });
});

describe("methodClass", () => {
  it("maps known methods and falls back to muted", () => {
    expect(methodClass("POST")).toBe("post");
    expect(methodClass("")).toBe("muted");
  });
});
