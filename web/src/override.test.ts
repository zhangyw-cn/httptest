import { describe, expect, it } from "vitest";
import { overrideAPIError, overrideNameError } from "./override";

describe("overrideNameError", () => {
  it("rejects empty, slash, and duplicates", () => {
    expect(overrideNameError("", [])).not.toBeNull();
    expect(overrideNameError("a/b", [])).not.toBeNull();
    expect(overrideNameError("default", ["default"])).toBe("已有同名覆盖");
    expect(overrideNameError("default", [])).toBeNull();
  });
});

describe("overrideAPIError", () => {
  it("maps sentinels", () => {
    expect(overrideAPIError("same override name")).toBe("不能改成当前名称");
    expect(overrideAPIError("override exists")).toBe("已有同名覆盖");
    expect(overrideAPIError("404: Not Found")).toBe("覆盖不存在");
  });
});
