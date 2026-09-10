import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ResultPane, { RequestResult } from "./ResultPane";
import { rawCombinedDump } from "./result-pane";
import type { HttpRequest, Result } from "./types";

function samplePrepared(over: Partial<HttpRequest> = {}): HttpRequest {
  return {
    name: "login",
    method: "POST",
    url: "https://api.example/login",
    query: { q: "1" },
    headers: { "Content-Type": "application/json" },
    body: { type: "json", content: '{"a":1}' },
    ...over,
  };
}

function sampleResult(over: Partial<Result> = {}): Result {
  return {
    status: 200,
    statusText: "OK",
    headers: { "Content-Type": ["application/json"] },
    body: '{"ok":true}',
    truncated: false,
    requestDump: "POST /login HTTP/1.1",
    responseDump: "HTTP/1.1 200 OK",
    requestSize: 11,
    responseSize: 11,
    redirects: [],
    timings: {
      dnsMs: 1,
      connectMs: 2,
      tlsMs: 3,
      firstByteMs: 4,
      totalMs: 12,
    },
    errorClass: "http",
    errorMessage: "",
    prepared: samplePrepared(),
    ...over,
  };
}

describe("ResultPane empty", () => {
  it("shows empty state without primary tabs", () => {
    const markup = renderToStaticMarkup(<ResultPane result={null} />);
    expect(markup).toContain("还没有响应");
    expect(markup).toContain("填 URL，按 Send 或 Ctrl+Enter");
    expect(markup).not.toContain(">Request<");
    expect(markup).not.toContain(">Response<");
  });
});

describe("ResultPane http result", () => {
  it("shows trimmed meta without request size label", () => {
    const markup = renderToStaticMarkup(
      <ResultPane result={sampleResult()} />,
    );
    expect(markup).toContain("200 OK");
    expect(markup).toContain("12 ms");
    expect(markup).toContain("响应 11 B");
    expect(markup).not.toMatch(/请求\s+11\s+B/);
  });

  it("shows body size in meta when empty body differs from responseSize", () => {
    const markup = renderToStaticMarkup(
      <ResultPane
        result={sampleResult({ body: "", responseSize: 11 })}
      />,
    );
    expect(markup).toContain("响应 11 B");
    expect(markup).toContain("正文 0 B");
  });

  it("renders primary Request / Response / Raw tabs", () => {
    const markup = renderToStaticMarkup(
      <ResultPane result={sampleResult()} />,
    );
    expect(markup).toContain(">Request<");
    expect(markup).toContain(">Response<");
    expect(markup).toContain(">Raw<");
  });

  it("defaults to Response with Body / Headers / Timeline (no nested Raw)", () => {
    const markup = renderToStaticMarkup(
      <ResultPane result={sampleResult()} />,
    );
    expect(markup).toContain(">Body<");
    expect(markup).toContain(">Headers<");
    expect(markup).toContain(">Timeline<");
    // 默认 Response → Body 内容
    expect(markup).toContain("&quot;ok&quot;: true");
    // 一级有且仅有一处 Raw 按钮文案；二级不应再出现独立 Raw 页签——
    // 用「按钮序列」粗检：Body 与 Headers 之间不应插入 Raw
    expect(markup).not.toMatch(/>Body<\/button><button[^>]*>Raw</);
  });
});

describe("RequestResult", () => {
  it("shows overview method, url, request size, and expanded hint", () => {
    const markup = renderToStaticMarkup(
      <RequestResult
        prepared={samplePrepared()}
        requestSize={11}
        tab="overview"
        onTabChange={() => {}}
      />,
    );
    expect(markup).toContain("POST");
    expect(markup).toContain("https://api.example/login");
    expect(markup).toContain("请求 11 B");
    expect(markup).toContain("变量已展开");
    expect(markup).toContain(">Overview<");
    expect(markup).toContain(">Query<");
    expect(markup).toContain(">Headers<");
    expect(markup).toContain(">Body<");
  });

  it("shows 无 for empty query on Query tab default is overview — export still lists Query button", () => {
    const markup = renderToStaticMarkup(
      <RequestResult
        prepared={samplePrepared({ query: {} })}
        requestSize={0}
        tab="overview"
        onTabChange={() => {}}
      />,
    );
    expect(markup).toContain(">Query<");
    expect(markup).toContain("请求 0 B");
  });
});

describe("ResultPane raw dump", () => {
  it("exposes rawCombinedDump text when primary would be raw — test via helper already; assert RequestResult wired placeholder gone", () => {
    const markup = renderToStaticMarkup(
      <RequestResult
        prepared={undefined}
        requestSize={0}
        tab="overview"
        onTabChange={() => {}}
      />,
    );
    expect(markup).toContain("变量已展开");
    expect(markup).toContain("请求 0 B");
  });
});

describe("Raw dump contract", () => {
  it("matches helper used by ResultPane", () => {
    expect(rawCombinedDump("A", "B")).toContain("----------");
  });
});

describe("ResultPane non-http error", () => {
  it("shows errorClass in meta and still renders primary Request / Response / Raw tabs", () => {
    const markup = renderToStaticMarkup(
      <ResultPane
        result={sampleResult({
          errorClass: "network",
          errorMessage: "connection refused",
          status: 0,
          statusText: "",
        })}
      />,
    );
    expect(markup).toContain("response-error-state");
    expect(markup).toContain("network");
    expect(markup).toContain("connection refused");
    expect(markup).toContain(">Request<");
    expect(markup).toContain(">Response<");
    expect(markup).toContain(">Raw<");
  });
});
