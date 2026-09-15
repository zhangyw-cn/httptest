import { describe, expect, it } from "vitest";
import { newEnvPair } from "./env";
import {
  hostPairsToMappings,
  HOSTS_CREATE_BLOCKED_LIST_ERROR,
  hostsNameError,
  hostsAPIError,
  hostsNewBlockedReason,
  validateHostMappings,
  hostsRowStates,
  parseHostsContent,
  validateHostsFile,
} from "./hosts";

describe("hostsNewBlockedReason", () => {
  it("blocks create when list load failed", () => {
    expect(hostsNewBlockedReason("无法加载 Hosts 列表")).toBe(
      HOSTS_CREATE_BLOCKED_LIST_ERROR,
    );
    expect(hostsNewBlockedReason(null)).toBeNull();
    expect(hostsNewBlockedReason(null, true)).toBe("请等待 Hosts 保存完成");
  });
});

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

describe("parseHostsContent", () => {
  it("expands aliases and strips comments", () => {
    const r = parseHostsContent("10.0.0.5 api.example.com api # x\n");
    expect(r).toEqual({
      ok: true,
      mappings: { "api.example.com": "10.0.0.5", api: "10.0.0.5" },
    });
  });

  it("rejects duplicates case-insensitively", () => {
    const r = parseHostsContent("1.1.1.1 a.com\n2.2.2.2 A.COM");
    expect(r.ok).toBe(false);
  });
});

describe("validateHostsFile", () => {
  it("rejects cross fields", () => {
    expect(
      validateHostsFile({
        type: "map",
        mappings: { "a.com": "1.1.1.1" },
        content: "nope",
      }),
    ).toBeTruthy();
  });
});

describe("hostsAPIError", () => {
  it("maps known errors", () => {
    expect(hostsAPIError("hosts exists")).toBe("已有同名 Hosts");
    expect(hostsAPIError("same hosts name")).toBe("不能改成当前名称");
    expect(hostsAPIError("hosts type immutable")).toBe("不能更改 Hosts 类型");
    expect(hostsAPIError("invalid hosts type")).toBe("Hosts 类型非法");
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
