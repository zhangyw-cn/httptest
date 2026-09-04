# httptest UI 配色与控件打磨

日期：2026-09-04  
状态：已与用户对齐，待用户审阅本文件后进入实现计划  
前置规格：`docs/superpowers/specs/2026-09-03-ui-ux-design.md`（壳层、主题档、快捷键、对话框）。本文件不取代它，只补充视觉打磨。

## 1. 目的与成功标准

在现有 GitHub Primer 色板和 VS Code 式布局上，补齐控件状态、收一档密度、对齐空状态，使深色 / 浅色都更干净。不换产品气质，不设单一主视觉，顶栏、树、UrlBar、响应区均匀打磨。

成功标准：

- 可点区域（活动栏、树项、页签、默认按钮、主题档）共用同一套默认 / 悬停 / 选中 / 焦点 / 禁用，而不是每块自己描边。
- 浅色能分出壳（`--surface` / `--activity`）和填空处（`--field` 白底）。
- 顶栏与活动栏 40px，UrlBar 控件 32px；Send / Stop / Save 同高同字号。
- 集合 / 历史 / 响应空状态为「标题 + 说明」（集合另有默认按钮），无插画。
- 深色、浅色、跟随系统三档都可用；`prefers-reduced-motion: reduce` 时无过渡。

## 2. 约束

| 项 | 决定 |
|----|------|
| 范围 | 仅 `web/` 前端（含嵌入构建产物）；不改 `internal/` 逻辑、`cmd/` |
| 栈 | 现有 React + TypeScript + Vite + 手写 CSS |
| 依赖 | 不新增 npm 包，不加载 Web 字体 |
| 主题 | 仍用 `data-theme` + 已有 `theme.ts`；不新增主题档 |
| 布局 | 活动栏常驻、侧栏 220px、双栏 1:1、UrlBar 横跨工作区，均不改 |
| 语言 | 界面中文；协议词保持 Method / Send / Stop / Save 等 |

实现后 `cd web && npm run build` 更新 `internal/server/ui/`。README「界面」一节不改。

## 3. Token

`:root` / 深色与浅色继续写在同一份 `styles.css`。下列基础色沿用 2026-09-03 规格，不改数值：`--bg`、`--surface`、`--activity`、`--ink`、`--muted`、`--line`、`--accent`、`--accent-ink`、`--ok`、`--warn`、`--err`、方法色、`--sans`、`--mono`。

新增控件层（不使用 `color-mix`）：

| Token | 用途 | 深色 | 浅色 |
|---|---|---|---|
| `--field` | `input` / `textarea` / `select` / URL 底 | `#0d1117` | `#ffffff` |
| `--btn-bg` | 默认按钮底 | `#21262d` | `#f6f8fa` |
| `--hover` | 树项、活动栏、页签、默认按钮、主题档悬停 | `#30363d` | `#eaeef2` |
| `--selected` | 当前树项、活动栏当前图标、主题当前档 | `#1f6feb26` | `#0969da14` |
| `--focus` | `:focus-visible` 环 | `#1f6feb` | `#0969da` |
| `--accent-hover` | 仅 Send（`.btn-primary`）悬停 | `#388bfd` | `#0860ca` |

层次只靠这些底，不加阴影当分层。密钥面板与对话框现有阴影保留，不扩到其它表面。深色 `--hover`（`#30363d`）必须深于 `--btn-bg`（`#21262d`），否则默认按钮悬停看不见。

`--hover` **只**用于按钮、树项、活动栏图标、页签、主题档、`.btn-icon`。文本输入框不铺悬停底。

## 4. 状态规则

每个可点区域同一套，禁止再为某一块发明描边选中：

| 态 | 规则 |
|---|---|
| 默认 | 默认按钮 `--btn-bg` + `--line`；输入 `--field` + `--line`；树项 / 活动栏 / 页签背景透明，**边框透明**（不要沿用全局 `button` 的可见边框当树项盒子） |
| 悬停 | 底 `--hover`；`.btn-primary` 底改为 `--accent-hover`，边框同色 |
| 选中 | 底 `--selected`；左侧 2px `--accent` 指示条（仅活动栏当前图标、集合树当前项）。页签仍用底边 2px `--accent` 下划线，**不加** `--selected` 底，避免双重强调 |
| 焦点 | `outline: 2px solid var(--focus); outline-offset: 2px`，仅 `:focus-visible`；鼠标点击不留环 |
| 禁用 | `opacity: 0.5`，与现在相同 |

`--accent` 只给：Send、页签下划线、选中指示条、链接式强调。不用来给选中项画一圈边框。

过渡：允许运动时 `background-color`（及主按钮 `border-color`）约 80ms。`prefers-reduced-motion: reduce` 时 `transition: none`。

主题三档当前项：底 `--selected`，文字 `--ink`，去掉现在的 accent 描边 / 文字色（`.btn-active` 改走选中规则）。

历史列表：可悬停，**不**做当前项选中（沿用 2026-09-03 非目标）。

## 5. 密度与壳层

| 元素 | 规格 |
|---|---|
| 顶栏 | 高度 40px（现 48px）。密钥面板 `top` 同步为 40px |
| 活动栏 | 宽 40px、图标按钮高 40px、图标 20px |
| 活动栏选中条 | `::before` 左缘 2px `--accent`，上下各 6px；底 `--selected` |
| 树当前项 | 与活动栏相同：底 `--selected` + 左侧 2px 条；去掉 `.req-item.active` 的整圈 accent 边框 |
| UrlBar / `.btn` / 顶栏 `select` / Method | `box-sizing: border-box` 高度 32px；圆角仍 6px |
| Send / Stop / Save | 同高同字号；Send 唯一 `.btn-primary`，不加大、不加阴影 |
| 侧栏宽度、双栏比例 | 不变（220px，1:1） |
| 对话框 | 圆角仍 8px |
| 对话框遮罩 | 两套主题都用 `rgb(31 35 40 / 40%)`，不再写死深色画布 `#010409` |
| 未保存 | 仍为 `--warn` 文案，不成徽章 |

树行去掉现在的 `margin-bottom: 0.25rem` 堆叠；内边距略减，与 32px 控件节奏接近即可，不另定精确到像素的行高。

## 6. 空状态

新增包裹 class `empty-state`：在 `.sidebar-body` / `.response` 内垂直居中。标题 `--ink`，说明 `--muted`。无插画、无新图标。

| 位置 | 标题 | 说明 | 按钮 |
|---|---|---|---|
| 集合空 | 还没有请求 | 用标题栏 ＋ 或下方按钮创建 | 「新建请求」，`class="btn"`，不是主按钮 |
| 历史空 | 还没有历史 | 发送成功的请求会列在这里 | 无 |
| 响应空 | 还没有响应 | 填 URL，按 Send 或 Ctrl+Enter | 无 |

改 `Sidebar.tsx`、`ResponsePane.tsx` 的标记结构；文案按上表，不沿用单行 `.empty-hint` 兼标题。

## 7. 错误处理

不改行为：顶栏 banner、发送失败、对话框内错误、`ErrorBoundary`、主题存储失败静默回退深色。`.banner.error`、`.response-error-state` 仍用 `--err`。

## 8. 测试

仍用 Vitest，不引入 React Testing Library，不测像素。本次无新纯函数，**不新增**测试文件。现有 `theme.test.ts` / `activity.test.ts` / `shortcut.test.ts` / `request.test.ts` 保持通过。不改 Go 逻辑，`go test ./...` 应与现在一致。

手验：深色 / 浅色 / 系统；树与活动栏悬停和选中；Tab 键 `:focus-visible`；空状态三处；Send 悬停；浅色输入白底相对壳层可辨。

## 9. 文件变动预期

修改：

- `web/src/styles.css`（主工作）
- `web/src/Sidebar.tsx`、`web/src/ResponsePane.tsx`（空状态标记）
- 仅当现有 class 不够时，才给 `ActivityBar.tsx` / `UrlBar.tsx` / `TopBar.tsx` / `Dialog.tsx` 加 class；能纯 CSS 解决则不改 TSX

实现完成后：`cd web && npm run build` 更新 `internal/server/ui/`。

不改：`theme.ts`、快捷键、对话框逻辑、Go API、README。

## 10. 明确不做

- 换 Primer 基础色或增加第三套色板
- 新 npm 依赖、Web 字体文件
- 改 Go API / `cmd/`
- 栏宽拖动、多请求标签、密钥面板重做
- 历史列表当前项高亮
- 空状态插画
- 把 Send 做成比其它按钮更大的主视觉
- 未保存切换提醒（仍属 2026-09-03 非目标）
