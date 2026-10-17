import type {
  HttpRequest,
  RequestBody,
  RequestSettings,
  ResolveSpec,
} from "./types";

export interface CurlOptions {
  useResolve: boolean;
  followRedirects: boolean;
  maxRedirects: boolean;
  maxTime: boolean;
  insecure: boolean;
}

export function defaultCurlOptions(settings?: RequestSettings): CurlOptions {
  return {
    useResolve: true,
    followRedirects: settings?.followRedirects !== false,
    maxRedirects: true,
    maxTime: true,
    insecure: settings?.insecureSkipVerify === true,
  };
}

export function effectiveCurlOptions(
  options: CurlOptions,
  resolve?: ResolveSpec | null,
): CurlOptions {
  return {
    ...options,
    useResolve: options.useResolve && !!resolve,
  };
}

export function shellSingleQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

function formatSeconds(seconds: number): string {
  return String(seconds);
}

/** curl --resolve needs IPv6 addresses in brackets: host:port:[addr] */
export function resolveArg(host: string, port: string, ip: string): string {
  const addr = ip.includes(":") ? `[${ip}]` : ip;
  return `${host}:${port}:${addr}`;
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

export function packShortOptionLines(parts: string[], width: number): string[] {
  if (parts.length === 0) return [];
  const lines: string[] = [];
  let prefix = "curl";
  let current = prefix;
  for (const part of parts) {
    const candidate = `${current} ${part} \\`;
    if (current !== prefix && candidate.length > width) {
      lines.push(`${current} \\`);
      prefix = "  ";
      current = `${prefix}${part}`;
      continue;
    }
    current = `${current} ${part}`;
  }
  lines.push(`${current} \\`);
  return lines;
}

export interface CurlExplanation {
  text: string;
  explanation: string;
}

const CURL_EXPLANATION = {
  location: "跟随重定向",
  maxRedirs: "重定向次数上限，单位为次",
  insecure: "跳过 TLS 证书校验",
  maxTime: "最长等待时间，单位为秒",
  resolve: "将主机的端口解析到指定 IP",
  method: "HTTP 方法",
  url: "请求地址，查询参数已写在 URL 里",
  header: "请求头",
  body: "请求体原文",
} as const;

interface CurlPiece {
  text: string;
  explanation: string;
  flow: "pack" | "break" | "join";
}

interface CurlCommandInput {
  prepared: HttpRequest;
  resolve?: ResolveSpec | null;
  timeoutSeconds: number;
  options: CurlOptions;
}

function buildCurlPieces(input: CurlCommandInput): CurlPiece[] {
  const { prepared, resolve, timeoutSeconds, options } = input;
  const pieces: CurlPiece[] = [];

  if (options.followRedirects) {
    pieces.push({
      text: "-L",
      explanation: CURL_EXPLANATION.location,
      flow: "pack",
    });
    if (options.maxRedirects) {
      pieces.push({
        text: `--max-redirs ${prepared.settings?.maxRedirects ?? 10}`,
        explanation: CURL_EXPLANATION.maxRedirs,
        flow: "pack",
      });
    }
  }
  if (options.insecure) {
    pieces.push({
      text: "-k",
      explanation: CURL_EXPLANATION.insecure,
      flow: "pack",
    });
  }
  if (options.maxTime) {
    pieces.push({
      text: `--max-time ${formatSeconds(timeoutSeconds)}`,
      explanation: CURL_EXPLANATION.maxTime,
      flow: "pack",
    });
  }
  if (options.useResolve && resolve) {
    pieces.push({
      text: `--resolve ${shellSingleQuote(resolveArg(resolve.host, resolve.port, resolve.ip))}`,
      explanation: CURL_EXPLANATION.resolve,
      flow: "break",
    });
  }

  pieces.push({
    text: `-X ${prepared.method}`,
    explanation: CURL_EXPLANATION.method,
    flow: "break",
  });
  pieces.push({
    text: shellSingleQuote(urlWithQuery(prepared)),
    explanation: CURL_EXPLANATION.url,
    flow: "join",
  });

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
    pieces.push({
      text: `-H ${shellSingleQuote(`${key}: ${headers[key]}`)}`,
      explanation: CURL_EXPLANATION.header,
      flow: "break",
    });
  }

  if (method !== "GET" && method !== "HEAD") {
    const { body } = prepared;
    if (body.type === "json" && body.content !== undefined) {
      pieces.push({
        text: `--data-raw ${shellSingleQuote(String(body.content))}`,
        explanation: CURL_EXPLANATION.body,
        flow: "break",
      });
    } else if (body.type === "raw" && body.content !== undefined) {
      pieces.push({
        text: `--data-raw ${shellSingleQuote(String(body.content))}`,
        explanation: CURL_EXPLANATION.body,
        flow: "break",
      });
    } else if (body.type === "form" && body.content !== undefined) {
      pieces.push({
        text: `--data-raw ${shellSingleQuote(encodeFormBody(body.content))}`,
        explanation: CURL_EXPLANATION.body,
        flow: "break",
      });
    }
  }

  return pieces;
}

function renderCurl(pieces: CurlPiece[]): string {
  const lines = packShortOptionLines(
    pieces.filter((piece) => piece.flow === "pack").map((piece) => piece.text),
    80,
  );
  let open: string[] | null = null;
  const flush = () => {
    if (!open) return;
    const body = open.join(" ");
    lines.push(lines.length === 0 ? `curl ${body}` : `  ${body}`);
    open = null;
  };
  for (const piece of pieces) {
    if (piece.flow === "pack") continue;
    if (piece.flow === "break") {
      flush();
      open = [piece.text];
      continue;
    }
    if (!open) open = [];
    open.push(piece.text);
  }
  flush();
  return lines
    .map((line, index) =>
      index === lines.length - 1 || line.endsWith(" \\") ? line : `${line} \\`,
    )
    .join("\n");
}

export function explainCurl(input: CurlCommandInput): CurlExplanation[] {
  return buildCurlPieces(input).map(({ text, explanation }) => ({
    text,
    explanation,
  }));
}

export function formatCurl(input: CurlCommandInput): string {
  return renderCurl(buildCurlPieces(input));
}

export type ParsedCurlRequest = Omit<HttpRequest, "name">;

export type ParseCurlResult =
  | { ok: true; request: ParsedCurlRequest }
  | { ok: false; error: string };

const METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

/** Strip full-line # comments, then join backslash newlines. */
export function preprocessCurlInput(input: string): string {
  const withoutComments = input
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
  return withoutComments.replace(/\\\r?\n/g, " ");
}

export function tokenizeShell(input: string): string[] | { error: string } {
  const tokens: string[] = [];
  let i = 0;
  const s = input.trim();
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i]!)) i++;
    if (i >= s.length) break;
    const c = s[i]!;
    if (c === "'" || c === '"') {
      const quote = c;
      i++;
      let buf = "";
      while (i < s.length && s[i] !== quote) {
        buf += s[i]!;
        i++;
      }
      if (i >= s.length) return { error: "未闭合的引号" };
      i++;
      tokens.push(buf);
      continue;
    }
    let buf = "";
    while (i < s.length && !/\s/.test(s[i]!)) {
      buf += s[i]!;
      i++;
    }
    tokens.push(buf);
  }
  return tokens;
}

function fail(error: string): ParseCurlResult {
  return { ok: false, error };
}

function needArg(
  flag: string,
  tokens: string[],
  i: number,
): string | ParseCurlResult {
  if (i + 1 >= tokens.length) return fail(`${flag} 缺少参数`);
  return tokens[i + 1]!;
}

function parseHeaderLine(raw: string): { name: string; value: string } | null {
  const idx = raw.indexOf(":");
  if (idx <= 0) return null;
  return { name: raw.slice(0, idx).trim(), value: raw.slice(idx + 1).trim() };
}

function setHeader(
  headers: Record<string, string>,
  name: string,
  value: string,
) {
  const existing = Object.keys(headers).find(
    (k) => k.toLowerCase() === name.toLowerCase(),
  );
  if (existing) delete headers[existing];
  headers[name] = value;
}

function splitUrl(
  raw: string,
): { url: string; query: Record<string, string> } | { error: string } {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { error: `无效 URL: ${raw}` };
  }
  const query: Record<string, string> = {};
  u.searchParams.forEach((v, k) => {
    query[k] = v;
  });
  return { url: `${u.origin}${u.pathname}`, query };
}

function headerValue(
  headers: Record<string, string>,
  name: string,
): string | undefined {
  const key = Object.keys(headers).find(
    (k) => k.toLowerCase() === name.toLowerCase(),
  );
  return key ? headers[key] : undefined;
}

function buildBody(
  dataChunks: string[],
  headers: Record<string, string>,
): RequestBody {
  if (dataChunks.length === 0) return { type: "none" };
  const content = dataChunks.join("&");
  const ct = headerValue(headers, "Content-Type")?.toLowerCase() ?? "";
  if (ct.includes("application/json")) {
    return { type: "json", content };
  }
  if (ct.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(content);
    const map: Record<string, string> = {};
    let ok = true;
    params.forEach((v, k) => {
      map[k] = v;
    });
    if (content && [...params.keys()].length === 0 && content.includes("=")) {
      ok = false;
    }
    if (ok) return { type: "form", content: map };
  }
  return { type: "raw", content };
}

const IGNORE_NO_ARG = new Set([
  "--compressed",
  "-v",
  "--verbose",
  "-s",
  "--silent",
  "-S",
  "--show-error",
  "-i",
  "--include",
  "-O",
  "--remote-name",
  "-#",
  "--progress-bar",
  "-f",
  "--fail",
  "--no-progress-meter",
]);

const IGNORE_SWALLOW_ARG = new Set(["-o", "--output"]);

export function parseCurl(input: string): ParseCurlResult {
  const preprocessed = preprocessCurlInput(input);
  const tokenized = tokenizeShell(preprocessed);
  if (!Array.isArray(tokenized)) return fail(tokenized.error);

  const tokens = tokenized;
  if (tokens.length === 0 || tokens[0] !== "curl") {
    return fail("命令必须以 curl 开头");
  }

  for (const t of tokens) {
    if (t.includes("$") || t.includes("`")) {
      return fail("不支持 shell 变量或命令替换");
    }
  }

  let method: string | undefined;
  let methodExplicit = false;
  const headers: Record<string, string> = {};
  const dataChunks: string[] = [];
  let useGet = false;
  const settings: RequestSettings = {};
  const urls: string[] = [];

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i]!;

    if (token.startsWith("-")) {
      if (/^-[^-].{1,}$/.test(token)) {
        return fail("不支持粘连短选项");
      }

      if (token === "-X" || token === "--request") {
        const arg = needArg(token, tokens, i);
        if (typeof arg !== "string") return arg;
        const m = arg.toUpperCase();
        if (!METHODS.has(m)) return fail(`不支持的 HTTP 方法: ${arg}`);
        method = m;
        methodExplicit = true;
        i++;
        continue;
      }

      if (token === "-I" || token === "--head") {
        method = "HEAD";
        methodExplicit = true;
        continue;
      }

      if (token === "-H" || token === "--header") {
        const arg = needArg(token, tokens, i);
        if (typeof arg !== "string") return arg;
        const parsed = parseHeaderLine(arg);
        if (!parsed) return fail(`无效的请求头: ${arg}`);
        setHeader(headers, parsed.name, parsed.value);
        i++;
        continue;
      }

      if (token === "-A" || token === "--user-agent") {
        const arg = needArg(token, tokens, i);
        if (typeof arg !== "string") return arg;
        setHeader(headers, "User-Agent", arg);
        i++;
        continue;
      }

      if (token === "-e" || token === "--referer") {
        const arg = needArg(token, tokens, i);
        if (typeof arg !== "string") return arg;
        setHeader(headers, "Referer", arg);
        i++;
        continue;
      }

      if (
        token === "-d" ||
        token === "--data" ||
        token === "--data-raw" ||
        token === "--data-binary"
      ) {
        const arg = needArg(token, tokens, i);
        if (typeof arg !== "string") return arg;
        dataChunks.push(arg);
        i++;
        continue;
      }

      if (token === "-G" || token === "--get") {
        useGet = true;
        continue;
      }

      if (token === "-L" || token === "--location") {
        settings.followRedirects = true;
        continue;
      }

      if (token === "-k" || token === "--insecure") {
        settings.insecureSkipVerify = true;
        continue;
      }

      if (token === "--max-redirs") {
        const arg = needArg(token, tokens, i);
        if (typeof arg !== "string") return arg;
        const n = Number(arg);
        if (!Number.isInteger(n) || n < 1 || n > 50) {
          return fail(`${token} 参数无效: ${arg}`);
        }
        settings.maxRedirects = n;
        i++;
        continue;
      }

      if (token === "--max-time" || token === "-m") {
        const arg = needArg(token, tokens, i);
        if (typeof arg !== "string") return arg;
        const n = Number(arg);
        const timeoutMs = Math.round(n * 1000);
        if (!Number.isFinite(n) || !(timeoutMs > 0)) {
          return fail(`${token} 参数无效: ${arg}`);
        }
        settings.timeoutMs = timeoutMs;
        i++;
        continue;
      }

      if (IGNORE_NO_ARG.has(token)) continue;

      if (IGNORE_SWALLOW_ARG.has(token)) {
        if (i + 1 >= tokens.length) return fail(`${token} 缺少参数`);
        i++;
        continue;
      }

      return fail(`不支持的选项: ${token}`);
    }

    urls.push(token);
  }

  if (urls.length !== 1) {
    return fail(urls.length === 0 ? "缺少 URL" : "仅支持单个 URL");
  }

  const split = splitUrl(urls[0]!);
  if ("error" in split) return fail(split.error);

  const query: Record<string, string> = { ...split.query };

  if (useGet && dataChunks.length > 0) {
    const params = new URLSearchParams(dataChunks.join("&"));
    params.forEach((v, k) => {
      query[k] = v;
    });
    dataChunks.length = 0;
    if (!methodExplicit) method = "GET";
  }

  if (dataChunks.length > 0 && !methodExplicit) method = "POST";
  if (dataChunks.length === 0 && !methodExplicit) method = "GET";
  if (!method) method = "GET";

  if (!METHODS.has(method)) {
    return fail(`不支持的 HTTP 方法: ${method}`);
  }

  const upper = method.toUpperCase();
  if ((upper === "GET" || upper === "HEAD") && dataChunks.length > 0) {
    return fail("GET/HEAD 请求不能包含请求体");
  }

  const body = buildBody(dataChunks, headers);

  const request: ParsedCurlRequest = {
    method: upper,
    url: split.url,
    query,
    headers,
    body,
  };
  if (Object.keys(settings).length > 0) {
    request.settings = settings;
  }

  return { ok: true, request };
}

export function applyParsedCurl(
  draft: HttpRequest,
  parsed: ParsedCurlRequest,
): HttpRequest {
  const next: HttpRequest = {
    name: draft.name,
    method: parsed.method,
    url: parsed.url,
    query: { ...parsed.query },
    headers: { ...parsed.headers },
    body: parsed.body,
  };
  if (parsed.settings) next.settings = { ...parsed.settings };
  return next;
}
