import { describe, expect, it } from "vitest";
import {
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
