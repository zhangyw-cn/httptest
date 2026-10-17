# Toast Outline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给顶部轻提示加上 8px 圆角、一圈分隔线，以及内侧 3px 色条，让它和同色顶栏分开。

**Architecture:** 只改 `web/src/styles.css`。卡片边框写在 `.toast` 上，色条用绝对定位的 `.toast::before`，失败和提示各自给 `::before` 上色。`Toaster` 已经按级别加上 `toast-error` 或 `toast-hint`，崩溃提示也是 `toast-error`，所以不改组件。

**Tech Stack:** 现有 React + TypeScript + Vite + 手写 CSS。测试用 Vitest（`environment: "node"`），读取样式源文，不新增 npm 包。

## Global Constraints

- 规格：`docs/superpowers/specs/2026-10-15-toast-outline-design.md`。它只取代 `docs/superpowers/specs/2026-10-11-toast-notices-design.md` 第 4 节「无边框、无左侧色条」。位置、时长、队列、文案、角色和关闭按钮保持那份规格。
- 样式只改 `web/src/styles.css`。不改 `web/src/Toaster.tsx`，不新增提示里的 DOM 节点。
- 不改 Go，不改 README，不新增 npm 包。
- 深色和浅色都只用现有变量：边框 `var(--line)`，失败色条 `var(--err)`，提示色条 `var(--accent)`，正文颜色不改。
- 工作区里已有与本计划无关的未提交改动。每个提交只 `git add` 该任务列出的文件。
- `npm run build` 会把当前整个 `web/src` 打进嵌入产物。不要为了本计划去还原那些无关改动。

## File Structure

- Modify: `web/src/styles.css` — `.toast` 的边框、圆角、裁切，以及 `::before` 色条。
- Create: `web/src/toast-outline.test.ts` — 读取 `styles.css` 源文，锁住圆角、分隔线和两条色条。
- Modify: `internal/server/ui/` — `npm run build` 生成的 `index.html` 和替换掉的 CSS/JS 资源。不手工改。

## 实现更正

`styles.css?raw` 在这个仓库的 Vitest 里是空字符串。`fetch(file URL)` 也未实现。测试放在 `web/src/toast-outline.test.ts`，用 `node:fs` 读取同目录的 `styles.css`。三条 Node 导入各加一行 `@ts-expect-error`，这样 `tsc --noEmit` 不需要 `@types/node`。找不到选择器时抛出 `missing <selector>`，不要截到文件里的第一段规则。

---

### Task 1: 圆角边框和左侧色条

**Files:**
- Create: `web/src/toast-outline.test.ts`
- Modify: `web/src/styles.css:264-283`
- Test: `web/src/toast-outline.test.ts`

**Interfaces:**
- Consumes: `Toaster` 已有的 class。失败和崩溃提示是 `toast toast-error`，短暂反馈是 `toast toast-hint`。不要改这些 class。
- Produces: `.toast` 含 `border: 1px solid var(--line)`、`border-radius: 8px`、`overflow: hidden`、`position: relative`。`.toast::before` 宽 `3px`，绝对定位贴在内左侧。`.toast-error::before` 背景 `var(--err)`。`.toast-hint::before` 背景 `var(--accent)`。`.toast-error` 的 `color` 仍是 `var(--err)`，`.toast-hint` 的 `color` 仍是 `var(--ink)`。

- [ ] **Step 1: Write the failing test**

Create `web/src/toast-outline.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function rule(selector: string): string {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "styles.css"),
    "utf8",
  );
  const start = source.indexOf(`${selector} {`);
  const open = source.indexOf("{", start);
  const close = source.indexOf("}", open);
  return source.slice(open + 1, close);
}

describe("toast outline", () => {
  it("draws a rounded line and a 3px kind bar inside it", () => {
    const toast = rule(".toast");
    expect(toast).toContain("border: 1px solid var(--line)");
    expect(toast).toContain("border-radius: 8px");
    expect(toast).toContain("overflow: hidden");
    expect(toast).not.toContain("border: none");

    const bar = rule(".toast::before");
    expect(bar).toContain("width: 3px");
    expect(bar).toContain("position: absolute");
    expect(bar).toContain("left: 0");
    expect(bar).toContain("top: 0");
    expect(bar).toContain("bottom: 0");

    expect(rule(".toast-error::before")).toContain("background: var(--err)");
    expect(rule(".toast-hint::before")).toContain("background: var(--accent)");
    expect(rule(".toast-error")).toContain("color: var(--err)");
    expect(rule(".toast-hint")).toContain("color: var(--ink)");
  });
});
```

`.dialog` 里已经有 `border-radius: 8px`。测试必须截取 `.toast {` 这一块，不能在整个文件里搜索。

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/toast-outline.test.ts`

Expected: FAIL. `.toast` 目前是 `border: none`，没有 `border-radius: 8px`。`rule(".toast::before")` 截到的也不是色条规则。

- [ ] **Step 3: Write minimal implementation**

Replace the `.toast`, `.toast-error`, and `.toast-hint` rules in `web/src/styles.css` with:

```css
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
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

.toast::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
}

.toast-error {
  color: var(--err);
}

.toast-error::before {
  background: var(--err);
}

.toast-hint {
  color: var(--ink);
}

.toast-hint::before {
  background: var(--accent);
}
```

保留原来的 `background`、`box-shadow`、`padding: 0.55rem 0.65rem` 和正文 `color`。不要把左边改成 `border-left`，那会换掉左边的分隔线。不要改 `.toast-message` 或 `.toast-close`。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/toast-outline.test.ts`

Expected: PASS.

Run: `cd web && npm test`

Expected: PASS. 现有 `Toaster` 标记测试仍然只检查容器、级别 class 和关闭按钮。

- [ ] **Step 5: Commit**

```bash
git add web/src/styles.css web/src/toast-outline.test.ts
git commit -m "$(cat <<'EOF'
feat(web): outline toasts so they separate from the top bar

EOF
)"
```

只提交这两个文件。

---

### Task 2: 重建嵌入界面

**Files:**
- Modify: `internal/server/ui/index.html`
- Modify: `internal/server/ui/assets/` 中被本次构建替换的 CSS 和 JS

**Interfaces:**
- Consumes: Task 1 写进 `web/src/styles.css` 的 `.toast` 规则。
- Produces: `internal/server/ui/index.html` 指向的 CSS 里，`.toast{...}` 含 `border-radius:8px` 和 `border:1px solid var(--line)`，且这个块里没有 `border:none`。

- [ ] **Step 1: Rebuild the embed**

Run: `cd web && npm run build`

Expected: `tsc --noEmit` 通过，Vite 写入 `../internal/server/ui/`。`emptyOutDir` 会删掉旧的哈希资源。不要手工改 `index.html`。

- [ ] **Step 2: Check the built toast rule**

Run from the repo root:

```bash
python3 - <<'PY'
import re
import pathlib

html = pathlib.Path("internal/server/ui/index.html").read_text()
name = re.search(r'assets/index-[^"]+\.css', html).group(0)
css = pathlib.Path("internal/server/ui", name).read_text()
blocks = re.findall(r"\.toast\{[^}]*\}", css)
assert blocks, "missing .toast block"
toast = blocks[0]
assert "border-radius:8px" in toast, toast
assert "border:1px solid var(--line)" in toast, toast
assert "border:none" not in toast, toast
print(name)
print(toast)
PY
```

Expected: 打印新的 CSS 文件名，以及含 `border-radius:8px` 和 `border:1px solid var(--line)` 的 `.toast{...}`。失败则不要提交。

- [ ] **Step 3: Commit**

```bash
git add internal/server/ui
git commit -m "$(cat <<'EOF'
chore(ui): rebuild the embed with the toast outline

EOF
)"
```

只提交 `internal/server/ui`。不要把 `web/src` 里其他未提交文件加进去。
