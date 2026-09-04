import type { HttpRequest, Result } from "./types";

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
  if (r.timeout) next.timeout = r.timeout;
  return next;
}

export function parseHistoryResult(result: unknown): Result {
  if (typeof result === "string") {
    return JSON.parse(result) as Result;
  }
  return result as Result;
}
