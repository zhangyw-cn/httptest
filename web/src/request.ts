import type { HttpRequest, RequestSettings, Result } from "./types";

export const DEFAULT_TIMEOUT_MS = 30000;
export const DEFAULT_MAX_REDIRECTS = 10;
export const MAX_MAX_REDIRECTS = 50;

export function compactSettings(
  s: RequestSettings | undefined,
): RequestSettings | undefined {
  if (!s) return undefined;
  const out: RequestSettings = {};
  if (s.timeoutMs !== undefined && s.timeoutMs !== DEFAULT_TIMEOUT_MS)
    out.timeoutMs = s.timeoutMs;
  if (s.followRedirects === false) out.followRedirects = false;
  if (s.maxRedirects !== undefined && s.maxRedirects !== DEFAULT_MAX_REDIRECTS)
    out.maxRedirects = s.maxRedirects;
  if (s.insecureSkipVerify === true) out.insecureSkipVerify = true;
  return Object.keys(out).length ? out : undefined;
}

export function defaultDraft(): HttpRequest {
  return {
    name: "",
    method: "GET",
    url: "{{baseUrl}}/",
    query: {},
    headers: {},
    body: { type: "none" },
  };
}

export function normalizeRequest(r: HttpRequest): HttpRequest {
  const next: HttpRequest = {
    name: r.name ?? "",
    method: r.method || "GET",
    url: r.url ?? "",
    query: r.query ?? {},
    headers: r.headers ?? {},
    body: r.body ?? { type: "none" },
  };
  const settings = compactSettings(r.settings);
  if (settings) next.settings = settings;
  return next;
}

export function parseHistoryResult(result: unknown): Result {
  if (typeof result === "string") {
    return JSON.parse(result) as Result;
  }
  return result as Result;
}
