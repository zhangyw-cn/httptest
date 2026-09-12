import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ResultPane, { RequestResult, ResultPaneContent } from "./ResultPane";
import { defaultResultTabs, rawCombinedDump } from "./result-pane";
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

const noop = () => {};

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
    expect(markup).toContain("&quot;ok&quot;: true");
    expect(markup).not.toMatch(/>Body<\/button><button[^>]*>Raw</);
  });
});

describe("ResultPaneContent Raw", () => {
  it("renders request and response dumps with separator", () => {
    const result = sampleResult({
      requestDump: "POST /login HTTP/1.1",
      responseDump: "HTTP/1.1 200 OK",
    });
    const markup = renderToStaticMarkup(
      <ResultPaneContent
        result={result}
        tabs={{ ...defaultResultTabs(), primary: "raw" }}
        onPrimary={noop}
        onRequestTab={noop}
        onResponseTab={noop}
      />,
    );
    expect(markup).toContain("POST /login HTTP/1.1");
    expect(markup).toContain("HTTP/1.1 200 OK");
    expect(markup).toContain("----------");
    expect(markup).toContain(
      rawCombinedDump(result.requestDump, result.responseDump),
    );
  });

  it("renders 无 for empty dump sides", () => {
    const markup = renderToStaticMarkup(
      <ResultPaneContent
        result={sampleResult({ requestDump: "", responseDump: "" })}
        tabs={{ ...defaultResultTabs(), primary: "raw" }}
        onPrimary={noop}
        onRequestTab={noop}
        onResponseTab={noop}
      />,
    );
    expect(markup).toContain("无\n\n----------\n\n无");
  });
});

describe("RequestResult", () => {
  it("shows overview method, url, request size, and expanded hint", () => {
    const markup = renderToStaticMarkup(
      <RequestResult
        prepared={samplePrepared()}
        requestSize={11}
        tab="overview"
        onTabChange={noop}
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

  it("shows 无 on Query tab when query is empty", () => {
    const markup = renderToStaticMarkup(
      <RequestResult
        prepared={samplePrepared({ query: {} })}
        requestSize={0}
        tab="query"
        onTabChange={noop}
      />,
    );
    expect(markup).toContain('class="tab active"');
    expect(markup).toContain(">Query<");
    expect(markup).toContain('class="muted">无</p>');
  });

  it("shows headers table on Headers tab", () => {
    const markup = renderToStaticMarkup(
      <RequestResult
        prepared={samplePrepared()}
        requestSize={11}
        tab="headers"
        onTabChange={noop}
      />,
    );
    expect(markup).toContain("Content-Type");
    expect(markup).toContain("application/json");
  });

  it("pretty-prints json body on Body tab", () => {
    const markup = renderToStaticMarkup(
      <RequestResult
        prepared={samplePrepared()}
        requestSize={11}
        tab="body"
        onTabChange={noop}
      />,
    );
    expect(markup).toContain("类型：json");
    expect(markup).toContain("&quot;a&quot;: 1");
  });

  it("shows form pairs on Body tab for form type", () => {
    const markup = renderToStaticMarkup(
      <RequestResult
        prepared={samplePrepared({
          body: { type: "form", content: { a: "1", b: "2" } },
        })}
        requestSize={0}
        tab="body"
        onTabChange={noop}
      />,
    );
    expect(markup).toContain("类型：form");
    expect(markup).toContain(">a</td>");
    expect(markup).toContain(">1</td>");
    expect(markup).toContain(">b</td>");
  });

  it("shows 无正文 for none body", () => {
    const markup = renderToStaticMarkup(
      <RequestResult
        prepared={samplePrepared({ body: { type: "none" } })}
        requestSize={0}
        tab="body"
        onTabChange={noop}
      />,
    );
    expect(markup).toContain("无正文");
  });

  it("tolerates missing prepared", () => {
    const markup = renderToStaticMarkup(
      <RequestResult
        prepared={undefined}
        requestSize={0}
        tab="overview"
        onTabChange={noop}
      />,
    );
    expect(markup).toContain("变量已展开");
    expect(markup).toContain("请求 0 B");
  });

  it("shows resolvedIP on request overview when present", () => {
    const markup = renderToStaticMarkup(
      <RequestResult
        prepared={samplePrepared()}
        requestSize={0}
        resolvedIP="10.0.0.5"
        tab="overview"
        onTabChange={noop}
      />,
    );
    expect(markup).toContain("10.0.0.5");
    expect(markup).toContain("拨号 IP");
  });

  it("hides resolvedIP row when absent", () => {
    const markup = renderToStaticMarkup(
      <RequestResult
        prepared={samplePrepared()}
        requestSize={0}
        tab="overview"
        onTabChange={noop}
      />,
    );
    expect(markup).not.toContain("拨号 IP");
  });
});

describe("ResultPaneContent request primary", () => {
  it("keeps selected requestTab when rendering a different result", () => {
    const tabs = {
      primary: "request" as const,
      requestTab: "query" as const,
      responseTab: "timeline" as const,
    };
    const first = renderToStaticMarkup(
      <ResultPaneContent
        result={sampleResult()}
        tabs={tabs}
        onPrimary={noop}
        onRequestTab={noop}
        onResponseTab={noop}
      />,
    );
    const second = renderToStaticMarkup(
      <ResultPaneContent
        result={sampleResult({ status: 404, statusText: "Not Found" })}
        tabs={tabs}
        onPrimary={noop}
        onRequestTab={noop}
        onResponseTab={noop}
      />,
    );
    // same tabs → still Query content for sample with q=1
    expect(first).toContain(">q</td>");
    expect(first).toContain('class="tab active">Query</button>');
    expect(second).toContain(">q</td>");
    expect(second).toContain('class="tab active">Query</button>');
    expect(second).toContain("404 Not Found");
  });
});

describe("ResultPane non-http error", () => {
  it("shows errorClass in meta and still renders primary Request / Response / Raw tabs", () => {
    const markup = renderToStaticMarkup(
      <ResultPane
        result={sampleResult({
          errorClass: "dns",
          errorMessage: "connection refused",
          status: 0,
          statusText: "",
        })}
      />,
    );
    expect(markup).toContain("response-error-state");
    expect(markup).toContain("dns");
    expect(markup).toContain("connection refused");
    expect(markup).toContain(">Request<");
    expect(markup).toContain(">Response<");
    expect(markup).toContain(">Raw<");
    expect(markup).not.toContain("status-0xx");
  });
});
