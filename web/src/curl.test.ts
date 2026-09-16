import { describe, expect, it } from "vitest";
import { formatCurl, shellSingleQuote, defaultCurlOptions } from "./curl";
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
      options: { ...defaultCurlOptions(), followRedirects: false, maxTime: false },
    });
    expect(s).toContain("--resolve 'api.local:80:10.0.0.1'");
  });

  it("brackets IPv6 addresses in --resolve", () => {
    const s = formatCurl({
      prepared: base({ url: "https://api.local/" }),
      resolve: { host: "api.local", port: "443", ip: "2001:db8::1" },
      timeoutSeconds: 30,
      options: { ...defaultCurlOptions(), followRedirects: false, maxTime: false },
    });
    expect(s).toContain("--resolve 'api.local:443:[2001:db8::1]'");
  });
});
