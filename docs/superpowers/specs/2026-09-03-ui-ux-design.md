# httptest UI / UX 设计规格

日期：2026-09-03  
状态：已与用户对齐，待用户审阅本文件后进入实现计划

## 1. 目的与成功标准

优化 Web UI 的布局、主题和日常操作路径。产品功能与 Go API 不变，仍是本机 HTTP 调试工具。

成功标准：

- 深色为默认主题，另有浅色；顶栏可在浅色 / 深色 / 跟随系统三档间切换，并记住选择。
- 左缘为 VS Code 式活动栏（常驻）+ 可收起的集合/历史树。Method / URL / Send 横跨请求栏与响应栏，不压到树上。
- 新建、无路径保存、删除不再使用 `window.prompt` / `window.confirm`，改为应用内对话框。
- `Ctrl+Enter` 发送，`Ctrl+S` 保存，`Ctrl+B` 开合侧栏树（Mac 上 Cmd 等效）。
- 集合、历史、响应区有明确空状态。

非目标（本次不做）：未保存切换提醒、栏宽拖动、密钥面板重做、历史选中高亮、多请求标签、新 HTTP 能力、Web 字体文件、新 npm 依赖、Go API 变更。

## 2. 约束

| 项 | 决定 |
|----|------|
| 范围 | 仅 `web/` 前端（含嵌入构建产物的常规流程）；不改 `internal/`、`cmd/` |
| 栈 | 现有 React + TypeScript + Vite + 手写 CSS |
| 依赖 | 不新增 npm 包 |
| 实现结构 | 按界面单元拆组件：ActivityBar、UrlBar、Dialog、主题菜单；CSS 变量做两套主题 |
| 主题存储 | `localStorage` 键 `httptest.theme`，值 `light` \| `dark` \| `system` |
| 侧栏开合 | 不持久化；刷新后默认展开「集合」 |
| 语言 | 界面中文；协议词保留 Method 名与 Query / Headers / Body / Send / Stop / Save |
| README | 实现后更新「界面」一节，使之与新壳层一致 |

## 3. 壳层与组件

```
┌─ TopBar: httptest | cwd | 浅色/深色/系统 | 环境 | 密钥 ─┐
├────┬──────────┬─────────────────────────────────────────┤
│ 活 │ 集合树   │ Method  URL              未保存 Send… │
│ 动 │ 或历史   ├────────────────────┬────────────────────┤
│ 栏 │ （可收） │ Query/Headers/Body │ 状态  Body/…      │
└────┴──────────┴────────────────────┴────────────────────┘
```

职责：

- **ActivityBar**（宽 48px，常驻）：集合、历史两个图标。选中项左侧 2px 指示条。悬停显示名称；集合带 `Ctrl+B`。
- **Sidebar**：标题「集合」或「历史」；集合标题栏右侧「＋」新建。收起时不占宽度。展开宽度 220px。原先侧栏内的「集合 | 历史」页签去掉，改由活动栏切换。
- **UrlBar**：从 `RequestEditor` 抽出，横跨请求栏与响应栏。含 Method、URL、未保存标记、Send / Stop / Save。
- **RequestEditor**：只保留 Query / Headers / Body 页签与内容。
- **ResponsePane**：行为不变，空状态文案更新。
- **Dialog**：新建路径、无路径保存、删除确认。
- **TopBar**：产品名、cwd、主题三选一（浅色 / 深色 / 系统）、环境、密钥。主题控件不单独拆文件。
- **App**：持有草稿、当前路径、发送状态、侧栏开合、当前视图（集合/历史），并注册快捷键。

状态机（活动栏）：

- 点当前视图图标：若树已开则收起；若已收起则打开（仍是该视图）。
- 点另一图标：切到该视图并打开树。
- `Ctrl+B`：只切换树的开合，不改当前视图。

不引入路由，不改后端。

## 4. 主题

`document.documentElement` 设置 `data-theme="dark" | "light" | "system"`。无键或非法值视为未设置，回退 `dark`。读 `localStorage` 失败同样回退 `dark`，不弹错。切换只改属性与存储，不刷新、不丢草稿。

`system` 通过 `prefers-color-scheme` 套用同一套 light/dark 变量，不另做第三套色。顶栏三选一，当前档有选中态。

CSS 变量（同一份 `styles.css`）：

| Token | 深色（默认，写在 `:root`） | 浅色 |
|---|---|---|
| `--bg` | `#0d1117` | `#ffffff` |
| `--surface` | `#161b22` | `#f6f8fa` |
| `--activity` | `#010409` | `#f6f8fa` |
| `--ink` | `#e6edf3` | `#1f2328` |
| `--muted` | `#7d8590` | `#656d76` |
| `--line` | `#30363d` | `#d0d7de` |
| `--accent` | `#1f6feb` | `#0969da` |
| `--accent-ink` | `#ffffff` | `#ffffff` |
| `--ok` | `#3fb950` | `#1a7f37` |
| `--warn` | `#d29922` | `#9a6700` |
| `--err` | `#f85149` | `#cf222e` |

方法色（树项与 UrlBar 的 Method）：

| 方法 | 深色 | 浅色 |
|---|---|---|
| GET | `#3fb950` | `#1a7f37` |
| POST | `#58a6ff` | `#0969da` |
| PUT | `#d29922` | `#9a6700` |
| PATCH | `#a371f7` | `#8250df` |
| DELETE | `--err` | `--err` |
| HEAD / OPTIONS | `--muted` | `--muted` |

字体：界面 `system-ui, "Segoe UI", "PingFang SC", "Noto Sans SC", sans-serif`；URL、报文、状态码 `ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace`。不加载 Web 字体。

浅色主题下 Send 仍用 `--accent` 蓝，不用 GitHub 的绿 primary，避免与 2xx 状态色打架。

## 5. 对话框、空状态、快捷键

### 5.1 对话框

单一 `Dialog` 组件。点遮罩不关闭。`Esc` 关闭。路径类打开时聚焦输入框，`Enter` 提交非空路径（IME 组字中不触发）；删除类打开时聚焦「取消」，`Enter` 不提交（破坏性操作须用鼠标点确认按钮）。空路径时主按钮 disabled。提交期间主按钮 disabled，防止重复请求。对话框打开时背后内容不可交互（`inert`）。

| 场景 | 标题 | 正文/表单 | 主按钮 |
|---|---|---|---|
| 新建 | 请求路径 | 说明「相对 collections/，例如 `auth/ping`」+ 输入框 | 创建 |
| 无路径保存 | 请求路径 | 同上 | 保存 |
| 删除 | 删除请求 | 「删除 `auth/login`？此操作会从磁盘去掉该文件。」 | 删除（`--err` 色） |

空路径不可提交。API 失败时错误显示在对话框内，不写顶栏 banner。成功则关闭对话框，沿用现有 `createRequest` / `putRequest` / `deleteRequest`。

### 5.2 空状态

- 集合：「还没有请求」+ 按钮「新建请求」（与标题栏「＋」同一入口）。
- 历史：「发送成功的请求会列在这里」。
- 响应：「填 URL，按 Send 或 Ctrl+Enter」。
- 树已收起时不展示空状态。

### 5.3 快捷键

Ctrl 与 Cmd 等效。在 `App` 用 `keydown` 监听。

| 键 | 行为 |
|---|---|
| Ctrl/Cmd+Enter | 发送；`sending` 时忽略 |
| Ctrl/Cmd+S | `preventDefault` 并保存；在 Body 文本框内同样生效 |
| Ctrl/Cmd+B | 只开合树 |
| Esc | 有对话框则关闭；否则若 `sending` 则 Stop |

输入框中的普通 Enter 不发送。对话框打开时，Ctrl+Enter / Ctrl+S / Ctrl+B 不生效，避免路径输入时误发请求。

## 6. 错误处理

- 工作区/环境初始加载失败：顶栏红色 banner（现有行为）。
- 发送失败：banner；响应区保留上一次结果。
- executor 分类错误（`invalid`、缺变量等）：仍在响应区展示，不改协议。
- 对话框内写操作失败：只留在对话框。
- 响应区渲染崩溃：现有 `ErrorBoundary`，文案「界面出错：…」。
- 主题存储异常：静默回退深色。

## 7. 测试

仍用 Vitest，不引入 React Testing Library。测纯函数，不测像素。

- 主题解析：缺省 → `dark`；非法值 → `dark`；`system` + `prefers-color-scheme: light|dark` 的解析结果。
- 活动栏：再点当前图标收起；点另一图标切换并打开；Ctrl+B 只开合。
- 快捷键判定：文本框内 Ctrl+Enter 要发送、普通 Enter 不发送；对话框打开时发送快捷键被抑制。
- 现有 `web/src/request.test.ts` 等保持。
- 不改 Go 代码，`go test ./...` 应与现在一致。

## 8. 文件变动预期

新增：`web/src/ActivityBar.tsx`、`web/src/UrlBar.tsx`、`web/src/Dialog.tsx`、`web/src/theme.ts`（解析与读写）、对应 `*.test.ts`。

修改：`App.tsx`、`TopBar.tsx`、`Sidebar.tsx`、`RequestEditor.tsx`、`ResponsePane.tsx`、`styles.css`、`web/index.html`（`lang="zh-CN"`，默认 `data-theme="dark"`）。

实现完成后：`cd web && npm run build` 以更新 `internal/server/ui/`；更新 README「界面」一节。

## 9. 明确不做

未保存切换提醒、栏宽拖动、密钥面板重做、历史列表选中高亮、Cookie/多标签等 v1 非目标、新后端字段、新 npm 依赖。
