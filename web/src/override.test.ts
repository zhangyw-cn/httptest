import { describe, expect, it } from "vitest";
import {
  overrideAPIError,
  overrideDeleteDialog,
  overrideNameError,
  overrideRenameConfirmDialog,
} from "./override";

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

describe("override confirmation dialogs", () => {
  it("marks deletion as an override operation and warns for the active row", () => {
    expect(overrideDeleteDialog("default", true)).toEqual({
      kind: "confirm",
      title: "删除覆盖",
      body:
        "删除 default？此操作会从磁盘去掉该文件。顶栏当前覆盖将变为未选择。",
      submitLabel: "删除",
      error: null,
      path: "default",
      subject: "override",
    });
  });

  it("carries both names through active override rename confirmation", () => {
    expect(overrideRenameConfirmDialog("default", "debug")).toEqual({
      kind: "confirm",
      title: "重命名当前发送覆盖",
      body:
        "将当前发送覆盖 default 重命名为 debug？顶栏当前覆盖也会更新。",
      submitLabel: "重命名",
      error: null,
      path: "default",
      next: "debug",
      subject: "override",
    });
  });
});
