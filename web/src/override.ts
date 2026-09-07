import { cleanEnvName } from "./env";

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
