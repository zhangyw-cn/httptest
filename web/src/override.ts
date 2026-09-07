import { cleanEnvName } from "./env";
import type { DialogMode } from "./Dialog";

export function overrideNameError(
  name: string,
  existing: string[],
): string | null {
  const cleaned = cleanEnvName(name);
  if (cleaned === null) return name.trim() ? "名称非法" : "名称不能为空";
  if (cleaned.includes("/")) return "名称不能含 /";
  if (existing.includes(cleaned)) return "已有同名覆盖";
  return null;
}

export function overrideAPIError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("same override name")) return "不能改成当前名称";
  if (lower.includes("override exists")) return "已有同名覆盖";
  if (
    lower.includes("no such file") ||
    lower.includes("not found") ||
    /\b404\b/.test(lower)
  ) {
    return "覆盖不存在";
  }
  return message;
}

export function overrideDeleteDialog(
  name: string,
  isActive: boolean,
): DialogMode {
  return {
    kind: "confirm",
    title: "删除覆盖",
    body: isActive
      ? `删除 ${name}？此操作会从磁盘去掉该文件。顶栏当前覆盖将变为未选择。`
      : `删除 ${name}？此操作会从磁盘去掉该文件。`,
    submitLabel: "删除",
    error: null,
    path: name,
    subject: "override",
  };
}

export function overrideRenameConfirmDialog(
  name: string,
  next: string,
): DialogMode {
  return {
    kind: "confirm",
    title: "重命名当前发送覆盖",
    body: `将当前发送覆盖 ${name} 重命名为 ${next}？顶栏当前覆盖也会更新。`,
    submitLabel: "重命名",
    error: null,
    path: name,
    next,
    subject: "override",
  };
}
