import { describe, expect, it } from "vitest";
import { defaultDraft, normalizeRequest, parseHistoryResult } from "./request";
import { secretsJSON } from "./secrets";
import { buildRequestTree } from "./tree";

describe("normalizeRequest", () => {
  it("fills missing fields", () => {
    const n = normalizeRequest({} as ReturnType<typeof defaultDraft>);
    expect(n.method).toBe("GET");
    expect(n.query).toEqual({});
    expect(n.body).toEqual({ type: "none" });
  });
});

describe("parseHistoryResult", () => {
  it("parses JSON strings", () => {
    const r = parseHistoryResult('{"status":200,"timings":{"totalMs":1.5}}');
    expect(r.status).toBe(200);
    expect(r.timings.totalMs).toBe(1.5);
  });
});

describe("secretsJSON", () => {
  it("orders keys so Go map round-trips match", () => {
    expect(secretsJSON({ z: "1", a: "2" })).toBe(secretsJSON({ a: "2", z: "1" }));
  });
});

describe("buildRequestTree", () => {
  it("nests collection paths", () => {
    const tree = buildRequestTree([
      { path: "auth/login", name: "Login" },
      { path: "auth/logout", name: "Logout" },
      { path: "ping", name: "Ping" },
    ]);
    expect(tree.map((n) => n.name)).toEqual(["auth", "ping"]);
    expect(tree[0].path).toBeUndefined();
    expect(tree[0].children.map((c) => c.path)).toEqual([
      "auth/login",
      "auth/logout",
    ]);
    expect(tree[1].path).toBe("ping");
  });
});
