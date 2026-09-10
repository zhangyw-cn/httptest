import { describe, expect, it } from "vitest";
import {
  normalizePrepared,
  prettyBody,
  rawCombinedDump,
  sizeLabel,
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
