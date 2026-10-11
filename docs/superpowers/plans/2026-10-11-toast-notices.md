# 顶部轻提示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用顶部中央一条轻提示替换结果区带边框的失败块，以及顶栏、对话框、编辑器、侧栏里的失败文案和「已复制」。

**Architecture:** `web/src/toast.ts` 放模块级队列和 `noticesForResult`。`Toaster` 挂在 `ErrorBoundary` 外面订阅队列。各失败路径只调用 `notifyError` / `notifyHint` / `publishResultNotices`，不再自己画失败节点。界面崩溃调用 `notifySticky`，边界内子树渲染为空。

**Tech Stack:** React 18 + TypeScript + Vite + 手写 CSS；Vitest（`environment: "node"`，`renderToStaticMarkup`，`vi.useFakeTimers()`）。不新增 npm 包，不改 Go。

## Global Constraints

- 规格：`docs/superpowers/specs/2026-10-11-toast-notices-design.md`。
- 仅 `web/` 与 `internal/server/ui/` 嵌入产物。不改 Go 协议、错误分类、`errorMessage` 原文。
- 不新增 npm 包。README 不改。
- 位置：视口顶部中央，纵向往下排，新的一条在最上。`top: 0.75rem`，`z-index: 30`，容器 `pointer-events: none`，单条 `pointer-events: auto`。
- 时长：提示 3000ms，失败 8000ms。悬停暂停，移开后按剩余时间继续。用 `Date.now()` 计算剩余时间，不用 `performance.now()`。
- 不设条数上限，不写入本地。
- 缺变量模板 `缺少变量：` + 名字以 `, ` 连接。历史模板 `历史记录未写入：`。分类与后端说明保持原文，中间用全角冒号 `：`。
- 空状态、对话框 `hint`、`.curl-option-hint`、「变量已展开」不入队。
- 入队只发生在事件处理、请求回调和 `componentDidCatch`，不在渲染期间调用。
- 重复键是「正文 + kind + sticky」。定时条重复入队时剩余时间重置为该级别完整时长。崩溃条重复入队不新增。
- 空字符串不入队。

## File Structure

| 路径 | 职责 |
|------|------|
| `web/src/toast.ts` | 队列、`notifyError` / `notifyHint` / `notifySticky` / `dismiss` / `pause` / `resume`、`noticesForResult`、`publishResultNotices` |
| `web/src/toast.test.ts` | 队列与文案 |
| `web/src/Toaster.tsx` | 订阅并渲染顶部中央轻提示 |
| `web/src/Toaster.test.tsx` | 静态标记：位置容器、级别、关闭按钮 |
| `web/src/main.tsx` | `Toaster` 放在 `ErrorBoundary` 外 |
| `web/src/styles.css` | `.toaster` / `.toast*`；删除只服务于旧失败文案的规则 |
| `web/src/ResultPane.tsx` | 去掉错误块与 `response-error-state` |
| `web/src/App.tsx` | 入队替换 `setError` / `setDialogError` / 编辑器 error / Hosts 列表失败 |
| `web/src/Dialog.tsx` | 去掉 `DialogMode.error` 与失败段落 |
| `web/src/ImportCurlDialog.tsx` | 解析失败改 `notifyError` |
| `web/src/ExportCurlDialog.tsx` | 复制成功/失败改轻提示 |
| `web/src/EnvEditor.tsx` / `web/src/HostsContentEditor.tsx` | 去掉 `error` 属性 |
| `web/src/Sidebar.tsx` | Hosts 用布尔禁用；历史失败改入队 |
| `web/src/hosts.ts` / `web/src/hosts.test.ts` | `hostsNewBlockedReason` 接收布尔 |
| `web/src/ErrorBoundary.tsx` | `notifySticky`，兜底渲染 `null` |
| `web/src/result-pane-ui.test.tsx` / `web/src/hosts-panel.test.tsx` | 旧错误块断言改为新行为 |

---

### Task 1: 队列与结果文案

**Files:**
- Create: `web/src/toast.ts`
- Create: `web/src/toast.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `export interface ToastItem { id: number; message: string; kind: "error" | "hint"; sticky: boolean }`
  - `export interface ResultNoticeInput { errorClass: string; errorMessage: string; missingVars?: string[]; historyError?: string }`
  - `export function getToasts(): ToastItem[]`
  - `export function subscribe(listener: (items: ToastItem[]) => void): () => void`
  - `export function notifyError(message: string): void`
  - `export function notifyHint(message: string): void`
  - `export function notifySticky(message: string): void`
  - `export function dismiss(id: number): void`
  - `export function pause(id: number): void`
  - `export function resume(id: number): void`
  - `export function noticesForResult(result: ResultNoticeInput): string[]`
  - `export function publishResultNotices(result: ResultNoticeInput): void`
  - `export function resetToastsForTests(): void`

- [ ] **Step 1: 写失败测试**

创建 `web/src/toast.test.ts`：

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dismiss,
  getToasts,
  notifyError,
  notifyHint,
  notifySticky,
  noticesForResult,
  pause,
  publishResultNotices,
  resetToastsForTests,
  resume,
} from "./toast";

beforeEach(() => {
  vi.useFakeTimers();
  resetToastsForTests();
});

afterEach(() => {
  resetToastsForTests();
  vi.useRealTimers();
});

describe("toast queue", () => {
  it("drops empty messages", () => {
    notifyError("");
    notifyHint("");
    notifySticky("");
    expect(getToasts()).toEqual([]);
  });

  it("removes an error after 8000ms and a hint after 3000ms", () => {
    notifyError("保存失败");
    notifyHint("已复制");
    expect(getToasts().map((t) => t.message)).toEqual(["已复制", "保存失败"]);
    vi.advanceTimersByTime(3000);
    expect(getToasts().map((t) => t.message)).toEqual(["保存失败"]);
    vi.advanceTimersByTime(5000);
    expect(getToasts()).toEqual([]);
  });

  it("resets the full duration when the same timed message is enqueued again", () => {
    notifyError("保存失败");
    const id = getToasts()[0].id;
    vi.advanceTimersByTime(7000);
    notifyError("保存失败");
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0].id).toBe(id);
    vi.advanceTimersByTime(7000);
    expect(getToasts()).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(getToasts()).toEqual([]);
  });

  it("dismisses only the chosen toast", () => {
    notifyError("a");
    notifyError("b");
    dismiss(getToasts()[1].id);
    expect(getToasts().map((t) => t.message)).toEqual(["b"]);
  });

  it("keeps a sticky toast until dismiss and ignores a duplicate", () => {
    notifySticky("界面出错：boom");
    vi.advanceTimersByTime(60_000);
    expect(getToasts()).toHaveLength(1);
    notifySticky("界面出错：boom");
    expect(getToasts()).toHaveLength(1);
    dismiss(getToasts()[0].id);
    expect(getToasts()).toEqual([]);
  });

  it("pauses the remaining time and resumes it", () => {
    notifyError("保存失败");
    const id = getToasts()[0].id;
    vi.advanceTimersByTime(3000);
    pause(id);
    vi.advanceTimersByTime(10_000);
    expect(getToasts()).toHaveLength(1);
    resume(id);
    vi.advanceTimersByTime(4999);
    expect(getToasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(getToasts()).toEqual([]);
  });
});

describe("noticesForResult", () => {
  it("prefers the missing-vars sentence over errorMessage", () => {
    expect(
      noticesForResult({
        errorClass: "invalid",
        errorMessage: "missing baseUrl",
        missingVars: ["baseUrl"],
      }),
    ).toEqual(["缺少变量：baseUrl"]);
  });

  it("joins several missing names with a comma", () => {
    expect(
      noticesForResult({
        errorClass: "invalid",
        errorMessage: "",
        missingVars: ["baseUrl", "token"],
      }),
    ).toEqual(["缺少变量：baseUrl, token"]);
  });

  it("formats class and message", () => {
    expect(
      noticesForResult({
        errorClass: "dns",
        errorMessage: "connection refused",
      }),
    ).toEqual(["dns：connection refused"]);
  });

  it("uses the message alone when class is empty", () => {
    expect(
      noticesForResult({ errorClass: "", errorMessage: "boom" }),
    ).toEqual(["boom"]);
  });

  it("uses the class alone when there is no message and the class is not http", () => {
    expect(
      noticesForResult({ errorClass: "timeout", errorMessage: "" }),
    ).toEqual(["timeout"]);
  });

  it("does not toast a bare http status", () => {
    expect(
      noticesForResult({ errorClass: "http", errorMessage: "" }),
    ).toEqual([]);
  });

  it("formats an http errorMessage with the class prefix", () => {
    expect(
      noticesForResult({
        errorClass: "http",
        errorMessage: "redirect limit reached (10)",
      }),
    ).toEqual(["http：redirect limit reached (10)"]);
  });

  it("places historyError after the primary sentence", () => {
    expect(
      noticesForResult({
        errorClass: "dns",
        errorMessage: "connection refused",
        historyError: "disk full",
      }),
    ).toEqual([
      "dns：connection refused",
      "历史记录未写入：disk full",
    ]);
  });

  it("publishes history first so the primary sentence stays on top", () => {
    publishResultNotices({
      errorClass: "dns",
      errorMessage: "connection refused",
      historyError: "disk full",
    });
    expect(getToasts().map((t) => t.message)).toEqual([
      "dns：connection refused",
      "历史记录未写入：disk full",
    ]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd web && npx vitest run src/toast.test.ts`

Expected: FAIL，`./toast` 无法解析。

- [ ] **Step 3: 实现队列与文案**

创建 `web/src/toast.ts`：

```ts
export interface ToastItem {
  id: number;
  message: string;
  kind: "error" | "hint";
  sticky: boolean;
}

export interface ResultNoticeInput {
  errorClass: string;
  errorMessage: string;
  missingVars?: string[];
  historyError?: string;
}

type Listener = (items: ToastItem[]) => void;

const ERROR_MS = 8000;
const HINT_MS = 3000;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const deadlines = new Map<number, number>();
const remaining = new Map<number, number>();

function emit() {
  const snapshot = items.slice();
  for (const listener of listeners) listener(snapshot);
}

function clearTimer(id: number) {
  const timer = timers.get(id);
  if (timer !== undefined) clearTimeout(timer);
  timers.delete(id);
  deadlines.delete(id);
}

function arm(id: number, ms: number) {
  clearTimer(id);
  remaining.delete(id);
  deadlines.set(id, Date.now() + ms);
  timers.set(
    id,
    setTimeout(() => {
      dismiss(id);
    }, ms),
  );
}

export function getToasts(): ToastItem[] {
  return items.slice();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function enqueue(
  message: string,
  kind: ToastItem["kind"],
  sticky: boolean,
  ms: number,
) {
  if (message === "") return;
  const existing = items.find(
    (item) =>
      item.message === message && item.kind === kind && item.sticky === sticky,
  );
  if (existing) {
    if (!existing.sticky) arm(existing.id, ms);
    return;
  }
  const item: ToastItem = { id: nextId++, message, kind, sticky };
  items = [item, ...items];
  if (!sticky) arm(item.id, ms);
  emit();
}

export function notifyError(message: string) {
  enqueue(message, "error", false, ERROR_MS);
}

export function notifyHint(message: string) {
  enqueue(message, "hint", false, HINT_MS);
}

export function notifySticky(message: string) {
  enqueue(message, "error", true, 0);
}

export function dismiss(id: number) {
  clearTimer(id);
  remaining.delete(id);
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) return;
  items = next;
  emit();
}

export function pause(id: number) {
  const item = items.find((entry) => entry.id === id);
  if (!item || item.sticky) return;
  const deadline = deadlines.get(id);
  if (deadline === undefined) return;
  remaining.set(id, Math.max(0, deadline - Date.now()));
  clearTimer(id);
}

export function resume(id: number) {
  const left = remaining.get(id);
  if (left === undefined) return;
  arm(id, left);
}

export function noticesForResult(result: ResultNoticeInput): string[] {
  const notices: string[] = [];
  const missing = (result.missingVars ?? []).filter((name) => name !== "");
  if (missing.length > 0) {
    notices.push(`缺少变量：${missing.join(", ")}`);
  } else if (result.errorMessage) {
    notices.push(
      result.errorClass
        ? `${result.errorClass}：${result.errorMessage}`
        : result.errorMessage,
    );
  } else if (result.errorClass && result.errorClass !== "http") {
    notices.push(result.errorClass);
  }
  if (result.historyError) {
    notices.push(`历史记录未写入：${result.historyError}`);
  }
  return notices;
}

export function publishResultNotices(result: ResultNoticeInput) {
  const notices = noticesForResult(result);
  for (let i = notices.length - 1; i >= 0; i--) {
    notifyError(notices[i]);
  }
}

export function resetToastsForTests() {
  for (const id of timers.keys()) clearTimer(id);
  remaining.clear();
  items = [];
  nextId = 1;
  emit();
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd web && npx vitest run src/toast.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/toast.ts web/src/toast.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add a timed toast queue for failures and hints

EOF
)"
```

---

### Task 2: 顶部中央 Toaster

**Files:**
- Create: `web/src/Toaster.tsx`
- Create: `web/src/Toaster.test.tsx`
- Modify: `web/src/styles.css`（在 `.banner` 规则附近追加，本任务先不删旧规则）
- Modify: `web/src/main.tsx`

**Interfaces:**
- Consumes: Task 1 的 `subscribe`、`getToasts`、`dismiss`、`pause`、`resume`、`notifyError`、`notifyHint`、`resetToastsForTests`
- Produces: 默认导出 `Toaster`。标记类名 `toaster`、`toast`、`toast-error`、`toast-hint`、`toast-message`、`toast-close`

- [ ] **Step 1: 写失败测试**

创建 `web/src/Toaster.test.tsx`：

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import Toaster from "./Toaster";
import { notifyError, notifyHint, resetToastsForTests } from "./toast";

afterEach(() => {
  resetToastsForTests();
});

describe("Toaster", () => {
  it("renders nothing when the queue is empty", () => {
    expect(renderToStaticMarkup(<Toaster />)).toBe("");
  });

  it("renders an error and a hint in a top-center stack with close buttons", () => {
    notifyError("缺少变量：baseUrl");
    notifyHint("已复制");
    const markup = renderToStaticMarkup(<Toaster />);
    expect(markup).toContain('class="toaster"');
    expect(markup.indexOf("已复制")).toBeLessThan(
      markup.indexOf("缺少变量：baseUrl"),
    );
    expect(markup).toContain('class="toast toast-hint"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('class="toast toast-error"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('aria-label="关闭"');
    expect(markup).not.toContain("banner");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd web && npx vitest run src/Toaster.test.tsx`

Expected: FAIL，`./Toaster` 无法解析。

- [ ] **Step 3: 实现 Toaster、样式，并挂到边界外**

创建 `web/src/Toaster.tsx`：

```tsx
import { useSyncExternalStore } from "react";
import { dismiss, getToasts, pause, resume, subscribe } from "./toast";

export default function Toaster() {
  const items = useSyncExternalStore(subscribe, getToasts, getToasts);
  if (items.length === 0) return null;
  return (
    <div className="toaster">
      {items.map((item) => (
        <div
          key={item.id}
          className={
            item.kind === "error" ? "toast toast-error" : "toast toast-hint"
          }
          role={item.kind === "error" ? "alert" : "status"}
          onMouseEnter={() => pause(item.id)}
          onMouseLeave={() => resume(item.id)}
        >
          <p className="toast-message">{item.message}</p>
          <button
            type="button"
            className="toast-close"
            aria-label="关闭"
            onClick={() => dismiss(item.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
```

在 `web/src/styles.css` 的 `.banner` 规则之后追加：

```css
.toaster {
  position: fixed;
  top: 0.75rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: min(22rem, calc(100vw - 1.5rem));
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  width: 100%;
  max-width: 22rem;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.55rem 0.65rem;
  background: var(--surface);
  box-shadow: 0 4px 16px rgb(0 0 0 / 28%);
  border: none;
}

.toast-error {
  color: var(--err);
}

.toast-hint {
  color: var(--ink);
}

.toast-message {
  margin: 0;
  flex: 1;
  font-size: 0.85rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.toast-close {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}
```

把 `web/src/main.tsx` 的渲染改成：

```tsx
import Toaster from "./Toaster";

createRoot(root).render(
  <StrictMode>
    <Toaster />
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
```

保留文件里已有的 `applyTheme` / `readStoredTheme` / `styles.css` import。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd web && npx vitest run src/Toaster.test.tsx src/toast.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/Toaster.tsx web/src/Toaster.test.tsx web/src/styles.css web/src/main.tsx
git commit -m "$(cat <<'EOF'
feat(web): show the toast queue at the top center

EOF
)"
```

---

### Task 3: 结果区不再画失败

**Files:**
- Modify: `web/src/ResultPane.tsx`（`ResultPaneContent` 的 section / meta）
- Modify: `web/src/result-pane-ui.test.tsx`（`ResultPane non-http error`）

**Interfaces:**
- Consumes: 无队列。本任务只改呈现。
- Produces: 非 HTTP 结果的标记不含 `response-meta`、`response-error-state`、错误正文。HTTP 的 meta 只留状态码、耗时、体积。

- [ ] **Step 1: 改失败断言**

把 `web/src/result-pane-ui.test.tsx` 里 `shows errorClass in meta and still renders primary Request / Response / Raw tabs` 的断言换成：

```tsx
    expect(markup).not.toContain("response-error-state");
    expect(markup).not.toContain("response-meta");
    expect(markup).not.toContain("dns");
    expect(markup).not.toContain("connection refused");
    expect(markup).toContain(">Request<");
    expect(markup).toContain(">Response<");
    expect(markup).toContain(">Raw<");
    expect(markup).not.toContain("status-0xx");
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd web && npx vitest run src/result-pane-ui.test.tsx`

Expected: FAIL，标记仍含 `response-error-state` 或 `dns`。

- [ ] **Step 3: 去掉结果区错误块**

在 `ResultPaneContent` 中，外层改为始终 `className="response"`。只有 `isHttp` 时渲染 `.response-meta`，并且 meta 里只保留状态码、耗时、体积三块。删除 `errorMessage`、`historyError`、`missingVars`、`errorClass` 的 JSX。

```tsx
  return (
    <section className="response">
      {isHttp ? (
        <div className="response-meta">
          <span
            className={`status status-${Math.floor(result.status / 100)}xx`}
          >
            {result.status} {result.statusText}
          </span>
          <span>{msLabel(result.timings.totalMs)} ms</span>
          <span title="响应线上字节（解压前）">
            响应 {sizeLabel(result.responseSize)}
            {result.body.length !== result.responseSize
              ? ` · 正文 ${sizeLabel(result.body.length)}`
              : ""}
            {result.truncated ? "（截断）" : ""}
          </span>
        </div>
      ) : null}
```

后面的 `.tabs` 与 `response-body` 保持原样。不要改 Overview 里的「变量已展开」，也不要改 `result === null` 的空状态。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd web && npx vitest run src/result-pane-ui.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/ResultPane.tsx web/src/result-pane-ui.test.tsx
git commit -m "$(cat <<'EOF'
fix(web): drop the bordered error block from the result pane

EOF
)"
```

---

### Task 4: 发送、导出准备、历史记录与顶栏失败入队

**Files:**
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: `publishResultNotices`、`notifyError`
- Produces: `setResult` 收到非空结果时入队。顶栏不再渲染 `.banner`。`error` state 删除。`setResult(null)` 不入队。

- [ ] **Step 1: 接上结果入队并替换顶栏失败**

在 `App.tsx` 增加：

```ts
import { notifyError, publishResultNotices } from "./toast";

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function showResult(result: Result) {
  setResult(result);
  publishResultNotices(result);
}
```

`showResult` 必须写在能调用 `setResult` 的组件函数体内（`App` 内部），不要写成模块级函数。

三处非空 `setResult` 改为 `showResult`：

- `onSelectHistory`：`showResult(parseHistoryResult(entry.result))`
- `onSend` 成功：`showResult(res)`
- `onExportCurl` 里 `res.errorClass` 分支：把现有的 `setResult({ ... })` 整段对象改成传给 `showResult({ ... })`，字段保持不变

保留 `setResult(null)`（删除当前请求那一处）不入队。

删除 `const [error, setError] = useState<string | null>(null);`。

删除这四处 `setError(null);`：工作区加载成功、`onSend` 开头、`onExportCurl` 开头、`onSave` 有 path 时的开头。

把这四处 `setError(err instanceof Error ? err.message : String(err));` 换成 `notifyError(errorText(err));`：工作区加载 catch、`onSend` catch、`onExportCurl` catch、`onSave` catch。

删除 JSX：`{error && <div className="banner error">{error}</div>}`。

本任务先不动 `dialogError`、`envError`、`overrideError`、`hostsError`。

- [ ] **Step 2: 跑前端测试**

Run: `cd web && npx vitest run`

Expected: PASS。若类型错误来自仍引用已删除的 `error`，修完再跑，直到 PASS。

- [ ] **Step 3: Commit**

```bash
git add web/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(web): toast execute failures instead of the top banner

EOF
)"
```

---

### Task 5: 对话框失败入队

**Files:**
- Modify: `web/src/Dialog.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/hosts-panel.test.tsx`（create-hosts 的 `Dialog` fixture）

**Interfaces:**
- Consumes: `notifyError`
- Produces: `DialogMode` 不再有 `error` 字段。对话框仍渲染 `hint`。

- [ ] **Step 1: 改对话框标记测试**

在 `web/src/hosts-panel.test.tsx` 的 create-hosts 用例里，把 fixture 的 `error: null` 改成 `error: "名称非法"`，并追加：

```tsx
    expect(markup).toContain("名称，例如 lan");
    expect(markup).not.toContain("名称非法");
```

现有的类型选择器断言保留。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd web && npx vitest run src/hosts-panel.test.tsx`

Expected: FAIL，标记仍含「名称非法」。

- [ ] **Step 3: 去掉 DialogMode.error，App 改为入队**

`DialogMode` 的 `path` 与 `confirm` 两个分支都删除 `error: string | null`。删除：

```tsx
        {mode.error ? <p className="error">{mode.error}</p> : null}
```

`hint` 段落保留。实现完成后，create-hosts 测试 fixture 删除 `error: "名称非法"`，因为类型里已经没有该字段。断言「不含名称非法」「仍含名称，例如 lan」保留。

`App.tsx`：

- 删除 `const [dialogError, setDialogError] = useState<string | null>(null);`
- `dialogMode` 改为直接使用 `dialog`（删除 `{ ...dialog, error: dialogError ?? dialog.error }`）
- 每个 `setDialog({ ... error: null ...})` 去掉 `error: null` 这一行
- 删除每一行内容就是 `setDialogError(null);` 的语句
- 每一个 `setDialogError(expr)` 改成 `notifyError(expr)`。字符串和变量都这样改，包括 `"请等待 Hosts 保存完成"`、`"不能改成当前名称"`、`err`、`blocked`
- `onDialogSubmit` 的 catch 里把 `setDialogError(...)` 换成：

```tsx
      notifyError(
        hostsOp
          ? hostsAPIError(message)
          : overrideOp
            ? overrideAPIError(message)
            : envOp
              ? environmentAPIError(message)
              : message,
      );
```

对话框仍然 `setDialog(null)` 只在成功时关闭。失败不关闭对话框。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd web && npx vitest run`

Expected: PASS

再确认没有残留：

Run: `cd web && rg "setDialogError|mode\\.error" src`

Expected: 无匹配

- [ ] **Step 5: Commit**

```bash
git add web/src/Dialog.tsx web/src/App.tsx web/src/hosts-panel.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): toast dialog failures and keep path hints inline

EOF
)"
```

---

### Task 6: 导入与导出 curl

**Files:**
- Modify: `web/src/ImportCurlDialog.tsx`
- Modify: `web/src/ExportCurlDialog.tsx`

**Interfaces:**
- Consumes: `notifyError`、`notifyHint`
- Produces: 导入解析失败入队且对话框保持打开。复制失败入队且对话框保持打开。复制成功 `notifyHint("已复制")` 后立刻 `onClose()`。按钮文字始终是「复制到剪贴板」。`.curl-option-hint` 不改。

- [ ] **Step 1: 改两个对话框**

`ImportCurlDialog.tsx`：删除 `error` state。`apply` 在 `!result.ok` 时 `notifyError(result.error)` 并 return。`onChange` 只 `setText`。删除 `{error ? <p className="error">...</p> : null}`。`tryApplyImport` 保持不变，解析逻辑不改。

`ExportCurlDialog.tsx` 的 `copyToClipboard` 换成：

```tsx
  async function copyToClipboard() {
    if (!navigator.clipboard?.writeText) {
      notifyError("复制失败");
      return;
    }
    try {
      await navigator.clipboard.writeText(preview);
      notifyHint("已复制");
      onClose();
    } catch {
      notifyError("复制失败");
    }
  }
```

删除 `copied`、`copyError` state，删除 `{copyError ? <p className="error">{copyError}</p> : null}`。按钮子节点改为常量 `复制到剪贴板`。不要改 `.curl-option-hint` 两段说明。

- [ ] **Step 2: 跑测试**

Run: `cd web && npx vitest run src/ImportCurlDialog.test.tsx src/ExportCurlDialog.test.tsx`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/src/ImportCurlDialog.tsx web/src/ExportCurlDialog.tsx
git commit -m "$(cat <<'EOF'
feat(web): toast curl import errors and copy feedback

EOF
)"
```

---

### Task 7: 编辑器、Hosts 列表与历史列表

**Files:**
- Modify: `web/src/EnvEditor.tsx`
- Modify: `web/src/HostsContentEditor.tsx`
- Modify: `web/src/Sidebar.tsx`
- Modify: `web/src/hosts.ts`
- Modify: `web/src/hosts.test.ts`
- Modify: `web/src/App.tsx`
- Modify: `web/src/hosts-panel.test.tsx`

**Interfaces:**
- Consumes: `notifyError`、`hostsNewBlockedReason(listFailed: boolean, hostsSaving?: boolean)`
- Produces: `EnvEditor` / `HostsContentEditor` 无 `error` 属性。`Sidebar` 的 Hosts 属性为 `hostsListFailed?: boolean`。列表失败时新建禁用，空状态标题仍是「还没有 Hosts」。

- [ ] **Step 1: 改 Hosts 阻塞原因测试与侧栏测试**

`web/src/hosts.test.ts` 的 `blocks create when list load failed` 换成：

```ts
  it("blocks create when list load failed", () => {
    expect(hostsNewBlockedReason(true)).toBe(HOSTS_CREATE_BLOCKED_LIST_ERROR);
    expect(hostsNewBlockedReason(false)).toBeNull();
    expect(hostsNewBlockedReason(false, true)).toBe("请等待 Hosts 保存完成");
  });
```

`web/src/hosts-panel.test.tsx`：

- 两个「shows list load error in … empty state」用例仍传入 `error="无法加载 Hosts 列表"`，断言改为不含 `env-editor-error`、不含 `无法加载 Hosts 列表`，仍含各自的 `emptyTitle`。
- `disables new-hosts controls when list load failed` 仍先传 `hostsListError="无法加载 Hosts 列表"`。断言改为含「还没有 Hosts」、不含「Hosts 列表加载失败」、不含「无法加载 Hosts 列表」。本步先不要求 `disabled=""`，因为失败文案还在组件里，禁用断言留到实现步之后的测试更新。

实现 `Sidebar` 改为 `hostsListFailed` 之后，立刻把该用例的属性改成 `hostsListFailed`，并断言新建按钮 `disabled=""`。同时从两个编辑器用例里删除 `error=...`，否则 `npm run build` 的 `tsc` 会因多余属性失败。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd web && npx vitest run src/hosts.test.ts src/hosts-panel.test.tsx`

Expected: FAIL，签名或标记仍是旧的。

- [ ] **Step 3: 去掉编辑器错误，侧栏改为布尔，保存失败入队**

`hostsNewBlockedReason` 改为：

```ts
export function hostsNewBlockedReason(
  listFailed: boolean,
  hostsSaving = false,
): string | null {
  if (hostsSaving) return "请等待 Hosts 保存完成";
  if (listFailed) return HOSTS_CREATE_BLOCKED_LIST_ERROR;
  return null;
}
```

`EnvEditor` 与 `HostsContentEditor`：从 Props、参数和解构里删除 `error`。删除两处 `{error ? <p className="error env-editor-error">...</p> : null}`。空状态只留 `emptyTitle`。

`Sidebar`：`hostsListError?: string | null` 改为 `hostsListFailed?: boolean`，默认 `false`。`hostsCreateDisabled = hostsBusy || hostsListFailed`。新建按钮 `title` 固定为 `"新建"`。空状态固定为标题「还没有 Hosts」、说明「用侧栏 ＋ 或下方按钮创建」，不再因失败换文案。

历史列表：删除 `histError` state。加载失败时 `setHistory([])` 并 `notifyError(err instanceof Error ? err.message : String(err))`。列表为空时始终渲染原来的空状态（标题「还没有历史」，说明「发送成功的请求会列在这里」）。删除 `{histError && <p className="error">...</p>}`。

`App.tsx`：

- 删除 `envError`、`overrideError`、`hostsError` state 与 `hostsErrorRef`
- 增加 `const [hostsListFailed, setHostsListFailed] = useState(false);` 与 `hostsListFailedRef`，赋值方式与现有 `hostsListRef` 相同
- `loadEnv` / `loadOverride` / `loadHosts` 里的 `setEnvError(null)` / `setOverrideError(null)` / `setHostsError(null)` 删除
- 初次 `getHosts` 成功：`setHostsListFailed(false)`。catch：`setHostsList([])`、`setHostsListFailed(true)`、`notifyError(hostsAPIError(errorText(err)))`
- `onSaveEnv` / `onSaveOverride`：删除开头的 `setEnvError(null)` / `setOverrideError(null)`。catch 改为 `notifyError(environmentAPIError(errorText(err)))` 与 `notifyError(overrideAPIError(errorText(err)))`
- `onSaveHosts`：删除 `setHostsError(null)`。校验失败、`converted.error`、保存 catch、以及「已保存，但 Hosts 列表无法刷新：…」都改为 `notifyError(原来的那句)`。列表刷新成功时 `setHostsListFailed(false)`。刷新失败不要把 `hostsListFailed` 设为 true（原列表还在）
- `openNewHostsDialog` 与 `create-hosts` 里的 `hostsNewBlockedReason(hostsErrorRef.current, hostsSavingRef.current)` 改为 `hostsNewBlockedReason(hostsListFailedRef.current, hostsSavingRef.current)`
- JSX：三个编辑器去掉 `error={...}`。`Sidebar` 的 `hostsListError={hostsError}` 改为 `hostsListFailed={hostsListFailed}`

- [ ] **Step 4: 跑测试确认通过**

Run: `cd web && npx vitest run`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/EnvEditor.tsx web/src/HostsContentEditor.tsx web/src/Sidebar.tsx web/src/hosts.ts web/src/hosts.test.ts web/src/App.tsx web/src/hosts-panel.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): toast editor, hosts, and history failures

EOF
)"
```

---

### Task 8: 界面崩溃用一条不倒计时的轻提示

**Files:**
- Modify: `web/src/ErrorBoundary.tsx`
- Create: `web/src/ErrorBoundary.test.tsx`

**Interfaces:**
- Consumes: `notifySticky`
- Produces: 兜底标记不含 `banner`，也不在边界内部渲染「界面出错」。`componentDidCatch` 调用 `notifySticky(\`界面出错：${error.message}\`)`。

- [ ] **Step 1: 写失败测试**

创建 `web/src/ErrorBoundary.test.tsx`：

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ErrorBoundary from "./ErrorBoundary";

function Boom(): React.ReactElement {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  it("renders an empty fallback without a banner", () => {
    const markup = renderToStaticMarkup(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(markup).not.toContain("banner");
    expect(markup).not.toContain("界面出错");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd web && npx vitest run src/ErrorBoundary.test.tsx`

Expected: FAIL，标记含 `banner` 或「界面出错」。

- [ ] **Step 3: 改边界**

```tsx
import { Component, type ErrorInfo, type ReactNode } from "react";
import { notifySticky } from "./toast";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
    notifySticky(`界面出错：${error.message}`);
  }

  render() {
    if (this.state.error) return null;
    return this.props.children;
  }
}
```

`renderToStaticMarkup` 不会跑 `componentDidCatch`，所以本测试只锁兜底标记。不倒计时由 Task 1 的 `notifySticky` 测试锁住。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd web && npx vitest run src/ErrorBoundary.test.tsx src/toast.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/ErrorBoundary.tsx web/src/ErrorBoundary.test.tsx
git commit -m "$(cat <<'EOF'
fix(web): show render crashes as a sticky toast

EOF
)"
```

---

### Task 9: 删除旧样式并重建嵌入界面

**Files:**
- Modify: `web/src/styles.css`
- Modify: `internal/server/ui/`（`npm run build` 产出）

**Interfaces:**
- Consumes: 前面各任务已不再引用 `.banner`、`.response-error-state`、`.env-editor-error`、`.dialog p.error`、`.error`
- Produces: 这些规则从 `styles.css` 删除。嵌入产物含 `.toaster`。

- [ ] **Step 1: 确认没有引用再删规则**

Run: `cd web && rg "className=.banner|className=.error|response-error-state|env-editor-error" src`

Expected: 无匹配。若仍有匹配，先改掉那处调用，不要留着旧失败节点。

从 `web/src/styles.css` 删除：

- `.banner { ... }`
- `.response-error-state { ... }`
- `.error { color: var(--err); }`
- `.dialog p.error { ... }`
- `.env-editor-error { ... }`

保留 `.toast-error`。

- [ ] **Step 2: 全量测试并构建**

Run: `cd web && npm test && npm run build`

Expected: 测试 PASS，`tsc --noEmit` 与 Vite build 成功，`internal/server/ui/` 更新。构建产物的 CSS 含 `.toaster`，不含 `.response-error-state`。

- [ ] **Step 3: Commit**

```bash
git add web/src/styles.css internal/server/ui
git commit -m "$(cat <<'EOF'
chore(ui): drop bordered error styles and rebuild the embed

EOF
)"
```
