import type { HttpRequest } from "./types";

export interface CurlOptions {
  useResolve: boolean;
  followRedirects: boolean;
  maxTime: boolean;
}

export interface CurlResolve {
  host: string;
  port: string;
  ip: string;
}

export function defaultCurlOptions(): CurlOptions {
  return {
    useResolve: true,
    followRedirects: true,
    maxTime: true,
  };
}

export function shellSingleQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

function formatSeconds(seconds: number): string {
  if (Number.isInteger(seconds)) {
    return String(seconds);
  }
  return String(seconds);
}

function urlWithQuery(prepared: HttpRequest): string {
  const url = new URL(prepared.url);
  for (const [key, value] of Object.entries(prepared.query)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((k) => k.toLowerCase() === lower);
}

function encodeFormBody(content: string | Record<string, string>): string {
  if (typeof content === "string") {
    return content;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(content).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    params.set(key, value);
  }
  return params.toString();
}

export function formatCurl(input: {
  prepared: HttpRequest;
  resolve?: CurlResolve | null;
  timeoutSeconds: number;
  options: CurlOptions;
}): string {
  const { prepared, resolve, timeoutSeconds, options } = input;
  const parts: string[] = ["curl"];

  if (options.followRedirects) parts.push("-L");
  if (options.maxTime) parts.push(`--max-time ${formatSeconds(timeoutSeconds)}`);
  if (options.useResolve && resolve) {
    parts.push(
      `--resolve ${shellSingleQuote(`${resolve.host}:${resolve.port}:${resolve.ip}`)}`,
    );
  }

  parts.push(`-X ${prepared.method}`);
  parts.push(shellSingleQuote(urlWithQuery(prepared)));

  const headers: Record<string, string> = { ...prepared.headers };
  const method = prepared.method.toUpperCase();

  if (!hasHeader(headers, "User-Agent")) {
    headers["User-Agent"] = "httptest/0.1";
  }

  if (method !== "GET" && method !== "HEAD") {
    if (prepared.body.type === "json" && !hasHeader(headers, "Content-Type")) {
      headers["Content-Type"] = "application/json";
    } else if (
      prepared.body.type === "form" &&
      !hasHeader(headers, "Content-Type")
    ) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }
  }

  for (const key of Object.keys(headers).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  )) {
    parts.push(`-H ${shellSingleQuote(`${key}: ${headers[key]}`)}`);
  }

  if (method !== "GET" && method !== "HEAD") {
    const { body } = prepared;
    if (body.type === "json" && body.content !== undefined) {
      parts.push(`--data-raw ${shellSingleQuote(String(body.content))}`);
    } else if (body.type === "raw" && body.content !== undefined) {
      parts.push(`--data-raw ${shellSingleQuote(String(body.content))}`);
    } else if (body.type === "form" && body.content !== undefined) {
      parts.push(
        `--data-raw ${shellSingleQuote(encodeFormBody(body.content))}`,
      );
    }
  }

  return parts.join(" \\\n  ");
}
