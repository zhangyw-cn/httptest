import type { HttpRequest, RequestSettings, Result } from "./types";

export function compactSettings(
  s: RequestSettings | undefined,
): RequestSettings | undefined {
  if (!s) return undefined;
  const out: RequestSettings = {};
  if (s.timeoutMs !== undefined && s.timeoutMs !== 30000) out.timeoutMs = s.timeoutMs;
  if (s.followRedirects === false) out.followRedirects = false;
  if (s.maxRedirects !== undefined && s.maxRedirects !== 10)
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
