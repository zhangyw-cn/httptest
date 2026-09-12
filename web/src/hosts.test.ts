import { describe, expect, it } from "vitest";
import { newEnvPair } from "./env";
import {
  hostPairsToMappings,
  hostsNameError,
  hostsAPIError,
  validateHostMappings,
  hostsRowStates,
} from "./hosts";

describe("hostsNameError", () => {
  it("rejects slash and duplicates", () => {
    expect(hostsNameError("a/b", [])).toBe("名称不能含 /");
    expect(hostsNameError("lan", ["lan"])).toBe("已有同名 Hosts");
    expect(hostsNameError("lan", [])).toBeNull();
  });
});

describe("validateHostMappings", () => {
  it("rejects empty, bad host, bad ip, duplicates", () => {
    expect(validateHostMappings({ "": "1.1.1.1" })).toMatch(/空/);
    expect(validateHostMappings({ "a/b": "1.1.1.1" })).toMatch(/主机名/);
    expect(validateHostMappings({ "a.com": "x" })).toMatch(/IP/);
    expect(
      validateHostMappings({ "A.com": "1.1.1.1", "a.com": "2.2.2.2" }),
    ).toMatch(/重复/);
    expect(validateHostMappings({ "api.example.com": "10.0.0.5" })).toBeNull();
  });

  it("accepts IPv6 forms ParseIP would accept and rejects junk", () => {
    expect(validateHostMappings({ "a.com": "2001:db8::1" })).toBeNull();
    expect(validateHostMappings({ "a.com": "::ffff:127.0.0.1" })).toBeNull();
    expect(validateHostMappings({ "a.com": ":::" })).toMatch(/IP/);
  });
});

describe("hostPairsToMappings", () => {
  it("rejects duplicate hosts across editor rows before map merge", () => {
    const result = hostPairsToMappings([
      newEnvPair("Foo.com", "1.1.1.1"),
      newEnvPair("foo.com", "2.2.2.2"),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/重复/);
  });

  it("normalizes keys on success", () => {
    const result = hostPairsToMappings([
      newEnvPair("API.Example.COM", "10.0.0.5"),
    ]);
    expect(result).toEqual({
      ok: true,
      mappings: { "api.example.com": "10.0.0.5" },
    });
  });
});

describe("hostsAPIError", () => {
  it("maps known errors", () => {
    expect(hostsAPIError("hosts exists")).toBe("已有同名 Hosts");
    expect(hostsAPIError("same hosts name")).toBe("不能改成当前名称");
  });
});

describe("hostsRowStates", () => {
  it("separates send badge from editing selection", () => {
    expect(hostsRowStates(["lan", "lab"], "lan", "lab")).toEqual([
      { name: "lan", itemClassName: "req-item", showSendBadge: true },
      { name: "lab", itemClassName: "req-item active", showSendBadge: false },
    ]);
  });
});
