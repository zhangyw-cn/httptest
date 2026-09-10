import type { HttpRequest } from "./types";

export function normalizePrepared(
  prepared: HttpRequest | null | undefined,
): HttpRequest {
  if (!prepared) {
    return {
      name: "",
      method: "",
      url: "",
      query: {},
      headers: {},
      body: { type: "none" },
    };
  }
  return {
    name: prepared.name ?? "",
    method: prepared.method ?? "",
    url: prepared.url ?? "",
    query: prepared.query ?? {},
    headers: prepared.headers ?? {},
    body: prepared.body ?? { type: "none" },
  };
}

export function rawCombinedDump(
  requestDump: string | undefined,
  responseDump: string | undefined,
): string {
  const left = requestDump ? requestDump : "无";
  const right = responseDump ? responseDump : "无";
  return `${left}\n\n----------\n\n${right}`;
}

export function sizeLabel(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function msLabel(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 10 || Number.isInteger(n)) return n.toFixed(0);
  return n.toFixed(2);
}

export function prettyBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
