import { describe, expect, it } from "vitest";
import {
  formatCurl,
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
