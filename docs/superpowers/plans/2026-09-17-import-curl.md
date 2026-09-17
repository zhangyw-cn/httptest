# 导入 curl Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 UrlBar 最右侧「⋯」菜单提供「导入 curl」与「导出 curl」：导入用纯前端 `parseCurl` 写入当前草稿；导出仍走现有 prepare + ExportCurlDialog；移除 Send split。

**Architecture:** 前端 allowlist 解析（去注释、续行、shell 分词、已知 flag 映射）；未知/`--resolve`/粘连短选项整次失败。`ImportCurlDialog` 粘贴后应用；`UrlBar` 用溢出菜单替代 Send 旁下拉。无 Go API、无新 npm 包。

**Tech Stack:** React + TypeScript + Vite + 手写 CSS；Vitest；现有 Go embed UI。

## Global Constraints

- 规格：`docs/superpowers/specs/2026-09-17-import-curl-design.md`
- 落点：仅当前草稿；保留 `name`；除 `name` 外整体替换 method/url/query/headers/body/timeout
- 无 `--max-time`/`-m` 时结果不带 `timeout`（清除草稿原 timeout）
- 不支持 flag 整次失败；`-L`/`-v` 等忽略；`-A`/`-e` 映头；`--resolve` 失败
- 第一个 token 必须字面量 `curl`；不支持粘连短选项与 `-m30`
- 界面中文；不新增 npm 包；改前端后 `cd web && npm run build` 更新 embed

## File Structure

| 路径 | 职责 |
|------|------|
| `web/src/curl.ts` | 新增 `parseCurl`、`applyParsedCurl`、分词与 flag 表（保留现有 `formatCurl`） |
| `web/src/curl.test.ts` | 追加 parseCurl / applyParsedCurl 测例（保留 formatCurl 测例） |
| `web/src/ImportCurlDialog.tsx` | 粘贴框 + 应用/取消 + 错误区 |
| `web/src/ImportCurlDialog.test.tsx` | 对话框渲染与失败/成功行为 |
| `web/src/UrlBar.tsx` | 去 send-split；最右侧「⋯」菜单；`onImportCurl` |
| `web/src/UrlBar.test.tsx` | 溢出菜单测例 |
| `web/src/App.tsx` | 导入对话框状态；应用写草稿 |
| `web/src/work-layout.test.tsx` | UrlBar 新 props |
| `web/src/styles.css` | 溢出菜单样式；可删或复用 send-split 样式 |
| `README.md` | 界面节：⋯ 导入/导出 |

---

### Task 1: parseCurl 纯函数

**Files:**
- Modify: `web/src/curl.ts`
- Modify: `web/src/curl.test.ts`

**Interfaces:**
- Consumes: `HttpRequest`、`RequestBody` from `./types`
- Produces:
  - `export type ParsedCurlRequest = Omit<HttpRequest, "name">`（可有可选 `timeout`）
  - `export type ParseCurlResult = { ok: true; request: ParsedCurlRequest } | { ok: false; error: string }`
  - `export function parseCurl(input: string): ParseCurlResult`
  - `export function applyParsedCurl(draft: HttpRequest, parsed: ParsedCurlRequest): HttpRequest` — 保留 `draft.name`；无 `parsed.timeout` 时不设 timeout

- [ ] **Step 1: 写失败测试（核心行为）**

在 `web/src/curl.test.ts` 追加（保留现有 formatCurl 测例）：

```ts
import { applyParsedCurl, parseCurl } from "./curl";
import type { HttpRequest } from "./types";

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
```

- [ ] **Step 2: 跑测确认失败**

Run: `cd web && npx vitest run src/curl.test.ts`

Expected: FAIL（`parseCurl` / `applyParsedCurl` 未定义）

- [ ] **Step 3: 实现 parseCurl 与 applyParsedCurl**

在 `web/src/curl.ts` 末尾追加（保留现有导出函数）。实现要点：

```ts
import type { HttpRequest, RequestBody } from "./types";

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

function needArg(flag: string, tokens: string[], i: number): string | ParseCurlResult {
  if (i + 1 >= tokens.length) return fail(`${flag} 缺少参数`);
  return tokens[i + 1]!;
}

function parseHeaderLine(raw: string): { name: string; value: string } | null {
  const idx = raw.indexOf(":");
  if (idx <= 0) return null;
  return { name: raw.slice(0, idx).trim(), value: raw.slice(idx + 1).trim() };
}

function setHeader(headers: Record<string, string>, name: string, value: string) {
  const existing = Object.keys(headers).find(
    (k) => k.toLowerCase() === name.toLowerCase(),
  );
  if (existing) delete headers[existing];
  headers[name] = value;
}

function splitUrl(raw: string): { url: string; query: Record<string, string> } | { error: string } {
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
```

`parseCurl` 主体逻辑（实现完整版）：

1. `preprocessCurlInput` → `tokenizeShell`；失败则返回 error  
2. tokens[0] !== `"curl"` → 失败  
3. 状态：`method?: string`、`methodExplicit=false`、`headers={}`、`dataChunks: string[]`、`useGet=false`、`timeout?: string`、`urls: string[]`  
4. 从 i=1 扫描：
   - 若 token 以 `-` 开头：
     - 若匹配 `^-[^-].{1,}$`（单横线且去掉 `-` 后长度>1，如 `-vL`、`-m30`）→ 失败「不支持粘连短选项」
     - allowlist 分支：
       - `-X`/`--request`：读参数，toupper，不在 METHODS → 失败；设 method，methodExplicit=true
       - `-I`/`--head`：method=HEAD，methodExplicit=true
       - `-H`/`--header`：parseHeaderLine，失败则报错；setHeader
       - `-A`/`--user-agent`：setHeader User-Agent
       - `-e`/`--referer`：setHeader Referer
       - `-d`/`--data`/`--data-raw`/`--data-binary`：push data
       - `-G`/`--get`：useGet=true
       - `--max-time`/`-m`：读参数，`Number` 有限且 ≥0，否则失败；`timeout=\`${n}s\``
       - 忽略且无参：`-L`/`--location`、`--compressed`、`-v`/`--verbose`、`-s`/`--silent`、`-S`/`--show-error`、`-i`/`--include`、`-O`/`--remote-name`、`-#`/`--progress-bar`、`-f`/`--fail`、`--no-progress-meter`
       - 忽略且吞一参：`-o`/`--output`
       - 否则：`fail(\`不支持的选项: ${token}\`)`（`--resolve` 等走这里，error 含 flag 名）
   - 否则视为 URL：push urls  
5. urls.length !== 1 → 失败  
6. splitUrl；合并 URL query  
7. 若 useGet 且有 data：把 `dataChunks.join('&')` 用 URLSearchParams 并入 query；清空 data；若 !methodExplicit → method=GET  
8. 若有 data 且 !methodExplicit → method=POST；若无 data 且 !methodExplicit → method=GET  
9. method 默认已设；再校验 METHODS  
10. 若 (method GET|HEAD) 且 dataChunks.length>0 → 失败  
11. Body：无 data → none；有 Content-Type json → json；urlencoded → form（URLSearchParams→map，失败则 raw）；否则 raw。多段 data 用 `&` 拼接（与 curl 多 `-d` 行为近似）  
12. 返回 `{ ok:true, request:{ method, url, query, headers, body, ...(timeout?{timeout}:{}) } }`

```ts
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
  if (parsed.timeout) next.timeout = parsed.timeout;
  return next;
}
```

忽略表与映射表以规格 §5.2–5.3 为准；error 文案中文。

- [ ] **Step 4: 跑测确认通过**

Run: `cd web && npx vitest run src/curl.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/curl.ts web/src/curl.test.ts
git commit -m "$(cat <<'EOF'
feat(web): parse curl commands into request drafts.

EOF
)"
```

---

### Task 2: ImportCurlDialog

**Files:**
- Create: `web/src/ImportCurlDialog.tsx`
- Create: `web/src/ImportCurlDialog.test.tsx`
- Modify: `web/src/styles.css`（导入对话框 textarea 样式，可复用 `.export-curl-dialog` 或新增 `.import-curl-dialog`）

**Interfaces:**
- Consumes: `parseCurl` from `./curl`；`ParsedCurlRequest`  
- Produces: `ImportCurlDialog` props `{ onApply: (parsed: ParsedCurlRequest) => void; onClose: () => void }`

- [ ] **Step 1: 写失败测试**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ImportCurlDialog from "./ImportCurlDialog";

describe("ImportCurlDialog", () => {
  it("renders title, textarea, apply and cancel", () => {
    const markup = renderToStaticMarkup(
      <ImportCurlDialog onApply={vi.fn()} onClose={vi.fn()} />,
    );
    expect(markup).toContain("导入 curl");
    expect(markup).toContain("应用");
    expect(markup).toContain("取消");
    expect(markup).toContain("<textarea");
  });
});
```

（交互：解析失败留窗 / 成功 onApply — 若项目无 `@testing-library/react`，用导出纯函数测解析即可；对话框内「应用」逻辑抽成：

```ts
export function tryApplyCurl(
  text: string,
): { ok: true; request: ParsedCurlRequest } | { ok: false; error: string } {
  return parseCurl(text);
}
```

在对话框组件文件中 re-export 或直接调用 `parseCurl`。追加测例：

```ts
it("tryApplyCurl returns error for bad input", () => {
  const r = tryApplyCurl("not curl");
  expect(r.ok).toBe(false);
});
```

若不愿 export `tryApplyCurl`，则仅测静态 markup；`parseCurl` 已在 Task 1 覆盖失败路径。v1 **允许只测 markup + 依赖 Task 1**；组件内直接调 `parseCurl`。

- [ ] **Step 2: 跑测确认失败**

Run: `cd web && npx vitest run src/ImportCurlDialog.test.tsx`

Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现对话框**

`web/src/ImportCurlDialog.tsx`：

```tsx
import { useState } from "react";
import { parseCurl, type ParsedCurlRequest } from "./curl";

interface Props {
  onApply: (parsed: ParsedCurlRequest) => void;
  onClose: () => void;
}

export default function ImportCurlDialog({ onApply, onClose }: Props) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function apply() {
    const result = parseCurl(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onApply(result.request);
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="dialog import-curl-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-curl-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="import-curl-title">导入 curl</h2>
        <textarea
          className="curl-import-input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          rows={12}
          spellCheck={false}
          placeholder="粘贴 curl 命令…"
        />
        {error ? <p className="error">{error}</p> : null}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={apply}>
            应用
          </button>
        </div>
      </div>
    </div>
  );
}
```

CSS（`styles.css`）：

```css
.import-curl-dialog .curl-import-input {
  width: 100%;
  min-height: 12rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85rem;
  padding: 0.5rem;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  resize: vertical;
}
```

- [ ] **Step 4: 跑测确认通过**

Run: `cd web && npx vitest run src/ImportCurlDialog.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/ImportCurlDialog.tsx web/src/ImportCurlDialog.test.tsx web/src/styles.css
git commit -m "$(cat <<'EOF'
feat(web): add ImportCurlDialog for pasting curl.

EOF
)"
```

---

### Task 3: UrlBar「⋯」溢出菜单

**Files:**
- Modify: `web/src/UrlBar.tsx`
- Modify: `web/src/UrlBar.test.tsx`
- Modify: `web/src/styles.css`（将 `.send-split*` 改为 `.urlbar-more*` 或复用 panel 样式挂到右侧）
- Modify: `web/src/work-layout.test.tsx`（补 `onImportCurl`）

**Interfaces:**
- Consumes: 现有 props + exporting  
- Produces: Props 增加 `onImportCurl: () => void`；保留 `onExportCurl`；去掉 send-split UI

- [ ] **Step 1: 改写 UrlBar 测试**

替换 `UrlBar.test.tsx` 中「export curl」相关用例为：

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import UrlBar, { sendMenuBusy } from "./UrlBar";
import { defaultDraft } from "./request";

describe("sendMenuBusy", () => {
  it("is busy when sending or exporting", () => {
    expect(sendMenuBusy(false, false)).toBe(false);
    expect(sendMenuBusy(true, false)).toBe(true);
    expect(sendMenuBusy(false, true)).toBe(true);
  });
});

describe("UrlBar more menu", () => {
  const base = {
    draft: defaultDraft(),
    dirty: false,
    sending: false,
    saving: false,
    onChange: vi.fn(),
    onSend: vi.fn(),
    onStop: vi.fn(),
    onSave: vi.fn(),
    onImportCurl: vi.fn(),
    onExportCurl: vi.fn(),
  };

  it("renders overflow control and menu labels", () => {
    const markup = renderToStaticMarkup(<UrlBar {...base} />);
    expect(markup).toContain('aria-label="更多"');
    expect(markup).toContain("导入 curl");
    expect(markup).toContain("导出 curl");
    expect(markup).not.toContain("send-split");
  });

  it("disables more menu while sending", () => {
    const markup = renderToStaticMarkup(<UrlBar {...base} sending={true} />);
    expect(markup).toMatch(/aria-label="更多"[\s\S]*disabled|disabled[\s\S]*aria-label="更多"/);
  });

  it("disables more menu while exporting", () => {
    const markup = renderToStaticMarkup(
      <UrlBar {...base} exporting={true} />,
    );
    expect(markup).toMatch(/aria-label="更多"[\s\S]*disabled|disabled[\s\S]*aria-label="更多"/);
  });
});
```

`work-layout.test.tsx` 的 UrlBar 调用增加 `onImportCurl={vi.fn()}`。

- [ ] **Step 2: 跑测确认失败/需改实现**

Run: `cd web && npx vitest run src/UrlBar.test.tsx src/work-layout.test.tsx`

Expected: FAIL（缺 onImportCurl / 仍有 send-split）

- [ ] **Step 3: 重写 UrlBar 布局**

目标结构：

```tsx
<div className="urlbar">
  <select className={...}>...</select>
  <input className="url" ... />
  {dirty && <span className="dirty">未保存</span>}
  <button type="button" className="btn btn-primary" onClick={onSend} disabled={busy}>
    Send
  </button>
  <button type="button" className="btn" onClick={onStop} disabled={!sending}>
    Stop
  </button>
  <button type="button" className="btn" onClick={onSave} disabled={saving}>
    保存
  </button>
  <div className="urlbar-more" ref={menuRef}>
    <button
      type="button"
      className="btn urlbar-more-toggle"
      disabled={busy}
      aria-label="更多"
      aria-expanded={menuOpen}
      aria-haspopup="menu"
      onClick={() => setMenuOpen((o) => !o)}
    >
      ⋯
    </button>
    <div
      className={`urlbar-more-panel${menuOpen ? " urlbar-more-panel-open" : ""}`}
      role="menu"
    >
      <button type="button" role="menuitem" disabled={busy} onClick={() => { onImportCurl(); setMenuOpen(false); }}>
        导入 curl
      </button>
      <button type="button" role="menuitem" disabled={busy} onClick={() => { onExportCurl(); setMenuOpen(false); }}>
        导出 curl
      </button>
    </div>
  </div>
</div>
```

Props 增加 `onImportCurl: () => void`。保留 `sendMenuBusy` 与 exporting 行为；document mousedown / Escape 关菜单逻辑与现有一致。

CSS：把 `.send-menu*` 规则改名为 `.urlbar-more*`（panel 右对齐）；删除 `.send-split` / `.send-split-main` / `.send-menu-toggle` 的 split 圆角特例，toggle 用普通 `btn` 尺寸，字号略大以显示「⋯」。

- [ ] **Step 4: 跑测确认通过**

Run: `cd web && npx vitest run src/UrlBar.test.tsx src/work-layout.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/UrlBar.tsx web/src/UrlBar.test.tsx web/src/work-layout.test.tsx web/src/styles.css
git commit -m "$(cat <<'EOF'
feat(web): move curl import/export into UrlBar overflow menu.

EOF
)"
```

---

### Task 4: App 接线 + README + embed

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `README.md`
- Rebuild: `web/` → `internal/server/ui/`

**Interfaces:**
- Consumes: `ImportCurlDialog`、`applyParsedCurl`、`UrlBar.onImportCurl`
- Produces: `importCurlOpen` 状态；应用时 `setDraft(applyParsedCurl(draft, parsed))` 并关对话框（dirty 走现有 draft 变更路径）

- [ ] **Step 1: 接线 App**

1. `import ImportCurlDialog from "./ImportCurlDialog"`  
2. `import { applyParsedCurl } from "./curl"`  
3. `const [importCurlOpen, setImportCurlOpen] = useState(false)`  
4. UrlBar：`onImportCurl={() => setImportCurlOpen(true)}`（集合/历史且非 sending 时 UrlBar 已禁用 busy）  
5. 渲染：

```tsx
{importCurlOpen && (
  <ImportCurlDialog
    onClose={() => setImportCurlOpen(false)}
    onApply={(parsed) => {
      setDraft((d) => applyParsedCurl(d, parsed));
      setImportCurlOpen(false);
    }}
  />
)}
```

确认 `setDraft` 签名支持 updater；若项目用 `setDraft(next)` 而非函数式，则：

```tsx
onApply={(parsed) => {
  setDraft(applyParsedCurl(draftRef.current, parsed));
  setImportCurlOpen(false);
}}
```

（优先 `draftRef.current`，与 onExportCurl 一致。）

- [ ] **Step 2: 更新 README**

在「界面」段，将：

> Send 右侧菜单可「导出 curl」（功能选项 + 预览 + 复制到剪贴板）

替换为：

> UrlBar 最右侧「⋯」可「导入 curl」（粘贴命令写入当前草稿；不支持的选项整次失败）与「导出 curl」（功能选项 + 预览 + 复制到剪贴板）

- [ ] **Step 3: 跑前端全量测 + 构建 embed**

Run:

```bash
cd web && npx vitest run && npm run build
```

Expected: 全部 PASS；`internal/server/ui/` 更新。

可选：`go test ./...` 确认无破。

- [ ] **Step 4: Commit**

```bash
git add web/src/App.tsx README.md web/src/styles.css internal/server/ui/
git commit -m "$(cat <<'EOF'
feat: wire curl import dialog and refresh UI embed.

EOF
)"
```

---

## Plan Self-Review

| 规格项 | 任务 |
|--------|------|
| ⋯ 菜单导入/导出；去 Send split | Task 3–4 |
| 只写草稿、保留 name、整体替换字段 | Task 1 `applyParsedCurl` + Task 4 |
| allowlist / 忽略 / `--resolve` 失败 / `-A` `-e` / `--max-time` | Task 1 |
| ImportCurlDialog 失败留窗 | Task 2 |
| 导出 prepare 不变 | Task 3–4 仅改入口 |
| README | Task 4 |
| 无新 API / 无新 npm | 全程 |

无 TBD；`ParsedCurlRequest` / `parseCurl` / `applyParsedCurl` / `onImportCurl` 命名前后一致。
