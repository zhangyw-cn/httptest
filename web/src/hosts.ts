import { cleanEnvName } from "./env";
import type { DialogMode } from "./Dialog";

export function hostsNameError(name: string, existing: string[]): string | null {
  const cleaned = cleanEnvName(name);
  if (cleaned === null) return name.trim() ? "名称非法" : "名称不能为空";
  if (cleaned.includes("/")) return "名称不能含 /";
  if (existing.includes(cleaned)) return "已有同名 Hosts";
  return null;
}

export function validateHostMappings(
  mappings: Record<string, string>,
): string | null {
  const seen = new Map<string, string>();
  for (const [rawHost, rawIP] of Object.entries(mappings)) {
    const host = rawHost.trim().toLowerCase();
    const ip = rawIP.trim();
    if (!host || !ip) return "主机名与 IP 不能为空";
    if (host.includes("://") || host.includes("/") || host.includes(":")) {
      return "主机名非法（不能含 ://、/ 或 :）";
    }
    if (!isIPLiteral(ip)) return "IP 非法（须为 IPv4 或 IPv6 字面量）";
    if (seen.has(host)) return "主机名重复（大小写不敏感）";
    seen.set(host, ip);
  }
  return null;
}

function isIPLiteral(ip: string): boolean {
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    return ip.split(".").every((p) => {
      const n = Number(p);
      return n >= 0 && n <= 255;
    });
  }
  if (ip.includes(":")) {
    return /^[0-9a-fA-F:]+$/.test(ip);
  }
  return false;
}

export function hostsAPIError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("same hosts name")) return "不能改成当前名称";
  if (lower.includes("hosts exists")) return "已有同名 Hosts";
  if (
    lower.includes("no such file") ||
    lower.includes("not found") ||
    /\b404\b/.test(lower)
  ) {
    return "Hosts 不存在";
  }
  return message;
}

export interface HostsRowState {
  name: string;
  itemClassName: "req-item" | "req-item active";
  showSendBadge: boolean;
}

export function hostsRowStates(
  names: string[],
  activeHosts: string,
  editingHosts: string | null,
): HostsRowState[] {
  return names.map((name) => ({
    name,
    itemClassName: editingHosts === name ? "req-item active" : "req-item",
    showSendBadge: activeHosts === name,
  }));
}

export function hostsDeleteDialog(name: string, isActive: boolean): DialogMode {
  return {
    kind: "confirm",
    title: "删除 Hosts",
    body: isActive
      ? `删除 ${name}？此操作会从磁盘去掉该文件。顶栏当前 Hosts 将变为无。`
      : `删除 ${name}？此操作会从磁盘去掉该文件。`,
    submitLabel: "删除",
    error: null,
    path: name,
    subject: "hosts",
  };
}

export function hostsRenameConfirmDialog(
  name: string,
  next: string,
): DialogMode {
  return {
    kind: "confirm",
    title: "重命名当前发送 Hosts",
    body: `将当前发送 Hosts ${name} 重命名为 ${next}？顶栏当前 Hosts 也会更新。`,
    submitLabel: "重命名",
    error: null,
    path: name,
    next,
    subject: "hosts",
  };
}
