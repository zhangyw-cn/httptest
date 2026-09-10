# 结果面板（Request / Response / Raw）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把集合/历史右侧从「仅响应」升级为结果面板：一级 `Request | Response | Raw`，精简 meta，并只读展示变量展开后的 `prepared` 请求。

**Architecture:** 将 `ResponsePane.tsx` 改名为 `ResultPane.tsx`；抽出纯函数 `normalizePrepared` / `rawCombinedDump` 与只读子视图 `RequestResult`（便于 node 环境 `renderToStaticMarkup` 测 Request 内容）。`App` 仍只传 `{ result }`。DOM 继续用 `.response*` class。不改 Go / API。

**Tech Stack:** React + TypeScript + Vite + 手写 CSS；Vitest（`environment: "node"` + `renderToStaticMarkup`）；无新 npm / Go 依赖。

## Global Constraints

- 规格：`docs/superpowers/specs/2026-09-10-result-pane-design.md`。
- 只用已有 `Result` 字段；不改 Go executor / API schema。
- 不新增 npm 包；界面中文；协议词保留 Request / Response / Raw / Body / Headers / Timeline / Method。
- 布局：侧栏 220px、双栏 1:1、UrlBar 横跨——均不改。
- 发送后不强制切换一级页签；新 result / 历史切换不重置已选一级/二级页签。
- Props 仍为 `{ result: Result | null }`；空状态文案不变。
- 不回头改写历史规格或计划文件（可更新 README）。

## File Structure

| 路径 | 职责 |
|------|------|
| `web/src/result-pane.ts` | `normalizePrepared`、`rawCombinedDump`、`sizeLabel`、`msLabel`、`prettyBody` |
| `web/src/result-pane.test.ts` | 上述纯函数测例 |
| `web/src/ResultPane.tsx` | 结果面板（由 `ResponsePane.tsx` 改名）；导出 `RequestResult` |
| `web/src/result-pane-ui.test.tsx` | 空状态、meta、一级页签、Response/Raw/Request 静态标记 |
| `web/src/App.tsx` | import / JSX：`ResultPane` |
| `web/src/styles.css` | 二级页签、Overview 布局（可选微调） |
| `web/src/UrlBar.tsx` | 已有 `methodClass`——Request Overview 复用，不改逻辑 |
| `README.md` | 「界面」一节右栏描述 |
| 删除 | `web/src/ResponsePane.tsx`（`git mv` 后不再存在） |

---

### Task 1: 纯函数 `normalizePrepared` / `rawCombinedDump` + 工具函数搬家

**Files:**
- Create: `web/src/result-pane.ts`
- Create: `web/src/result-pane.test.ts`

**Interfaces:**
- Produces:
  - `export function normalizePrepared(prepared: HttpRequest | null | undefined): HttpRequest`
  - `export function rawCombinedDump(requestDump: string | undefined, responseDump: string | undefined): string`
  - `export function sizeLabel(n: number): string`
  - `export function msLabel(n: number): string`
  - `export function prettyBody(body: string): string`
- Consumes: `HttpRequest` from `./types`

- [ ] **Step 1: 写失败测试**

创建 `web/src/result-pane.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import {
  normalizePrepared,
  prettyBody,
  rawCombinedDump,
  sizeLabel,
} from "./result-pane";

describe("normalizePrepared", () => {
  it("returns empty request when prepared is missing", () => {
    expect(normalizePrepared(undefined)).toEqual({
      name: "",
      method: "",
      url: "",
      query: {},
      headers: {},
      body: { type: "none" },
    });
    expect(normalizePrepared(null)).toEqual({
      name: "",
      method: "",
      url: "",
      query: {},
      headers: {},
      body: { type: "none" },
    });
  });

  it("fills missing fields on a partial prepared object", () => {
    expect(
      normalizePrepared({
        name: "x",
        method: "POST",
        url: "https://ex/{{id}}",
      } as never),
    ).toEqual({
      name: "x",
      method: "POST",
      url: "https://ex/{{id}}",
      query: {},
      headers: {},
      body: { type: "none" },
    });
  });
});

describe("rawCombinedDump", () => {
  it("joins dumps with separator", () => {
    expect(rawCombinedDump("REQ", "RES")).toBe("REQ\n\n----------\n\nRES");
  });

  it("uses 无 for empty sides", () => {
    expect(rawCombinedDump("", "")).toBe("无\n\n----------\n\n无");
    expect(rawCombinedDump(undefined, "RES")).toBe("无\n\n----------\n\nRES");
  });
});

describe("sizeLabel / prettyBody", () => {
  it("formats bytes", () => {
    expect(sizeLabel(12)).toBe("12 B");
    expect(sizeLabel(2048)).toBe("2.0 KB");
  });

  it("pretty-prints JSON and leaves plain text", () => {
    expect(prettyBody('{"a":1}')).toContain("\n");
    expect(prettyBody("not-json")).toBe("not-json");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd web && npm test -- result-pane.test.ts`

Expected: FAIL（无法解析 `./result-pane` 或导出缺失）

- [ ] **Step 3: 实现 `result-pane.ts`**

创建 `web/src/result-pane.ts`：

```ts
import type { HttpRequest } from "./types";

export function normalizePrepared(
  prepared: HttpRequest | null | undefined,
): HttpRequest {
  if (!prepared) {
    return {
      name: "",
      method: "",
      url: "",
      query: {},
      headers: {},
      body: { type: "none" },
    };
  }
  return {
    name: prepared.name ?? "",
    method: prepared.method ?? "",
    url: prepared.url ?? "",
    query: prepared.query ?? {},
    headers: prepared.headers ?? {},
    body: prepared.body ?? { type: "none" },
  };
}

export function rawCombinedDump(
  requestDump: string | undefined,
  responseDump: string | undefined,
): string {
  const left = requestDump ? requestDump : "无";
  const right = responseDump ? responseDump : "无";
  return `${left}\n\n----------\n\n${right}`;
}

export function sizeLabel(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function msLabel(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 10 || Number.isInteger(n)) return n.toFixed(0);
  return n.toFixed(2);
}

export function prettyBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd web && npm test -- result-pane.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/result-pane.ts web/src/result-pane.test.ts
git commit -m "$(cat <<'EOF'
feat: 抽出结果面板纯函数（prepared 归一化与 Raw 拼接）。

EOF
)"
```

---

### Task 2: 改名为 `ResultPane` + meta 精简 + 一级三页签骨架

**Files:**
- Rename: `web/src/ResponsePane.tsx` → `web/src/ResultPane.tsx`（`git mv`）
- Modify: `web/src/ResultPane.tsx`（整文件重写为骨架，Response/Raw 内容迁入）
- Modify: `web/src/App.tsx`（import / JSX）
- Create: `web/src/result-pane-ui.test.tsx`

**Interfaces:**
- Produces:
  - `export default function ResultPane(props: { result: Result | null }): JSX.Element`
  - 一级默认 `"response"`；Response 二级默认 `"body"`
- Consumes: `rawCombinedDump` / `sizeLabel` / `msLabel` / `prettyBody` from `./result-pane`

- [ ] **Step 1: 写失败 UI 测试**

创建 `web/src/result-pane-ui.test.tsx`：

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ResultPane from "./ResultPane";
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
    expect(markup).toContain('"ok": true');
    // 一级有且仅有一处 Raw 按钮文案；二级不应再出现独立 Raw 页签——
    // 用「按钮序列」粗检：Body 与 Headers 之间不应插入 Raw
    expect(markup).not.toMatch(/>Body<\/button><button[^>]*>Raw</);
  });
});
```

- [ ] **Step 2: 跑 UI 测试确认失败**

Run: `cd web && npm test -- result-pane-ui.test.tsx`

Expected: FAIL（`./ResultPane` 不存在）

- [ ] **Step 3: `git mv` 并实现骨架**

```bash
git mv web/src/ResponsePane.tsx web/src/ResultPane.tsx
```

将 `web/src/ResultPane.tsx` 替换为（完整文件）：

```tsx
import { useState } from "react";
import {
  msLabel,
  prettyBody,
  rawCombinedDump,
  sizeLabel,
} from "./result-pane";
import type { Result } from "./types";

interface Props {
  result: Result | null;
}

type PrimaryTab = "request" | "response" | "raw";
type ResponseTab = "body" | "headers" | "timeline";

export default function ResultPane({ result }: Props) {
  const [primary, setPrimary] = useState<PrimaryTab>("response");
  const [responseTab, setResponseTab] = useState<ResponseTab>("body");

  if (!result) {
    return (
      <section className="response">
        <div className="empty-state">
          <p className="empty-title">还没有响应</p>
          <p className="empty-hint">填 URL，按 Send 或 Ctrl+Enter</p>
        </div>
      </section>
    );
  }

  const isHttp = result.errorClass === "http";

  return (
    <section
      className={isHttp ? "response" : "response response-error-state"}
    >
      <div className="response-meta">
        {isHttp ? (
          <>
            <span
              className={`status status-${Math.floor(result.status / 100)}xx`}
            >
              {result.status} {result.statusText}
            </span>
            <span>{msLabel(result.timings.totalMs)} ms</span>
            <span title="响应线上字节（解压前）">
              响应 {sizeLabel(result.responseSize)}
              {result.body &&
              result.body.length !== result.responseSize
                ? ` · 正文 ${sizeLabel(result.body.length)}`
                : ""}
              {result.truncated ? "（截断）" : ""}
            </span>
            {result.errorMessage ? (
              <div className="error">{result.errorMessage}</div>
            ) : null}
            {result.historyError ? (
              <div className="error">
                历史记录未写入：{result.historyError}
              </div>
            ) : null}
          </>
        ) : (
          <div className="error">
            <strong>{result.errorClass || "error"}</strong>
            {result.errorMessage ? <div>{result.errorMessage}</div> : null}
            {result.historyError ? (
              <div>历史记录未写入：{result.historyError}</div>
            ) : null}
            {result.missingVars && result.missingVars.length > 0 ? (
              <div>缺少变量：{result.missingVars.join(", ")}</div>
            ) : null}
          </div>
        )}
      </div>

      <div className="tabs">
        <button
          type="button"
          className={primary === "request" ? "tab active" : "tab"}
          onClick={() => setPrimary("request")}
        >
          Request
        </button>
        <button
          type="button"
          className={primary === "response" ? "tab active" : "tab"}
          onClick={() => setPrimary("response")}
        >
          Response
        </button>
        <button
          type="button"
          className={primary === "raw" ? "tab active" : "tab"}
          onClick={() => setPrimary("raw")}
        >
          Raw
        </button>
      </div>

      <div className="response-body">
        {primary === "request" && (
          <p className="muted">Request 内容见后续任务</p>
        )}

        {primary === "response" && (
          <>
            <div className="tabs tabs-secondary">
              <button
                type="button"
                className={responseTab === "body" ? "tab active" : "tab"}
                onClick={() => setResponseTab("body")}
              >
                Body
              </button>
              <button
                type="button"
                className={
                  responseTab === "headers" ? "tab active" : "tab"
                }
                onClick={() => setResponseTab("headers")}
              >
                Headers
              </button>
              <button
                type="button"
                className={
                  responseTab === "timeline" ? "tab active" : "tab"
                }
                onClick={() => setResponseTab("timeline")}
              >
                Timeline
              </button>
            </div>
            {responseTab === "body" && (
              <pre className="dump">{prettyBody(result.body)}</pre>
            )}
            {responseTab === "headers" && (
              <pre className="dump">
                {Object.entries(result.headers ?? {})
                  .map(
                    ([k, v]) =>
                      `${k}: ${Array.isArray(v) ? v.join(", ") : v}`,
                  )
                  .join("\n")}
              </pre>
            )}
            {responseTab === "timeline" && (
              <div className="timeline">
                <ul className="timing-list">
                  <li>dnsMs: {msLabel(result.timings.dnsMs)}</li>
                  <li>connectMs: {msLabel(result.timings.connectMs)}</li>
                  <li>tlsMs: {msLabel(result.timings.tlsMs)}</li>
                  <li>
                    firstByteMs: {msLabel(result.timings.firstByteMs)}
                  </li>
                  <li>totalMs: {msLabel(result.timings.totalMs)}</li>
                </ul>
                <h3>redirects</h3>
                {(result.redirects ?? []).length === 0 ? (
                  <p className="muted">无重定向</p>
                ) : (
                  <ol>
                    {result.redirects.map((h, i) => (
                      <li key={i}>
                        {h.status} {h.url} → {h.location}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </>
        )}

        {primary === "raw" && (
          <pre className="dump">
            {rawCombinedDump(result.requestDump, result.responseDump)}
          </pre>
        )}
      </div>
    </section>
  );
}
```

更新 `web/src/App.tsx`：

- `import ResultPane from "./ResultPane";`（替换 `ResponsePane`）
- `<ResultPane result={result} />`（替换 `<ResponsePane … />`）

在 `web/src/styles.css` 的 `.tab:hover:not(.active)` 规则后追加：

```css
.tabs-secondary {
  margin: -0.6rem -0.6rem 0.6rem;
  padding: 0 0.6rem;
}

.tabs-secondary .tab {
  flex: 0 1 auto;
  padding: 0.35rem 0.55rem;
  font-size: 0.82rem;
}
```

（二级页签在 `.response-body` 内，负 margin 让底边线贴齐内容区顶；若视觉不佳，实现时可改为 `margin: 0 0 0.6rem` 且去掉负值——以可读为准。）

- [ ] **Step 4: 跑测试**

Run: `cd web && npm test -- result-pane-ui.test.tsx`

Expected: PASS

再跑全量：`cd web && npm test`

Expected: PASS（无残留 `ResponsePane` 引用）

- [ ] **Step 5: Commit**

```bash
git add web/src/ResultPane.tsx web/src/App.tsx web/src/result-pane-ui.test.tsx web/src/styles.css
git add -u web/src/ResponsePane.tsx
git commit -m "$(cat <<'EOF'
feat: 结果面板改名并拆出 Request/Response/Raw 一级页签。

EOF
)"
```

---

### Task 3: `RequestResult`（Overview / Query / Headers / Body）

**Files:**
- Modify: `web/src/ResultPane.tsx`（实现并导出 `RequestResult`，替换占位）
- Modify: `web/src/result-pane-ui.test.tsx`（追加 Request 测例）
- Modify: `web/src/styles.css`（Overview）

**Interfaces:**
- Produces:
  - `export function RequestResult(props: { prepared: HttpRequest | null | undefined; requestSize: number }): JSX.Element`
  - Request 二级默认 `"overview"`
- Consumes: `normalizePrepared` / `sizeLabel` / `prettyBody` from `./result-pane`；`methodClass` from `./UrlBar`

- [ ] **Step 1: 写失败测试（追加到 `result-pane-ui.test.tsx`）**

```tsx
import ResultPane, { RequestResult } from "./ResultPane";

describe("RequestResult", () => {
  it("shows overview method, url, request size, and expanded hint", () => {
    const markup = renderToStaticMarkup(
      <RequestResult
        prepared={samplePrepared()}
        requestSize={11}
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
      />,
    );
    expect(markup).toContain(">Query<");
    expect(markup).toContain("请求 0 B");
  });
});

describe("ResultPane raw dump", () => {
  it("exposes rawCombinedDump text when primary would be raw — test via helper already; assert RequestResult wired placeholder gone", () => {
    // 默认 primary=response，不渲染 Raw 内容；用 RequestResult 已覆盖请求侧。
    // 额外：缺 prepared 时 RequestResult 不抛错
    const markup = renderToStaticMarkup(
      <RequestResult prepared={undefined} requestSize={0} />,
    );
    expect(markup).toContain("变量已展开");
    expect(markup).toContain("请求 0 B");
  });
});
```

把文件顶部的 import 改为同时引入 `RequestResult`。删除「Request 内容见后续任务」相关断言（若有）。

另追加一条：用纯函数确认 Raw 拼接仍被面板使用——在同文件增加：

```tsx
import { rawCombinedDump } from "./result-pane";

describe("Raw dump contract", () => {
  it("matches helper used by ResultPane", () => {
    expect(rawCombinedDump("A", "B")).toContain("----------");
  });
});
```

（Raw 一级内容在默认页签下不可见；契约由 helper + Task 2 中已渲染的 Raw **按钮** 覆盖。若审查要求可见 dump 文本，可为 `ResultPane` 增加仅测试用的可选 prop——**本次不做**，保持 Props 仅 `result`。）

- [ ] **Step 2: 跑测试确认失败**

Run: `cd web && npm test -- result-pane-ui.test.tsx`

Expected: FAIL（`RequestResult` 非导出）

- [ ] **Step 3: 实现 `RequestResult` 并接入**

在 `ResultPane.tsx` 顶部增加 import：

```ts
import { methodClass } from "./UrlBar";
import {
  msLabel,
  normalizePrepared,
  prettyBody,
  rawCombinedDump,
  sizeLabel,
} from "./result-pane";
import type { HttpRequest, Result } from "./types";
```

在 default export **之前**加入（完整）：

```tsx
type RequestTab = "overview" | "query" | "headers" | "body";

function ReadonlyPairs({
  record,
}: {
  record: Record<string, string>;
}) {
  const entries = Object.entries(record);
  if (entries.length === 0) {
    return <p className="muted">无</p>;
  }
  return (
    <table className="kv-table">
      <thead>
        <tr>
          <th>键</th>
          <th>值</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([key, value]) => (
          <tr key={key}>
            <td>{key}</td>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RequestResult({
  prepared,
  requestSize,
}: {
  prepared: HttpRequest | null | undefined;
  requestSize: number;
}) {
  const [tab, setTab] = useState<RequestTab>("overview");
  const req = normalizePrepared(prepared);

  return (
    <div className="request-result">
      <div className="tabs tabs-secondary">
        <button
          type="button"
          className={tab === "overview" ? "tab active" : "tab"}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={tab === "query" ? "tab active" : "tab"}
          onClick={() => setTab("query")}
        >
          Query
        </button>
        <button
          type="button"
          className={tab === "headers" ? "tab active" : "tab"}
          onClick={() => setTab("headers")}
        >
          Headers
        </button>
        <button
          type="button"
          className={tab === "body" ? "tab active" : "tab"}
          onClick={() => setTab("body")}
        >
          Body
        </button>
      </div>

      {tab === "overview" && (
        <div className="request-overview">
          <div className="request-overview-line">
            <span
              className={`method method-${methodClass(req.method)}`}
            >
              {req.method || "—"}
            </span>{" "}
            <span className="request-overview-url">{req.url || "—"}</span>
          </div>
          <div>请求 {sizeLabel(requestSize)}</div>
          <p className="muted">变量已展开</p>
        </div>
      )}

      {tab === "query" && <ReadonlyPairs record={req.query} />}
      {tab === "headers" && <ReadonlyPairs record={req.headers} />}

      {tab === "body" && (
        <div className="request-body-view">
          <p className="muted">类型：{req.body.type}</p>
          {req.body.type === "none" && (
            <p className="muted">无正文</p>
          )}
          {req.body.type === "json" && (
            <pre className="dump">
              {prettyBody(
                typeof req.body.content === "string"
                  ? req.body.content
                  : JSON.stringify(req.body.content ?? {}),
              )}
            </pre>
          )}
          {req.body.type === "raw" && (
            <pre className="dump">
              {typeof req.body.content === "string"
                ? req.body.content
                : ""}
            </pre>
          )}
          {req.body.type === "form" && (
            <ReadonlyPairs
              record={
                req.body.content && typeof req.body.content === "object"
                  ? req.body.content
                  : {}
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
```

在 `ResultPane` 中把：

```tsx
{primary === "request" && (
  <p className="muted">Request 内容见后续任务</p>
)}
```

换成：

```tsx
{primary === "request" && (
  <RequestResult
    prepared={result.prepared}
    requestSize={result.requestSize ?? 0}
  />
)}
```

在 `styles.css` 追加：

```css
.request-overview {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.request-overview-line {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: baseline;
}

.request-overview-url {
  font-family: var(--mono);
  font-size: 0.82rem;
  word-break: break-all;
}

.request-overview .method {
  font-weight: 700;
  font-size: 0.82rem;
}
```

- [ ] **Step 4: 跑测试**

Run: `cd web && npm test -- result-pane-ui.test.tsx`

Expected: PASS

Run: `cd web && npm test`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/ResultPane.tsx web/src/result-pane-ui.test.tsx web/src/styles.css
git commit -m "$(cat <<'EOF'
feat: 结果面板 Request 页展示 prepared Overview/Query/Headers/Body。

EOF
)"
```

---

### Task 4: README + 嵌入构建

**Files:**
- Modify: `README.md`（「界面」一节）
- Modify: `internal/server/ui/`（`npm run build` 产物）

**Interfaces:**
- 无新代码接口

- [ ] **Step 1: 更新 README「界面」**

将含「响应栏为状态码、耗时、体积，以及 `Body | Headers | Raw | Timeline`」的句子改为（保持前后文不变，只替换右栏描述）：

原文片段：

```
请求栏为 `Query | Headers | Body`；响应栏为状态码、耗时、体积，以及 `Body | Headers | Raw | Timeline`。
```

改为：

```
请求栏为 `Query | Headers | Body`；右侧结果栏 meta 为状态码、总耗时、响应体积，一级页签为 `Request | Response | Raw`。Request 二级为 `Overview | Query | Headers | Body`（只读变量展开后的请求，Overview 含请求体积）；Response 二级为 `Body | Headers | Timeline`；Raw 为请求 dump 与响应 dump。
```

- [ ] **Step 2: 构建嵌入 UI**

Run: `cd web && npm run build`

Expected: `tsc` 无报错；`internal/server/ui/` 下 assets 哈希更新。

- [ ] **Step 3: 全量前端测试再确认**

Run: `cd web && npm test`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add README.md internal/server/ui
git commit -m "$(cat <<'EOF'
docs: README 说明结果栏 Request/Response/Raw；更新嵌入 UI。

EOF
)"
```

---

## Self-Review (plan author)

| 规格项 | 任务 |
|--------|------|
| 一级 Request \| Response \| Raw | Task 2 |
| Request Overview/Query/Headers/Body + prepared | Task 3 |
| meta 无请求体积；请求体积在 Overview | Task 2 + 3 |
| Response Body/Headers/Timeline，无嵌套 Raw | Task 2 |
| Raw 拼接 + 空→「无」 | Task 1 helper + Task 2 使用 |
| 发送不抢页签 / 新 result 不重置 | Task 2 `useState` 初始值，无 effect 重置 |
| 空状态不变 | Task 2 |
| 缺 prepared 容错 | Task 1 `normalizePrepared` + Task 3 |
| 改名 ResultPane、保留 `.response*` class | Task 2 |
| README + embed build | Task 4 |
| 不改 Go / 无新 npm | Global Constraints |

无 TBD/TODO 占位；类型名与 `Result.prepared` / `requestSize` 一致。
