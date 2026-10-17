# Export Curl Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让导出的 curl 按 80 列收拢短选项，对话框改为左侧选项、右侧预览，并提供默认隐藏的参数说明栏。

**Architecture:** `packShortOptionLines` 只负责短选项折行。`buildCurlPieces` 不导出，同时供给 `formatCurl`（仍返回字符串）和 `explainCurl`（返回 `{ text, explanation }[]`）。`ExportCurlDialog` 用这两份结果排版，说明开关只存在于组件 state。

**Tech Stack:** 现有 React + TypeScript + Vite + 手写 CSS。测试用 Vitest（`environment: "node"`，对话框用 `renderToStaticMarkup`）。不新增 npm 包。

## Global Constraints

- 规格：`docs/superpowers/specs/2026-10-17-export-curl-panel-design.md`。准备流程、勾选语义和 curl 子集仍以 `docs/superpowers/specs/2026-09-17-export-curl-design.md` 为准。
- `formatCurl` 仍只返回 `string`。`explainCurl` 接收同一份输入，返回 `{ text, explanation }[]`。`buildCurlPieces` 不导出。`packShortOptionLines` 要导出，供宽度不是 80 的单测调用。
- 短选项顺序是 `-L`、`--max-redirs N`、`-k`、`--max-time N`。`--resolve`、每个 `-H`、`--data-raw` 各自成行。`-X` 与 URL 同一行。列宽按 JavaScript 字符串长度，上限 80，含行首前缀和行尾 ` \`。只在完整短选项之间折行。
- 说明是固定句子：`-L`「跟随重定向」；`--max-redirs`「重定向次数上限，单位为次」；`-k`「跳过 TLS 证书校验」；`--max-time`「最长等待时间，单位为秒」；`--resolve`「将主机的端口解析到指定 IP」；`-X`「HTTP 方法」；URL「请求地址，查询参数已写在 URL 里」；`-H`「请求头」；`--data-raw`「请求体原文」。句子里不填当前值。
- 说明栏默认关闭，不写入本地存储。左侧去掉「当前 Hosts 未命中此主机」和「使用请求 timeout（默认 30000ms）」。Hosts 未命中仍禁用对应勾选；未跟随重定向仍禁用「限制最大重定向」。
- 视口宽度至少 `64rem` 且说明打开时，对话框 `min(58rem, 92vw)`，三列 `11rem`、`minmax(0, 1fr)`、`16rem`。其余情况对话框 `min(40rem, 92vw)`；视口小于 `64rem` 时改为一列。导入对话框仍是 `min(560px, 92vw)`。
- 不改 `internal/`、`POST /api/prepare`、`parseCurl`，不跑会改写 `internal/server/ui/` 的 `npm run build`，不加 npm 包。
- 每个提交只 `git add` 该任务列出的文件。

## File Structure

- Modify: `web/src/curl.ts` — 导出 `packShortOptionLines` 与 `explainCurl`。`formatCurl` 改为消费内部片段。`parseCurl` 不动。
- Modify: `web/src/curl.test.ts` — 折行、精确命令、说明文案、续行不变量。
- Modify: `web/src/ExportCurlDialog.tsx` — 两栏/三栏和说明开关。
- Modify: `web/src/ExportCurlDialog.test.tsx` — 默认标记不再含旧说明和说明区域。
- Modify: `web/src/styles.css` — 导出对话框宽度、分栏、预览滚动。删除 `.curl-option-hint` 和不再使用的 `.curl-options-legend`。
- Modify: `README.md` — 「界面」里导出 curl 那一句。

---

### Task 1: 短选项折行

**Files:**
- Modify: `web/src/curl.ts`（插在 `export function formatCurl` 之前）
- Test: `web/src/curl.test.ts`

**Interfaces:**
- Consumes: 无。
- Produces: `export function packShortOptionLines(parts: string[], width: number): string[]`。空数组返回 `[]`。每一行都含行尾的 ` \`。第一行前缀是 `curl`，续行前缀是两个空格。

- [ ] **Step 1: Write the failing test**

在 `web/src/curl.test.ts` 的导入里加上 `packShortOptionLines`。在文件末尾追加：

```ts
describe("packShortOptionLines", () => {
  it("wraps between complete options at the given width", () => {
    expect(packShortOptionLines(["-L", "--max-redirs 10", "-k"], 20)).toEqual([
      "curl -L \\",
      "  --max-redirs 10 \\",
      "  -k \\",
    ]);
  });

  it("keeps one over-long option on its own line", () => {
    expect(packShortOptionLines(["--max-redirs 10"], 10)).toEqual([
      "curl --max-redirs 10 \\",
    ]);
  });

  it("returns no lines when there are no short options", () => {
    expect(packShortOptionLines([], 80)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/curl.test.ts -t packShortOptionLines`

Expected: FAIL，`packShortOptionLines` 未导出。

- [ ] **Step 3: Write minimal implementation**

把下面的函数插到 `web/src/curl.ts` 里 `export function formatCurl` 之前：

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/curl.test.ts -t packShortOptionLines`

Expected: PASS，3 tests。

- [ ] **Step 5: Commit**

```bash
git add web/src/curl.ts web/src/curl.test.ts
git commit -m "$(cat <<'EOF'
feat(web): wrap exported curl short options by width

EOF
)"
```

---

### Task 2: formatCurl 与 explainCurl

**Files:**
- Modify: `web/src/curl.ts`（替换现有 `formatCurl`，约 76–142 行；保留 Task 1 的 `packShortOptionLines`）
- Test: `web/src/curl.test.ts`

**Interfaces:**
- Consumes: `packShortOptionLines(parts, width)`，以及现有的 `shellSingleQuote`、`resolveArg`、`defaultCurlOptions`、`effectiveCurlOptions`。
- Produces:
  - `export interface CurlExplanation { text: string; explanation: string }`
  - `export function explainCurl(input: { prepared: HttpRequest; resolve?: ResolveSpec | null; timeoutSeconds: number; options: CurlOptions }): CurlExplanation[]`
  - `export function formatCurl` 签名不变，返回值改为新排版。
  - 不导出 `buildCurlPieces`。

- [ ] **Step 1: Write the failing test**

在 `web/src/curl.test.ts` 的导入里加上 `explainCurl`。在 `describe("formatCurl"` 的结束括号之后追加：

```ts
describe("formatCurl layout", () => {
  const allOn = {
    useResolve: true,
    followRedirects: true,
    maxRedirects: true,
    maxTime: true,
    insecure: true,
  };

  it("packs short options and keeps structural arguments on their own lines", () => {
    const s = formatCurl({
      prepared: base({
        method: "POST",
        url: "https://api.local/v1/items",
        query: { q: "1" },
        body: { type: "json", content: `{"a":1}` },
      }),
      resolve: { host: "api.local", port: "443", ip: "2001:db8::1" },
      timeoutSeconds: 30,
      options: allOn,
    });
    expect(s).toBe(
      [
        "curl -L --max-redirs 10 -k --max-time 30 \\",
        "  --resolve 'api.local:443:[2001:db8::1]' \\",
        "  -X POST 'https://api.local/v1/items?q=1' \\",
        "  -H 'Content-Type: application/json' \\",
        "  -H 'User-Agent: httptest/0.1' \\",
        `  --data-raw '{"a":1}'`,
      ].join("\n"),
    );
  });

  it("starts with curl when every short option is off", () => {
    const s = formatCurl({
      prepared: base(),
      timeoutSeconds: 30,
      options: {
        useResolve: false,
        followRedirects: false,
        maxRedirects: false,
        maxTime: false,
        insecure: false,
      },
    });
    expect(s).toBe(
      [
        "curl -X GET 'http://example.com/a' \\",
        "  -H 'User-Agent: httptest/0.1'",
      ].join("\n"),
    );
  });

  it("does not wrap a header that is longer than 80 columns", () => {
    const value = "x".repeat(100);
    const s = formatCurl({
      prepared: base({ headers: { "X-Long": value } }),
      timeoutSeconds: 30,
      options: {
        useResolve: false,
        followRedirects: false,
        maxRedirects: false,
        maxTime: false,
        insecure: false,
      },
    });
    expect(s.split("\n").at(-1)).toBe(
      `  -H ${shellSingleQuote(`X-Long: ${value}`)}`,
    );
  });
});

describe("explainCurl", () => {
  const allOn = {
    useResolve: true,
    followRedirects: true,
    maxRedirects: true,
    maxTime: true,
    insecure: true,
  };

  it("explains each parameter that appears in the representative command", () => {
    const input = {
      prepared: base({
        method: "POST",
        url: "https://api.local/v1/items",
        query: { q: "1" },
        body: { type: "json", content: `{"a":1}` },
      }),
      resolve: { host: "api.local", port: "443", ip: "2001:db8::1" },
      timeoutSeconds: 30,
      options: allOn,
    };
    const command = formatCurl(input);
    const explained = explainCurl(input);
    expect(explained).toEqual([
      { text: "-L", explanation: "跟随重定向" },
      { text: "--max-redirs 10", explanation: "重定向次数上限，单位为次" },
      { text: "-k", explanation: "跳过 TLS 证书校验" },
      { text: "--max-time 30", explanation: "最长等待时间，单位为秒" },
      {
        text: "--resolve 'api.local:443:[2001:db8::1]'",
        explanation: "将主机的端口解析到指定 IP",
      },
      { text: "-X POST", explanation: "HTTP 方法" },
      {
        text: "'https://api.local/v1/items?q=1'",
        explanation: "请求地址，查询参数已写在 URL 里",
      },
      {
        text: "-H 'Content-Type: application/json'",
        explanation: "请求头",
      },
      { text: "-H 'User-Agent: httptest/0.1'", explanation: "请求头" },
      { text: `--data-raw '{"a":1}'`, explanation: "请求体原文" },
    ]);
    expect(command.replaceAll(" \\\n  ", " ")).toBe(
      `curl ${explained.map((item) => item.text).join(" ")}`,
    );
  });

  it("omits disabled options and keeps the max-time unit generic", () => {
    const explained = explainCurl({
      prepared: base(),
      timeoutSeconds: 0.5,
      options: {
        useResolve: false,
        followRedirects: false,
        maxRedirects: true,
        maxTime: true,
        insecure: false,
      },
    });
    expect(explained.map((item) => item.text)).toEqual([
      "--max-time 0.5",
      "-X GET",
      "'http://example.com/a'",
      "-H 'User-Agent: httptest/0.1'",
    ]);
    expect(explained[0]?.explanation).toBe("最长等待时间，单位为秒");
  });

  it("uses the same body explanation for form data", () => {
    const explained = explainCurl({
      prepared: base({
        method: "POST",
        body: { type: "form", content: { b: "2", a: "1" } },
      }),
      timeoutSeconds: 30,
      options: {
        useResolve: false,
        followRedirects: false,
        maxRedirects: false,
        maxTime: false,
        insecure: false,
      },
    });
    const body = explained.find((item) => item.text.startsWith("--data-raw"));
    expect(body?.explanation).toBe("请求体原文");
    expect(body?.text).toContain("a=1");
    expect(body?.text).toContain("b=2");
  });

  it("omits the body explanation for HEAD", () => {
    const explained = explainCurl({
      prepared: base({
        method: "HEAD",
        body: { type: "json", content: "{}" },
      }),
      timeoutSeconds: 30,
      options: {
        useResolve: false,
        followRedirects: false,
        maxRedirects: false,
        maxTime: false,
        insecure: false,
      },
    });
    expect(explained.some((item) => item.text.startsWith("--data-raw"))).toBe(
      false,
    );
  });
});
```

既有 `describe("formatCurl")` 里的 `toContain` 用例不要删。

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/curl.test.ts -t "formatCurl layout|explainCurl"`

Expected: FAIL，`explainCurl` 未导出，或代表性命令仍是每个参数一行。

- [ ] **Step 3: Write minimal implementation**

在 `web/src/curl.ts` 里，于 `packShortOptionLines` 之后、现有 `formatCurl` 的位置，放上下面的类型和函数，并删除旧的 `formatCurl` 函数体（`const parts` 到 `return parts.join` 那一整段）。

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/curl.test.ts`

Expected: PASS。旧的 `toContain` 用例和新的精确字符串、说明用例都通过。

- [ ] **Step 5: Commit**

```bash
git add web/src/curl.ts web/src/curl.test.ts
git commit -m "$(cat <<'EOF'
feat(web): explain each parameter in an exported curl command

EOF
)"
```

---

### Task 3: 导出对话框、样式与 README

**Files:**
- Modify: `web/src/ExportCurlDialog.tsx`
- Modify: `web/src/ExportCurlDialog.test.tsx`
- Modify: `web/src/styles.css`（约 826–879 行的导出 curl 规则）
- Modify: `README.md`（「界面」段落中的导出 curl 分句）
- Test: `web/src/ExportCurlDialog.test.tsx`

**Interfaces:**
- Consumes: `formatCurl`、`explainCurl`、`defaultCurlOptions`、`effectiveCurlOptions`。`explainCurl` 的元素是 `{ text, explanation }`。
- Produces: 对话框默认渲染「说明」按钮且 `aria-pressed="false"`，不挂载 `#export-curl-explain`。打开后根节点增加 `with-explain`。复制文本仍是 `formatCurl` 的返回值。

- [ ] **Step 1: Write the failing test**

把 `web/src/ExportCurlDialog.test.tsx` 里 `shows feature toggles and curl preview` 的断言换成：

```ts
    expect(markup).toContain("导出 curl");
    expect(markup).toContain("使用当前 Hosts 解析");
    expect(markup).toContain("跟随重定向");
    expect(markup).toContain("限制超时");
    expect(markup).toContain("跳过 TLS 校验");
    expect(markup).toContain("限制最大重定向");
    expect(markup).toContain("预览");
    expect(markup).toContain("说明");
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).not.toContain("export-curl-explain");
    expect(markup).not.toContain("with-explain");
    expect(markup).not.toContain("默认 30000ms");
    expect(markup).not.toContain("重定向次数上限，单位为次");
    expect(markup).not.toContain("将主机的端口解析到指定 IP");
    expect(markup).not.toContain("请求体原文");
    expect(markup).toContain("curl");
    expect(markup).toContain("复制到剪贴板");
    expect(markup).toContain("-L");
    expect(markup).toContain("--max-time 30");
    expect(markup).toContain("--max-redirs 10");
```

把 `disables hosts toggle without resolve` 整段换成：

```ts
  it("disables hosts toggle without resolve", () => {
    const markup = renderToStaticMarkup(
      <ExportCurlDialog
        prepared={prepared}
        timeoutSeconds={30}
        onClose={vi.fn()}
      />,
    );
    expect(markup).toMatch(/disabled[\s\S]{0,80}使用当前 Hosts 解析/);
    expect(markup).not.toContain("当前 Hosts 未命中此主机");
  });
```

其余用例保持原样。

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/ExportCurlDialog.test.tsx`

Expected: FAIL。标记里仍有「默认 30000ms」或「当前 Hosts 未命中此主机」，且没有 `aria-pressed="false"`。

- [ ] **Step 3: Write minimal implementation**

用下面的内容替换 `web/src/ExportCurlDialog.tsx`：

```tsx
import { useState } from "react";
import {
  defaultCurlOptions,
  effectiveCurlOptions,
  explainCurl,
  formatCurl,
} from "./curl";
import { notifyError, notifyInfo } from "./toast";
import type { HttpRequest, ResolveSpec } from "./types";

interface Props {
  prepared: HttpRequest;
  resolve?: ResolveSpec;
  timeoutSeconds: number;
  onClose: () => void;
}

export default function ExportCurlDialog({
  prepared,
  resolve,
  timeoutSeconds,
  onClose,
}: Props) {
  const [options, setOptions] = useState(defaultCurlOptions(prepared.settings));
  const [showExplain, setShowExplain] = useState(false);

  const effectiveOptions = effectiveCurlOptions(options, resolve);
  const commandInput = {
    prepared,
    resolve,
    timeoutSeconds,
    options: effectiveOptions,
  };
  const preview = formatCurl(commandInput);
  const explanations = explainCurl(commandInput);

  async function copyToClipboard() {
    if (!navigator.clipboard?.writeText) {
      notifyError("复制失败");
      return;
    }
    try {
      await navigator.clipboard.writeText(preview);
      notifyInfo("已复制");
      onClose();
    } catch {
      notifyError("复制失败");
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className={
          showExplain
            ? "dialog export-curl-dialog with-explain"
            : "dialog export-curl-dialog"
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-curl-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="export-curl-title">导出 curl</h2>
        <div className="curl-export-body">
          <fieldset className="curl-options" aria-label="功能选项">
            <label className="curl-option">
              <input
                type="checkbox"
                checked={effectiveOptions.useResolve}
                disabled={!resolve}
                onChange={(e) =>
                  setOptions((prev) => ({
                    ...prev,
                    useResolve: e.target.checked,
                  }))
                }
              />
              使用当前 Hosts 解析
            </label>
            <label className="curl-option">
              <input
                type="checkbox"
                checked={options.followRedirects}
                onChange={(e) =>
                  setOptions((prev) => ({
                    ...prev,
                    followRedirects: e.target.checked,
                  }))
                }
              />
              跟随重定向
            </label>
            <label className="curl-option">
              <input
                type="checkbox"
                checked={options.maxRedirects}
                disabled={!options.followRedirects}
                onChange={(e) =>
                  setOptions((prev) => ({
                    ...prev,
                    maxRedirects: e.target.checked,
                  }))
                }
              />
              限制最大重定向
            </label>
            <label className="curl-option">
              <input
                type="checkbox"
                checked={options.maxTime}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, maxTime: e.target.checked }))
                }
              />
              限制超时
            </label>
            <label className="curl-option">
              <input
                type="checkbox"
                checked={options.insecure}
                onChange={(e) =>
                  setOptions((prev) => ({
                    ...prev,
                    insecure: e.target.checked,
                  }))
                }
              />
              跳过 TLS 校验
            </label>
          </fieldset>
          <div className="curl-export-preview">
            <div className="curl-export-preview-head">
              <h3>预览</h3>
              <button
                type="button"
                className="btn curl-explain-toggle"
                aria-pressed={showExplain}
                onClick={() => setShowExplain((open) => !open)}
              >
                说明
              </button>
            </div>
            <pre className="curl-preview">{preview}</pre>
          </div>
          {showExplain ? (
            <section
              className="curl-export-explain"
              id="export-curl-explain"
              aria-labelledby="export-curl-explain-title"
            >
              <h3 id="export-curl-explain-title">说明</h3>
              <ul className="curl-explain-list">
                {explanations.map((item, index) => (
                  <li key={`${index}-${item.text}`}>
                    <div className="curl-explain-text">{item.text}</div>
                    <p className="curl-explain-detail">{item.explanation}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void copyToClipboard()}
          >
            复制到剪贴板
          </button>
        </div>
      </div>
    </div>
  );
}
```

把 `web/src/styles.css` 里从 `.export-curl-dialog,` 到 `.curl-preview` 规则结束（含 `.curl-options-legend` 与 `.curl-option-hint`）替换为：

```css
.import-curl-dialog {
  width: min(560px, 92vw);
}

.export-curl-dialog {
  width: min(40rem, 92vw);
  max-height: calc(100vh - 2rem);
  display: flex;
  flex-direction: column;
}

.export-curl-dialog.with-explain {
  width: min(58rem, 92vw);
}

.curl-export-body {
  display: grid;
  grid-template-columns: 11rem minmax(0, 1fr);
  gap: 0.75rem;
  min-height: 0;
  flex: 1;
}

.export-curl-dialog.with-explain .curl-export-body {
  grid-template-columns: 11rem minmax(0, 1fr) 16rem;
}

.curl-options {
  border: 1px solid var(--line);
  border-radius: 6px;
  margin: 0;
  padding: 0.55rem 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-height: 0;
  overflow: auto;
}

.curl-option {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.85rem;
  cursor: pointer;
}

.curl-option input:disabled + *,
.curl-option:has(input:disabled) {
  cursor: not-allowed;
  opacity: 0.7;
}

.curl-export-preview {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
  min-height: 12rem;
}

.curl-export-preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-shrink: 0;
}

.curl-export-preview-head h3,
.curl-export-explain h3 {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
}

.curl-explain-toggle[aria-pressed="true"] {
  border-color: var(--accent);
  color: var(--accent);
}

.curl-preview {
  margin: 0;
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0.55rem 0.65rem;
  font-family: var(--mono);
  font-size: 0.78rem;
  line-height: 1.45;
  white-space: pre;
  word-break: normal;
  background: var(--field);
  border: 1px solid var(--line);
  border-radius: 6px;
}

.curl-export-explain {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 0.55rem 0.65rem;
}

.curl-explain-list {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.curl-explain-text {
  font-family: var(--mono);
  font-size: 0.78rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.curl-explain-detail {
  margin: 0.15rem 0 0;
  color: var(--muted);
  font-size: 0.78rem;
}

@media (max-width: 63.99rem) {
  .export-curl-dialog,
  .export-curl-dialog.with-explain {
    width: min(40rem, 92vw);
  }

  .curl-export-body,
  .export-curl-dialog.with-explain .curl-export-body {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

替换结束在 `.curl-preview` 规则的位置。紧随其后的 `.import-curl-dialog .curl-import-input` 保持原样，不要删掉。

在 `README.md` 的「界面」段落里，把这一句：

```text
「导出 curl」（功能选项 + 预览 + 复制到剪贴板）
```

换成：

```text
「导出 curl」（左侧功能选项、右侧预览、可选说明栏、复制到剪贴板）
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/ExportCurlDialog.test.tsx src/curl.test.ts && npm test`

工作目录是 `web`。Expected: PASS。

再确认 README 已经换句：

Run: `grep -n "可选说明栏" README.md`

工作目录是仓库根目录。Expected: 有一行匹配，且不再有「功能选项 + 预览 + 复制到剪贴板」。

- [ ] **Step 5: Commit**

```bash
git add web/src/ExportCurlDialog.tsx web/src/ExportCurlDialog.test.tsx web/src/styles.css README.md
git commit -m "$(cat <<'EOF'
feat(web): place curl explanations in a hidden side panel

EOF
)"
```
