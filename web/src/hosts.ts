import { cleanEnvName, type EnvPair } from "./env";
import type { DialogMode } from "./Dialog";

export function hostsNameError(name: string, existing: string[]): string | null {
  const cleaned = cleanEnvName(name);
  if (cleaned === null) return name.trim() ? "名称非法" : "名称不能为空";
  if (cleaned.includes("/")) return "名称不能含 /";
  if (existing.includes(cleaned)) return "已有同名 Hosts";
  return null;
}

/** Convert editor rows to mappings; reject duplicate hosts before map merge. */
export function hostPairsToMappings(
  pairs: EnvPair[],
): { ok: true; mappings: Record<string, string> } | { ok: false; error: string } {
  const mappings = Object.create(null) as Record<string, string>;
  const seen = new Map<string, true>();
  for (const p of pairs) {
    const host = p.key.trim().toLowerCase();
    const ip = p.value.trim();
    if (!host && !ip) continue;
    if (!host || !ip) {
      return { ok: false, error: "主机名与 IP 不能为空" };
    }
    if (host.includes("://") || host.includes("/") || host.includes(":")) {
      return { ok: false, error: "主机名非法（不能含 ://、/ 或 :）" };
    }
    if (!isIPLiteral(ip)) {
      return { ok: false, error: "IP 非法（须为 IPv4 或 IPv6 字面量）" };
    }
    if (seen.has(host)) {
      return { ok: false, error: "主机名重复（大小写不敏感）" };
    }
    seen.set(host, true);
    mappings[host] = ip;
  }
  return { ok: true, mappings };
}

export function validateHostMappings(
  mappings: Record<string, string>,
): string | null {
  const result = hostPairsToMappings(
    Object.entries(mappings).map(([key, value]) => ({
      id: 0,
      key,
      value,
    })),
  );
  return result.ok ? null : result.error;
}

/** Align with Go net.ParseIP: IPv4 dotted decimal or IPv6 (incl. ::ffff:x.x.x.x). */
function isIPLiteral(ip: string): boolean {
  const trimmed = ip.trim();
  if (!trimmed) return false;
  if (trimmed.includes(":")) {
    try {
      // Bracket form required for URL hostname parsing of IPv6.
      const u = new URL(`http://[${trimmed}]/`);
      return Boolean(u.hostname);
    } catch {
      return false;
    }
  }
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) return false;
  return trimmed.split(".").every((p) => {
    const n = Number(p);
    return n >= 0 && n <= 255;
  });
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
