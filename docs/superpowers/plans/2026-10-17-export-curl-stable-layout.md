# Export Curl Stable Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 开关说明、勾选选项或命令行数变化时，导出 curl 对话框的外框宽高保持不变。

**Architecture:** 只改 `web/src/styles.css`。对话框用固定 `width` / `max-width` / `height`，说明开关只改变网格列，不再改变外框。视口小于 48rem 时，同一外框内把选项横排到顶部。`ExportCurlDialog.tsx` 已有的 `with-explain` class 继续作为列模板开关。

**Tech Stack:** 现有 React + 手写 CSS。测试用 Vitest（`environment: "node"`，`renderToStaticMarkup`）。不新增 npm 包。

## Global Constraints

- 规格：`docs/superpowers/specs/2026-10-17-export-curl-stable-layout-design.md`。它覆盖 `docs/superpowers/specs/2026-10-17-export-curl-panel-design.md` 第 4.2 节的宽度、64rem 断点、一列堆叠，以及预览栏 `min-height: 12rem`。命令排版、说明文案、勾选语义不动。
- 外框宽度始终是 `min(58rem, 92vw)`。外框高度先写 `min(32rem, calc(100vh - 2rem))`，再写 `min(32rem, calc(100dvh - 2rem))`。这是整个 `.export-curl-dialog`。`.app` 在 `100vh` 后再写 `100dvh`。
- 视口至少 48rem：说明关闭为 `11rem minmax(0, 1fr)`；打开为 `11rem minmax(0, 1fr) 16rem`。
- 视口小于 48rem 用 `@media (max-width: 47.99rem)`。选项在第 1 行，行高 `fit-content(6.5rem)`。说明打开时第 2 行是 `minmax(0, 1fr) minmax(0, min(16rem, 50%))`。`.curl-options` 设 `min-inline-size: 0`。
- 预览 `.curl-export-preview` 的 `min-height` 改为 `0`。`.curl-preview` 保持 `white-space: pre`，不用 `pre-wrap`，也不用 `word-break: break-all`。
- 导入对话框仍是 `min(560px, 92vw)`。
- 源码提交不改 `web/src/ExportCurlDialog.tsx`、`web/src/ExportCurlDialog.test.tsx`、`web/src/curl.ts`、`internal/`。不加 npm 包，不为像素尺寸加断言。
- 样式提交之后另起一个 `chore` 提交：在 `web/` 运行 `npm run build`，更新 `internal/server/ui/`。这与 README「开发」一致。`fd7b539` 的嵌入 JS 同时带上了此前未重建的导出 curl 说明栏。
- 每个提交只 `git add` 该任务列出的文件。

## File Structure

- Modify: `web/src/styles.css` — 导出对话框外框、宽屏网格、窄屏网格、预览最小高度。`.import-curl-dialog` 及其后的规则不动。
- Modify: `README.md` — 「界面」段落里导出 curl 那一个分句。
- Modify: `docs/superpowers/specs/2026-10-17-export-curl-stable-layout-design.md` — 状态行改为已审阅并指向本计划。

本任务不产生新的导出函数。后续没有别的任务要接这些 class。

---

### Task 1: 固定导出对话框外框

**Files:**
- Modify: `web/src/styles.css`（`.export-curl-dialog` 到 `@media (max-width: 63.99rem)` 整段，约 830–967 行）
- Modify: `README.md`（「界面」段落中的导出 curl 分句）
- Modify: `docs/superpowers/specs/2026-10-17-export-curl-stable-layout-design.md`（文首状态行）
- Test: `web/src/ExportCurlDialog.test.tsx`（只跑，不改）

**Interfaces:**
- Consumes: `ExportCurlDialog.tsx` 已有的 class：`dialog`、`export-curl-dialog`、`with-explain`、`curl-export-body`、`curl-options`、`curl-export-preview`、`curl-preview`、`curl-export-explain`。说明关闭时 DOM 里没有 `with-explain`，也没有 `.curl-export-explain`。
- Produces: 无新的函数或 class。窄屏摆放只用上面这些已有选择器。

规格禁止改测试文件，也禁止为像素加断言。本任务的自动门是现有 `npm test` 仍然通过。外框尺寸靠步骤 6 的手工清单。

- [ ] **Step 1: 跑现有测试，确认起点是通过的**

Run: `cd web && npm test`

Expected: PASS。若失败，先停，不要改样式。

- [ ] **Step 2: 换掉导出对话框的样式**

在 `web/src/styles.css` 中，用下面这一整段替换从 `.export-curl-dialog {` 开始、到 `@media (max-width: 63.99rem)` 代码块结束为止的内容。`.import-curl-dialog { width: min(560px, 92vw); }` 留在这段前面。`.import-curl-dialog .curl-import-input` 留在这段后面。

```css
.export-curl-dialog {
  width: min(58rem, 92vw);
  max-width: min(58rem, 92vw);
  min-width: 0;
  height: min(32rem, calc(100vh - 2rem));
  height: min(32rem, calc(100dvh - 2rem));
  display: flex;
  flex-direction: column;
}

.curl-export-body {
  display: grid;
  grid-template-columns: 11rem minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  gap: 0.75rem;
  min-height: 0;
  min-width: 0;
  flex: 1;
  overflow: hidden;
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
  min-inline-size: 0;
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
  min-height: 0;
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

.curl-explain-list .curl-explain-detail {
  margin: 0.15rem 0 0;
  color: var(--muted);
  font-size: 0.78rem;
}

@media (max-width: 47.99rem) {
  .curl-export-body,
  .export-curl-dialog.with-explain .curl-export-body {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: fit-content(6.5rem) minmax(0, 1fr);
  }

  .export-curl-dialog.with-explain .curl-export-body {
    grid-template-columns: minmax(0, 1fr) minmax(0, min(16rem, 50%));
  }

  .curl-options {
    grid-column: 1 / -1;
    grid-row: 1;
    flex-direction: row;
    flex-wrap: wrap;
    align-content: flex-start;
    max-height: 6.5rem;
  }

  .curl-export-preview {
    grid-column: 1;
    grid-row: 2;
  }

  .curl-export-explain {
    grid-column: 2;
    grid-row: 2;
  }
}
```

这段相对现状的差别：

- 对话框宽度在说明开关时都是 `min(58rem, 92vw)`，并加上同样的 `max-width` 和 `min-width: 0`。
- `max-height: calc(100vh - 2rem)` 换成两条 `height`：先 `min(32rem, calc(100vh - 2rem))`，再 `min(32rem, calc(100dvh - 2rem))`。窄屏说明列是 `minmax(0, min(16rem, 50%))`。`.curl-options` 有 `min-inline-size: 0`。
- 删除 `.export-curl-dialog.with-explain { width: min(58rem, 92vw); }`。
- `.curl-export-body` 增加 `min-width: 0` 和 `overflow: hidden`。
- `.curl-export-preview` 的 `min-height: 12rem` 改为 `0`。
- `@media (max-width: 63.99rem)` 换成 `@media (max-width: 47.99rem)`。窄屏不再把宽度改成 `min(40rem, 92vw)`，也不再把三块合成一列滚动。

- [ ] **Step 3: 再跑测试**

Run: `cd web && npm test`

Expected: PASS。失败时只查是不是误改了 class 名或删了测试仍依赖的静态结构；不要为了尺寸去改 `ExportCurlDialog.test.tsx`。

- [ ] **Step 4: 改 README 的导出 curl 分句**

在 `README.md` 的「界面」段落里，把这一句：

```text
「导出 curl」（左侧功能选项、右侧预览、可选说明栏、复制到剪贴板）
```

换成：

```text
「导出 curl」（宽屏左侧功能选项、右侧预览，视口小于 48rem 时选项在顶部；可选说明栏；复制到剪贴板）
```

前后句子保持不动。

- [ ] **Step 5: 把规格状态指到本计划**

在 `docs/superpowers/specs/2026-10-17-export-curl-stable-layout-design.md` 文首，把：

```markdown
状态：待用户审阅
```

换成：

```markdown
状态：用户已审阅。实现计划：`docs/superpowers/plans/2026-10-17-export-curl-stable-layout.md`
```

- [ ] **Step 6: 核对样式和文案**

Run:

```bash
rg -n "export-curl-dialog|63\\.99rem|min-height: 12rem" web/src/styles.css
rg -n "视口小于 48rem 时选项在顶部" README.md
```

Expected:

- `.export-curl-dialog` 的宽度是 `min(58rem, 92vw)`，没有单独的 `.export-curl-dialog.with-explain` 宽度规则。
- 文件里不再出现 `63.99rem`。
- `.curl-export-preview` 下是 `min-height: 0`。其它选择器上的 `min-height: 12rem`（结果区等）可以还在。
- README 命中「视口小于 48rem 时选项在顶部」。

- [ ] **Step 7: 手工看外框**

先按 README 启动：Go 服务听 `http://127.0.0.1:1370`，再在 `web/` 运行 `npm run dev`。打开一次「导出 curl」。用开发者工具量 `.export-curl-dialog` 的宽高，同一视口内重复量：

- 开关「说明」、勾选选项、命令行数变化时，宽高数值不变。
- 视口至少 48rem：关闭时两列，打开时三列，预览变窄。宽是 `min(58rem, 92vw)`，高是 `min(32rem, calc(100dvh - 2rem))`（不支持时用 `100vh`）。
- 把视口缩到小于 48rem：选项到顶部横排，打开说明后预览与说明并排。外框宽高公式与上一条相同。选项区超过 6.5rem 时只滚选项区。
- 把窗口压到比 32rem 加上下边距更矮：对话框高度变成 `calc(100dvh - 2rem)`（不支持时用 `100vh`），文档本身不因此出现滚动条。窄屏打开说明时，说明列不超过内容区一半。
- 很长的一行 curl 在 `.curl-preview` 里横向滚动，对话框不变宽。

- [ ] **Step 8: 提交**

```bash
git add web/src/styles.css README.md docs/superpowers/specs/2026-10-17-export-curl-stable-layout-design.md
git commit -m "$(cat <<'EOF'
fix(web): keep the export curl dialog frame stable

Stop the dialog from resizing when the explanation panel, options, or command length change.

EOF
)"
```

这一次提交不要 `git add` `internal/server/ui/`，也不要运行 `npm run build`。嵌入资源留到下一个 `chore` 提交。
