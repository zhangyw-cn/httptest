import { describe, expect, it } from "vitest";
import {
  applyEnvSaveResult,
  envNameError,
  isEnvDirty,
  openEnvForEdit,
  pairsToVars,
  varsJSON,
  varsToPairs,
} from "./env";

describe("pairs", () => {
  it("drops empty keys and lets later duplicate win", () => {
    const vars = pairsToVars([
      { id: 1, key: "a", value: "1" },
      { id: 2, key: "", value: "x" },
      { id: 3, key: "a", value: "2" },
    ]);
    expect(vars).toEqual({ a: "2" });
  });

  it("keeps __proto__ keys in objects and JSON", () => {
    const vars = pairsToVars([
      { id: 1, key: "__proto__", value: "kept" },
    ]);
    expect(Object.prototype.hasOwnProperty.call(vars, "__proto__")).toBe(true);
    expect(vars["__proto__"]).toBe("kept");
    const parsed = JSON.parse(varsJSON(vars)) as Record<string, string>;
    expect(Object.prototype.hasOwnProperty.call(parsed, "__proto__")).toBe(true);
    expect(parsed["__proto__"]).toBe("kept");
  });

  it("uses one blank row when empty", () => {
    const pairs = varsToPairs({});
    expect(pairs).toHaveLength(1);
    expect(pairs[0].key).toBe("");
    expect(pairs[0].value).toBe("");
  });
});

describe("isEnvDirty", () => {
  it("is dirty after changing a value and clean after matching snapshot", () => {
    const env = { name: "local", variables: { baseUrl: "http://h" } };
    const opened = openEnvForEdit(env);
    expect(isEnvDirty(opened.pairs, opened.snapshot)).toBe(false);
    const dirtyPairs = opened.pairs.map((p) =>
      p.key === "baseUrl" ? { ...p, value: "http://other" } : p,
    );
    expect(isEnvDirty(dirtyPairs, opened.snapshot)).toBe(true);
    const saved = varsJSON(pairsToVars(dirtyPairs));
    expect(isEnvDirty(dirtyPairs, saved)).toBe(false);
  });
});

describe("envNameError", () => {
  it("rejects empty, slash, and existing names", () => {
    expect(envNameError("", ["local"])).not.toBeNull();
    expect(envNameError("a/b", [])).not.toBeNull();
    expect(envNameError("local", ["local"])).not.toBeNull();
    expect(envNameError("dev", ["local"])).toBeNull();
  });

  it("matches CleanRel environment-name rules", () => {
    expect(envNameError("C:", [])).not.toBeNull();
    expect(envNameError("C:/temp", [])).not.toBeNull();
    expect(envNameError("/temp", [])).not.toBeNull();
    expect(envNameError(".", [])).not.toBeNull();
    expect(envNameError("../temp", [])).not.toBeNull();
    expect(envNameError("..foo", [])).toBeNull();
    expect(envNameError("a/b", [])).not.toBeNull();
    expect(envNameError("a\\b", [])).not.toBeNull();
    expect(envNameError("a/../dev", ["dev"])).not.toBeNull();
    expect(envNameError("a/../dev", [])).not.toBeNull();
    expect(envNameError("./local", [])).not.toBeNull();
  });
});

describe("applyEnvSaveResult", () => {
  const saved = { name: "local", variables: { k: "v" } };

  it("ignores when the user switched environments", () => {
    expect(
      applyEnvSaveResult({
        savedName: "local",
        editingName: "prod",
        epochAtStart: 1,
        epochNow: 1,
        currentPairs: varsToPairs({ k: "v" }),
        saved,
      }).action,
    ).toBe("ignore");
  });

  it("reloads when epoch is unchanged", () => {
    const got = applyEnvSaveResult({
      savedName: "local",
      editingName: "local",
      epochAtStart: 2,
      epochNow: 2,
      currentPairs: varsToPairs({ k: "v" }),
      saved,
    });
    expect(got).toEqual({ action: "reload", env: saved });
  });

  it("keeps current pairs and marks dirty when edited during save", () => {
    const currentPairs = varsToPairs({ k: "newer" });
    const got = applyEnvSaveResult({
      savedName: "local",
      editingName: "local",
      epochAtStart: 1,
      epochNow: 2,
      currentPairs,
      saved,
    });
    expect(got.action).toBe("keep");
    if (got.action !== "keep") return;
    expect(got.dirty).toBe(true);
    expect(got.snapshot).toBe(varsJSON(saved.variables));
  });
});
