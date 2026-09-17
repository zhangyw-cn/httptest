import { describe, expect, it } from "vitest";
import {
  applyParsedCurl,
  formatCurl,
  parseCurl,
  shellSingleQuote,
  defaultCurlOptions,
  effectiveCurlOptions,
  resolveArg,
} from "./curl";
import type { HttpRequest } from "./types";

function base(partial: Partial<HttpRequest> = {}): HttpRequest {
  return {
    name: "",
    method: "GET",
    url: "http://example.com/a",
    query: {},
    headers: {},
    body: { type: "none" },
    ...partial,
  };
}

describe("shellSingleQuote", () => {
  it("escapes single quotes", () => {
    expect(shellSingleQuote("a'b")).toBe("'a'\\''b'");
  });
});

describe("resolveArg", () => {
  it("leaves IPv4 plain", () => {
    expect(resolveArg("h", "80", "10.0.0.1")).toBe("h:80:10.0.0.1");
  });
  it("brackets IPv6", () => {
    expect(resolveArg("h", "443", "2001:db8::1")).toBe("h:443:[2001:db8::1]");
  });
});

describe("effectiveCurlOptions", () => {
  it("forces useResolve off without resolve", () => {
    const o = effectiveCurlOptions(defaultCurlOptions(), undefined);
    expect(o.useResolve).toBe(false);
    expect(o.followRedirects).toBe(true);
  });
  it("keeps useResolve when resolve present", () => {
    const o = effectiveCurlOptions(defaultCurlOptions(), {
      host: "h",
      port: "80",
      ip: "1.1.1.1",
    });
    expect(o.useResolve).toBe(true);
  });
});

describe("formatCurl", () => {
  it("builds GET with defaults", () => {
    const s = formatCurl({
      prepared: base(),
      timeoutSeconds: 30,
      options: defaultCurlOptions(),
    });
    expect(s).toContain("curl");
    expect(s).toContain("-L");
    expect(s).toContain("--max-time 30");
    expect(s).toContain("-X GET");
    expect(s).toContain("'http://example.com/a'");
    expect(s).toContain("User-Agent: httptest/0.1");
  });

  it("merges query and posts json", () => {
    const s = formatCurl({
      prepared: base({
        method: "POST",
        query: { q: "1" },
        body: { type: "json", content: `{"a":1}` },
      }),
      timeoutSeconds: 30,
      options: { useResolve: false, followRedirects: false, maxTime: false },
    });
    expect(s).not.toContain("-L");
    expect(s).not.toContain("--max-time");
    expect(s).toContain("q=1");
    expect(s).toContain("Content-Type: application/json");
    expect(s).toContain("--data-raw");
    expect(s).toContain(`'{"a":1}'`);
  });

  it("adds --resolve when enabled", () => {
    const s = formatCurl({
      prepared: base({ url: "http://api.local/" }),
      resolve: { host: "api.local", port: "80", ip: "10.0.0.1" },
      timeoutSeconds: 30,
      options: {
        ...defaultCurlOptions(),
        followRedirects: false,
        maxTime: false,
      },
    });
    expect(s).toContain("--resolve 'api.local:80:10.0.0.1'");
  });

  it("brackets IPv6 addresses in --resolve", () => {
    const s = formatCurl({
      prepared: base({ url: "https://api.local/" }),
      resolve: { host: "api.local", port: "443", ip: "2001:db8::1" },
      timeoutSeconds: 30,
      options: {
        ...defaultCurlOptions(),
        followRedirects: false,
        maxTime: false,
      },
    });
    expect(s).toContain("--resolve 'api.local:443:[2001:db8::1]'");
  });

  it("encodes form body and sets content-type", () => {
    const s = formatCurl({
      prepared: base({
        method: "POST",
        body: { type: "form", content: { b: "2", a: "1" } },
      }),
      timeoutSeconds: 30,
      options: { useResolve: false, followRedirects: false, maxTime: false },
    });
    expect(s).toContain("Content-Type: application/x-www-form-urlencoded");
    expect(s).toContain("--data-raw");
    expect(s).toContain("a=1");
    expect(s).toContain("b=2");
  });

  it("sends raw body without default json content-type", () => {
    const s = formatCurl({
      prepared: base({
        method: "PUT",
        body: { type: "raw", content: "plain" },
      }),
      timeoutSeconds: 30,
      options: { useResolve: false, followRedirects: false, maxTime: false },
    });
    expect(s).toContain("--data-raw 'plain'");
    expect(s).not.toContain("Content-Type: application/json");
  });

  it("omits body for HEAD", () => {
    const s = formatCurl({
      prepared: base({
        method: "HEAD",
        body: { type: "json", content: "{}" },
      }),
      timeoutSeconds: 30,
      options: { useResolve: false, followRedirects: false, maxTime: false },
    });
    expect(s).not.toContain("--data-raw");
  });

  it("escapes quotes in header and body", () => {
    const s = formatCurl({
      prepared: base({
        method: "POST",
        headers: { "X-Token": "a'b" },
        body: { type: "raw", content: "c'd" },
      }),
      timeoutSeconds: 30,
      options: { useResolve: false, followRedirects: false, maxTime: false },
    });
    expect(s).toContain(shellSingleQuote("X-Token: a'b"));
    expect(s).toContain(`--data-raw ${shellSingleQuote("c'd")}`);
  });

  it("formats fractional max-time", () => {
    const s = formatCurl({
      prepared: base(),
      timeoutSeconds: 0.5,
      options: { useResolve: false, followRedirects: false, maxTime: true },
    });
    expect(s).toContain("--max-time 0.5");
  });

  it("omits --resolve when useResolve is false", () => {
    const s = formatCurl({
      prepared: base({ url: "http://api.local/" }),
      resolve: { host: "api.local", port: "80", ip: "10.0.0.1" },
      timeoutSeconds: 30,
      options: { useResolve: false, followRedirects: false, maxTime: false },
    });
    expect(s).not.toContain("--resolve");
  });

  it("preview updates when followRedirects toggled off", () => {
    const prepared = base();
    const on = formatCurl({
      prepared,
      timeoutSeconds: 30,
      options: effectiveCurlOptions(
        { useResolve: false, followRedirects: true, maxTime: false },
        null,
      ),
    });
    const off = formatCurl({
      prepared,
      timeoutSeconds: 30,
      options: effectiveCurlOptions(
        { useResolve: false, followRedirects: false, maxTime: false },
        null,
      ),
    });
    expect(on).toContain("-L");
    expect(off).not.toContain("-L");
  });
});

describe("parseCurl", () => {
  it("parses simple GET", () => {
    const r = parseCurl("curl 'http://example.com/api'");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.request.method).toBe("GET");
    expect(r.request.url).toBe("http://example.com/api");
    expect(r.request.query).toEqual({});
    expect(r.request.body.type).toBe("none");
  });

  it("splits URL query into query map", () => {
    const r = parseCurl("curl 'http://example.com/x?a=1&b=2'");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.request.url).toBe("http://example.com/x");
    expect(r.request.query).toEqual({ a: "1", b: "2" });
  });

  it("maps -X -H --data-raw and infers POST", () => {
    const r = parseCurl(
      `curl -X POST 'http://example.com/login' -H 'Content-Type: application/json' --data-raw '{"u":"a"}'`,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.request.method).toBe("POST");
    expect(r.request.headers["Content-Type"]).toBe("application/json");
    expect(r.request.body).toEqual({
      type: "json",
      content: '{"u":"a"}',
    });
  });

  it("data without -X defaults to POST", () => {
    const r = parseCurl(`curl 'http://example.com/' --data-raw 'x=1'`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.request.method).toBe("POST");
    expect(r.request.body.type).toBe("raw");
  });

  it("maps -A and -e; later -H wins", () => {
    const r = parseCurl(
      `curl 'http://example.com/' -A 'OldUA' -H 'User-Agent: NewUA' -e 'http://ref.example/'`,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.request.headers["User-Agent"]).toBe("NewUA");
    expect(r.request.headers["Referer"]).toBe("http://ref.example/");
  });

  it("maps --max-time to timeout", () => {
    const r = parseCurl(`curl --max-time 1.5 'http://example.com/'`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.request.timeout).toBe("1.5s");
  });

  it("ignores -L -v --compressed", () => {
    const r = parseCurl(
      `curl -L -v --compressed 'http://example.com/'`,
    );
    expect(r.ok).toBe(true);
  });

  it("fails on --resolve", () => {
    const r = parseCurl(
      `curl --resolve example.com:80:127.0.0.1 'http://example.com/'`,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/--resolve/);
  });

  it("fails on unknown flag", () => {
    const r = parseCurl(`curl --proxy http://p 'http://example.com/'`);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/--proxy/);
  });

  it("fails on clustered short options", () => {
    const r = parseCurl(`curl -vL 'http://example.com/'`);
    expect(r.ok).toBe(false);
  });

  it("fails without curl prefix", () => {
    expect(parseCurl("wget http://x").ok).toBe(false);
  });

  it("handles line continuations and # comments", () => {
    const r = parseCurl(`# demo
curl -X GET \\
  'http://example.com/y'`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.request.method).toBe("GET");
    expect(r.request.url).toBe("http://example.com/y");
  });

  it("-G moves data into query", () => {
    const r = parseCurl(
      `curl -G 'http://example.com/search' --data-raw 'q=hi&page=1'`,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.request.method).toBe("GET");
    expect(r.request.query).toEqual({ q: "hi", page: "1" });
    expect(r.request.body.type).toBe("none");
  });

  it("-I sets HEAD", () => {
    const r = parseCurl(`curl -I 'http://example.com/'`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.request.method).toBe("HEAD");
  });

  it("urlencoded body becomes form", () => {
    const r = parseCurl(
      `curl 'http://example.com/' -H 'Content-Type: application/x-www-form-urlencoded' --data-raw 'a=1&b=2'`,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.request.body).toEqual({ type: "form", content: { a: "1", b: "2" } });
  });

  it("GET with data without -G fails", () => {
    const r = parseCurl(
      `curl -X GET 'http://example.com/' --data-raw 'x=1'`,
    );
    expect(r.ok).toBe(false);
  });
});

describe("applyParsedCurl", () => {
  it("keeps name and clears timeout when absent", () => {
    const draft: HttpRequest = {
      name: "Login",
      method: "POST",
      url: "http://old/",
      query: { z: "9" },
      headers: { A: "1" },
      body: { type: "raw", content: "x" },
      timeout: "10s",
    };
    const parsed = {
      method: "GET",
      url: "http://new/",
      query: {},
      headers: {},
      body: { type: "none" as const },
    };
    const next = applyParsedCurl(draft, parsed);
    expect(next.name).toBe("Login");
    expect(next.method).toBe("GET");
    expect(next.url).toBe("http://new/");
    expect(next.timeout).toBeUndefined();
  });
});
