# Toast Levels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把轻提示分成错误、警告、信息三级，按主题使用已定的底色、边框和字色，并去掉左侧色条。

**Architecture:** `web/src/toast.ts` 把 `hint` 改成 `info`，并新增 `warning`。`Toaster` 按三级输出 class 和角色。颜色放进现有的深色、浅色变量块，`.toast-*` 只引用这些变量。不新增 DOM 节点。

**Tech Stack:** 现有 React + TypeScript + Vite + 手写 CSS。测试用 Vitest（`environment: "node"`）。不新增 npm 包。

## Global Constraints

- 规格：`docs/superpowers/specs/2026-10-17-toast-levels-design.md`。它取代 `docs/superpowers/specs/2026-10-15-toast-outline-design.md` 的左侧色条、中性边框、失败红字、提示蓝条和提示字色。位置、队列、悬停暂停和关闭按钮保持 `docs/superpowers/specs/2026-10-11-toast-notices-design.md`。
- `ToastItem.kind` 是 `"error" | "warning" | "info"`。删除 `notifyHint`，不留别名。
- `notifyError` 8000ms，`role="alert"`，class `toast toast-error`。`notifySticky` 仍是错误且不倒计时。`notifyWarning` 5000ms，`role="status"`，class `toast toast-warning`。`notifyInfo` 3000ms，`role="status"`，class `toast toast-info`。
- 重复键仍是「正文 + 级别 + 是否不倒计时」。空字符串不入队。`noticesForResult` 和 `publishResultNotices` 仍只入队错误。
- 深色 `--toast-shadow` 是 `0 4px 16px rgb(0 0 0 / 28%)`。浅色是 `0 4px 16px rgb(0 0 0 / 12%)`。色值以规格第 3 节两张表为准，不使用 `--err`、`--warn`、`--ok`、`--accent`、`--ink`、`--surface`、`--line` 给提示上色。
- 对话框说明、`.curl-option-hint`、各处空状态都不改。不改 Go，不改 README，不加 npm 包。
- 工作区里已有与本计划无关的未提交改动。每个提交只 `git add` 该任务列出的文件。
- `npm run build` 会把当前整个 `web/src` 打进嵌入产物。不要为了本计划去还原那些无关改动。

## File Structure

- Modify: `web/src/toast.ts` — 级别、`notifyInfo`、`notifyWarning`。队列机制不动。
- Modify: `web/src/toast.test.ts` — 时长、空消息、同一句正文的错误和警告。
- Modify: `web/src/Toaster.tsx` — 三级 class 和角色。不新增节点。
- Modify: `web/src/Toaster.test.tsx` — 三条提示的标记。
- Modify: `web/src/ExportCurlDialog.tsx` — 复制成功改为 `notifyInfo("已复制")`。
- Modify: `web/src/styles.css` — 两个主题块里的变量，以及 `.toast` 三级规则。删掉色条。
- Modify: `web/src/toast-outline.test.ts` — 锁住变量、边框和「没有色条」。
- Modify: `internal/server/ui/` — `npm run build` 生成。不手工改。

---

### Task 1: 队列里的错误、警告和信息

**Files:**
- Modify: `web/src/toast.ts:1-98`
- Test: `web/src/toast.test.ts`

**Interfaces:**
- Consumes: 现有 `enqueue(message, kind, sticky, ms)`。`notifyError` 与 `notifySticky` 的调用点保持不变。
- Produces:
  - `kind: "error" | "warning" | "info"`
  - `export function notifyError(message: string): void` — 8000ms
  - `export function notifyWarning(message: string): void` — 5000ms，`sticky: false`
  - `export function notifyInfo(message: string): void` — 3000ms，`sticky: false`
  - `export function notifySticky(message: string): void` — `kind: "error"`，`sticky: true`
  - 不再导出 `notifyHint`

- [ ] **Step 1: Write the failing test**

在 `web/src/toast.test.ts` 里，把导入中的 `notifyHint` 换成 `notifyInfo, notifyWarning`。

把「drops empty messages」里的 `notifyHint("")` 换成：

```ts
    notifyInfo("");
    notifyWarning("");
```

把「removes an error after 8000ms and a hint after 3000ms」整段换成：

```ts
  it("removes an error after 8000ms and an info after 3000ms", () => {
    notifyError("保存失败");
    notifyInfo("已复制");
    expect(getToasts().map((t) => t.message)).toEqual(["已复制", "保存失败"]);
    vi.advanceTimersByTime(3000);
    expect(getToasts().map((t) => t.message)).toEqual(["保存失败"]);
    vi.advanceTimersByTime(5000);
    expect(getToasts()).toEqual([]);
  });

  it("removes a warning after 5000ms and keeps the error", () => {
    notifyError("保存失败");
    notifyWarning("请等待 Hosts 保存完成");
    vi.advanceTimersByTime(5000);
    expect(getToasts().map((t) => t.message)).toEqual(["保存失败"]);
    vi.advanceTimersByTime(3000);
    expect(getToasts()).toEqual([]);
  });

  it("keeps an error and a warning that share a message", () => {
    notifyError("保存失败");
    notifyWarning("保存失败");
    expect(getToasts().map((t) => [t.kind, t.message])).toEqual([
      ["warning", "保存失败"],
      ["error", "保存失败"],
    ]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/toast.test.ts`

Expected: FAIL。`./toast` 没有导出 `notifyInfo`。不要跑整个 `npm test`，`Toaster.test.tsx` 还在导入 `notifyHint`。

- [ ] **Step 3: Write minimal implementation**

在 `web/src/toast.ts` 里把级别和三个计时常量改成：

```ts
  kind: "error" | "warning" | "info";
```

```ts
const ERROR_MS = 8000;
const WARNING_MS = 5000;
const INFO_MS = 3000;
```

删掉 `HINT_MS` 和 `notifyHint`。`notifyError` 与 `notifySticky` 保持原样。加上：

```ts
export function notifyWarning(message: string) {
  enqueue(message, "warning", false, WARNING_MS);
}

export function notifyInfo(message: string) {
  enqueue(message, "info", false, INFO_MS);
}
```

不要改 `enqueue`、`noticesForResult`、`publishResultNotices`。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/toast.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add web/src/toast.ts web/src/toast.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add warning and info toast levels

EOF
)"
```

只提交这两个文件。

---

### Task 2: 三级卡片和复制成功

**Files:**
- Modify: `web/src/Toaster.tsx:10-16`
- Modify: `web/src/Toaster.test.tsx:6,42-56`
- Modify: `web/src/ExportCurlDialog.tsx:3,37`
- Test: `web/src/Toaster.test.tsx`

**Interfaces:**
- Consumes: Task 1 的 `notifyError`、`notifyWarning`、`notifyInfo`。`ToastItem.kind` 是 `"error" | "warning" | "info"`。
- Produces: 错误卡片 `class="toast toast-error"`、`role="alert"`。警告卡片 `class="toast toast-warning"`、`role="status"`。信息卡片 `class="toast toast-info"`、`role="status"`。复制成功调用 `notifyInfo("已复制")`。源码里不再有 `notifyHint` 或 `toast-hint`（`styles.css` 除外，那是 Task 3）。

- [ ] **Step 1: Write the failing test**

`web/src/Toaster.test.tsx` 的导入改为：

```ts
import { notifyError, notifyInfo, notifyWarning, resetToastsForTests } from "./toast";
```

把「renders an error and a hint...」整段换成：

```tsx
  it("renders an error, a warning, and an info in a top-center stack", () => {
    notifyError("缺少变量：baseUrl");
    notifyWarning("请等待 Hosts 保存完成");
    notifyInfo("已复制");
    const markup = renderToStaticMarkup(<Toaster />);
    expect(markup).toContain('class="toaster"');
    expect(markup.indexOf("已复制")).toBeLessThan(
      markup.indexOf("请等待 Hosts 保存完成"),
    );
    expect(markup.indexOf("请等待 Hosts 保存完成")).toBeLessThan(
      markup.indexOf("缺少变量：baseUrl"),
    );
    expect(markup).toContain('class="toast toast-info"');
    expect(markup).toContain('class="toast toast-warning"');
    expect(markup).toContain('class="toast toast-error"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('aria-label="关闭"');
    expect(markup).not.toContain("toast-hint");
    expect(markup).not.toContain("banner");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/Toaster.test.tsx`

Expected: FAIL。标记里没有 `toast-warning` 或 `toast-info`。

- [ ] **Step 3: Write minimal implementation**

把 `web/src/Toaster.tsx` 里那条 class 和 role 换成：

```tsx
          className={
            item.kind === "error"
              ? "toast toast-error"
              : item.kind === "warning"
                ? "toast toast-warning"
                : "toast toast-info"
          }
          role={item.kind === "error" ? "alert" : "status"}
```

其余节点、悬停暂停和关闭按钮不动。

`web/src/ExportCurlDialog.tsx`：

```ts
import { notifyError, notifyInfo } from "./toast";
```

```ts
      notifyInfo("已复制");
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/Toaster.test.tsx src/toast.test.ts`

Expected: PASS。

然后从仓库根目录确认 TypeScript 源里不再有旧名字（样式留给 Task 3）：

```bash
if rg -n "notifyHint|toast-hint" web/src -g '!styles.css'; then
  echo "still present"
  exit 1
else
  echo "gone"
fi
```

Expected: 打印 `gone`。

- [ ] **Step 5: Commit**

```bash
git add web/src/Toaster.tsx web/src/Toaster.test.tsx web/src/ExportCurlDialog.tsx
git commit -m "$(cat <<'EOF'
feat(web): render warning and info toasts

EOF
)"
```

只提交这三个文件。

---

### Task 3: 主题色和去掉色条

**Files:**
- Modify: `web/src/styles.css:1-60` 和 `web/src/styles.css:264-303`
- Test: `web/src/toast-outline.test.ts`

**Interfaces:**
- Consumes: Task 2 的 class：`toast-error`、`toast-warning`、`toast-info`。
- Produces: 深色块和浅色块里的 `--toast-shadow` 与九个色变量。`.toast` 使用 `box-shadow: var(--toast-shadow)` 和 `border-radius: 8px`，没有 `background`、`overflow: hidden`、`position: relative`。三个级别规则各写 `background`、`color` 和 `border: 1px solid`。没有 `.toast::before`，没有 `toast-hint`。`.toast-close` 仍是 `color: inherit`。

- [ ] **Step 1: Write the failing test**

用下面的文件覆盖 `web/src/toast-outline.test.ts`。保留文件顶部的三条 `@ts-expect-error` 导入，因为这个包没有 `@types/node`，而 `styles.css?raw` 在 Vitest 里是空字符串。

```ts
// Vitest runs these tests in Node. This package has no @types/node, and
// styles.css?raw comes back empty, so the file is read with a suppressed import.
// @ts-expect-error node builtins are available at test runtime
import { readFileSync } from "node:fs";
// @ts-expect-error node builtins are available at test runtime
import { dirname, join } from "node:path";
// @ts-expect-error node builtins are available at test runtime
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(): string {
  return readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "styles.css"),
    "utf8",
  );
}

function rule(selector: string): string {
  const text = source();
  const start = text.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`missing ${selector}`);
  const open = text.indexOf("{", start);
  const close = text.indexOf("}", open);
  if (open < 0 || close < 0) throw new Error(`missing ${selector}`);
  return text.slice(open + 1, close);
}

function between(start: string, end: string): string {
  const text = source();
  const from = text.indexOf(start);
  if (from < 0) throw new Error(`missing ${start}`);
  const to = text.indexOf(end, from + start.length);
  if (to < 0) throw new Error(`missing ${end}`);
  return text.slice(from, to);
}

describe("toast levels", () => {
  it("paints each kind from theme variables and draws no side bar", () => {
    const text = source();
    expect(text).not.toContain(".toast::before");
    expect(text).not.toContain("toast-hint");

    const toast = rule(".toast");
    expect(toast).toContain("border-radius: 8px");
    expect(toast).toContain("box-shadow: var(--toast-shadow)");
    expect(toast).not.toContain("overflow: hidden");
    expect(toast).not.toContain("position: relative");
    expect(toast).not.toContain("var(--line)");
    expect(toast).not.toContain("var(--surface)");

    expect(rule(".toast-error")).toContain("background: var(--toast-error-bg)");
    expect(rule(".toast-error")).toContain(
      "border: 1px solid var(--toast-error-border)",
    );
    expect(rule(".toast-error")).toContain("color: var(--toast-error-ink)");

    expect(rule(".toast-warning")).toContain(
      "background: var(--toast-warning-bg)",
    );
    expect(rule(".toast-warning")).toContain(
      "border: 1px solid var(--toast-warning-border)",
    );
    expect(rule(".toast-warning")).toContain("color: var(--toast-warning-ink)");

    expect(rule(".toast-info")).toContain("background: var(--toast-info-bg)");
    expect(rule(".toast-info")).toContain(
      "border: 1px solid var(--toast-info-border)",
    );
    expect(rule(".toast-info")).toContain("color: var(--toast-info-ink)");

    const dark = between(":root,", 'html[data-theme="light"]');
    expect(dark).toContain("--toast-shadow: 0 4px 16px rgb(0 0 0 / 28%)");
    expect(dark).toContain("--toast-error-bg: #361e1c");
    expect(dark).toContain("--toast-error-border: #d67166");
    expect(dark).toContain("--toast-error-ink: #f2e2de");
    expect(dark).toContain("--toast-warning-bg: #31281c");
    expect(dark).toContain("--toast-warning-border: #d29d41");
    expect(dark).toContain("--toast-warning-ink: #f0e9db");
    expect(dark).toContain("--toast-info-bg: #1a2d25");
    expect(dark).toContain("--toast-info-border: #47ae7e");
    expect(dark).toContain("--toast-info-ink: #ddeee6");
    expect(dark).not.toContain("#f7eeed");

    const light = between('html[data-theme="light"]', "\n* {");
    expect(light).toContain("--toast-shadow: 0 4px 16px rgb(0 0 0 / 12%)");
    expect(light).toContain("--toast-error-bg: #f7eeed");
    expect(light).toContain("--toast-error-border: #9d2d25");
    expect(light).toContain("--toast-error-ink: #53211d");
    expect(light).toContain("--toast-warning-bg: #f5f0e6");
    expect(light).toContain("--toast-warning-border: #815822");
    expect(light).toContain("--toast-warning-ink: #4a331c");
    expect(light).toContain("--toast-info-bg: #e8f2ed");
    expect(light).toContain("--toast-info-border: #27684a");
    expect(light).toContain("--toast-info-ink: #183a2d");
    expect(light).not.toContain("#361e1c");
  });

  it("throws when the selector is absent", () => {
    expect(() => rule(".not-a-toast")).toThrow("missing .not-a-toast");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/toast-outline.test.ts`

Expected: FAIL。源文仍有 `.toast::before` 或 `toast-hint`，或者还没有 `--toast-shadow`。

- [ ] **Step 3: Write minimal implementation**

在 `:root, html[data-theme="dark"]` 块里，`--accent-hover: #388bfd;` 后面加上：

```css
  --toast-shadow: 0 4px 16px rgb(0 0 0 / 28%);
  --toast-error-bg: #361e1c;
  --toast-error-border: #d67166;
  --toast-error-ink: #f2e2de;
  --toast-warning-bg: #31281c;
  --toast-warning-border: #d29d41;
  --toast-warning-ink: #f0e9db;
  --toast-info-bg: #1a2d25;
  --toast-info-border: #47ae7e;
  --toast-info-ink: #ddeee6;
```

在 `html[data-theme="light"], html[data-theme="system"][data-resolved-theme="light"]` 块里，`--accent-hover: #0860ca;` 后面加上：

```css
  --toast-shadow: 0 4px 16px rgb(0 0 0 / 12%);
  --toast-error-bg: #f7eeed;
  --toast-error-border: #9d2d25;
  --toast-error-ink: #53211d;
  --toast-warning-bg: #f5f0e6;
  --toast-warning-border: #815822;
  --toast-warning-ink: #4a331c;
  --toast-info-bg: #e8f2ed;
  --toast-info-border: #27684a;
  --toast-info-ink: #183a2d;
```

用下面的规则替换从 `.toast` 到 `.toast-hint::before` 的整段。保留后面的 `.toast-message` 和 `.toast-close`，不要改它们。

```css
.toast {
  pointer-events: auto;
  width: 100%;
  max-width: 22rem;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.55rem 0.65rem;
  box-shadow: var(--toast-shadow);
  border-radius: 8px;
}

.toast-error {
  background: var(--toast-error-bg);
  border: 1px solid var(--toast-error-border);
  color: var(--toast-error-ink);
}

.toast-warning {
  background: var(--toast-warning-bg);
  border: 1px solid var(--toast-warning-border);
  color: var(--toast-warning-ink);
}

.toast-info {
  background: var(--toast-info-bg);
  border: 1px solid var(--toast-info-border);
  color: var(--toast-info-ink);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/toast-outline.test.ts src/Toaster.test.tsx src/toast.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add web/src/styles.css web/src/toast-outline.test.ts
git commit -m "$(cat <<'EOF'
feat(web): color toast levels and drop the side bar

EOF
)"
```

只提交这两个文件。

---

### Task 4: 重建嵌入界面

**Files:**
- Modify: `internal/server/ui/index.html`
- Modify: `internal/server/ui/assets/` 中被本次构建替换的 CSS 和 JS

**Interfaces:**
- Consumes: Task 1 到 Task 3 的队列、标记和 `styles.css`。
- Produces: `internal/server/ui/index.html` 指向的 CSS 含 `#361e1c` 和 `#f7eeed`，且不含 `toast-hint`。

- [ ] **Step 1: Run the full test suite**

Run: `cd web && npm test`

Expected: PASS。

- [ ] **Step 2: Rebuild the embed**

Run: `cd web && npm run build`

Expected: `tsc --noEmit` 通过，Vite 写入 `../internal/server/ui/`。`emptyOutDir` 会删掉旧的哈希资源。不要手工改 `index.html`。

- [ ] **Step 3: Check the built CSS**

从仓库根目录运行：

```bash
python3 - <<'PY'
import re
import pathlib

html = pathlib.Path("internal/server/ui/index.html").read_text()
name = re.search(r'assets/index-[^"]+\.css', html).group(0)
css = pathlib.Path("internal/server/ui", name).read_text()
assert "#361e1c" in css, name
assert "#f7eeed" in css, name
assert "toast-hint" not in css, name
print(name)
PY
```

Expected: 打印新的 CSS 文件名。两个色值都在，且没有 `toast-hint`。失败则不要提交。

- [ ] **Step 4: Commit**

```bash
git add internal/server/ui
git commit -m "$(cat <<'EOF'
chore(ui): rebuild the embed with toast level colors

EOF
)"
```

只提交 `internal/server/ui`。不要把 `web/src` 里其他未提交文件，或 `web/tsconfig.tsbuildinfo`，加进去。
