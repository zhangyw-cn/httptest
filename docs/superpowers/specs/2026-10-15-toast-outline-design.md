# 轻提示加圆角边框和左侧色条

日期：2026-10-15  
状态：已与用户对齐，待用户审阅本文件后进入实现计划  
前置规格：`docs/superpowers/specs/2026-10-11-toast-notices-design.md`。本文件只取代其中第 4 节这一句：「无边框、无左侧色条」。位置、时长、队列、文案、角色和关闭按钮都保持那份规格。

## 1. 目的

轻提示和顶栏使用同一种表面色，又没有边，贴在顶栏上分不清卡片边界。给每条提示加上和对话框相同的圆角细边框，并用左侧色条标出失败或提示。

成功标准：

- 深色和浅色主题下，提示卡片的四边都能从顶栏表面色上分辨出来。
- 失败条左侧是红色，提示条左侧是强调蓝。字色保持原样。
- 提示的 DOM、入队、时长、悬停暂停和关闭行为不变。

## 2. 约束

样式只改 `web/src/styles.css`。测试只新增读取该文件的断言，不改提示组件。完成后 `cd web && npm run build` 更新 `internal/server/ui/`。不改 Go，不改 README，不新增 npm 包，不新增提示里的 DOM 节点。

## 3. 外观

`.toast` 保持 `background: var(--surface)` 和 `box-shadow: 0 4px 16px rgb(0 0 0 / 28%)`。

在此之上：

- 四边都是 `1px solid var(--line)`。色条不替换左边这条线。
- `border-radius: 8px`，与 `.dialog` 相同。`.toast` 设 `overflow: hidden`，色条被圆角裁齐。
- 左边框内侧有一条宽 `3px` 的色条，从卡片内顶贴到内底，并被圆角裁齐。失败（`.toast-error`，含崩溃那条不倒计时的失败）用 `var(--err)`。提示（`.toast-hint`）用 `var(--accent)`。
- 色条用 `.toast::before` 画出，绝对定位贴在内左侧。正文现有左内边距大于 3px，不压到色条上。
- 失败正文仍是 `var(--err)`，提示正文仍是 `var(--ink)`。

深色和浅色都只使用这些现有变量，不另写颜色。

## 4. 测试

现有 `Toaster` 标记测试继续检查容器、`toast-error` / `toast-hint` 和关闭按钮，不因为色条增加断言节点。

新增一条测试，读取 `web/src/styles.css` 源文，并同时满足：

- `.toast` 含 `border-radius: 8px` 和 `1px solid var(--line)`
- `.toast-error::before` 的背景是 `var(--err)`
- `.toast-hint::before` 的背景是 `var(--accent)`
- 色条宽度是 `3px`

然后 `cd web && npm test` 通过，再 `cd web && npm run build`。嵌入 CSS 中能找到 `.toast` 的 `border-radius:8px`（构建可能去掉空格），且不再有 `.toast` 的 `border:none`。
