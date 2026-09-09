# httree 结果面板（右侧）设计规格

日期：2026-09-10  
状态：已与用户对齐，待用户审阅本文件后进入实现计划  
前置规格：`2026-09-03-ui-ux-design.md`（双栏工作区、响应区）、`2026-09-04-ui-polish-design.md`（页签/空状态/meta 密度）。本文件不取代它们，只升级集合/历史视图右侧结果展示。

## 1. 目的与成功标准

右侧当前几乎只服务「响应」：meta 挤进状态、耗时、请求体积、响应体积；页签为 `Body | Headers | Raw | Timeline`；发出去的请求只靠 Raw 里的 dump 或中栏草稿间接看到。目标是理清 meta，并显式展示变量展开后的请求（`Result.prepared`）。

成功标准：

- 有 result 时，右侧一级页签为 `Request | Response | Raw`。
- Request 展示只读 `prepared`，二级为 `Overview | Query | Headers | Body`；Overview 含 Method、URL、请求体积。
- Response 二级为 `Body | Headers | Timeline`（不再含 Raw）。
- Raw 为一级页签，内容仍为 `requestDump` + 分隔线 + `responseDump`。
- Meta 顶栏对 HTTP 结果只显示：状态码与短语、总耗时、响应体积（及正文长度差异 / 截断提示）；请求体积不在 meta。
- 发送完成后不强制切换一级页签；集合发送与历史回放共用同一面板。
- 无 result 时仍为空状态「还没有响应」，不出现页签。

非目标（本次不做）：改 Go executor / API；对比 draft vs prepared；编辑 prepared；上下分栏或拖拽；可折叠 meta；专项复制按钮；新 npm 依赖；改双栏比例或 UrlBar。

## 2. 约束

| 项 | 决定 |
|----|------|
| 方案 | 在现有右侧面板上演进为「结果面板」（方案 1），不引入上下分栏 |
| 数据 | 只用已有 `Result`（`prepared`、`requestSize`、`requestDump`、`responseDump` 等）；后端不改 |
| 栈 | React + TypeScript + Vite + 手写 CSS；不新增 npm 包 |
| 布局 | 侧栏 220px、工作区双栏 1:1、UrlBar 横跨——均不改 |
| 语言 | 界面中文；协议词保留 Method、Body、Headers、Raw、Timeline、Request、Response |
| README | 实现后更新「界面」一节：右栏结构与 meta 说明 |

## 3. 架构

```
右侧结果面板（ResponsePane → 改名为 ResultPane）
├─ meta 顶栏（result !== null）
│    HTTP：status + statusText · totalMs · 响应体积
│    非 HTTP：errorClass / errorMessage / missingVars / historyError
├─ 一级页签：Request | Response | Raw
└─ 内容区
     Request → Overview | Query | Headers | Body（只读 prepared）
     Response → Body | Headers | Timeline
     Raw → requestDump + "\n\n----------\n\n" + responseDump
```

`App` 仍传入 `{ result }`；集合执行与历史点选写入同一 `result` state，面板不区分来源。

### 3.1 文件与组件

- 主组件：将 `web/src/ResponsePane.tsx` **改名为** `ResultPane.tsx`（default export `ResultPane`），`App.tsx` 同步改 import / JSX。
- Props：`{ result: Result | null }`，不变。
- 只读键值表：独立小组件（同文件即可），**不**复用可编辑 `PairTable`。
- 保留 `prettyBody` / `sizeLabel` / `msLabel`（同文件函数即可）。

### 3.2 页签状态

| 状态 | 行为 |
|------|------|
| 一级 `Request \| Response \| Raw` | 组件内 `useState`；新 result / 历史切换时**不重置** |
| Request 二级 / Response 二级 | 各自独立 `useState`；不因新 result 强制重置 |
| 发送完成 | **不**改一级页签 |
| `result === null` → 首次有 result | 一级默认 `Response`；Request 二级默认 `Overview`；Response 二级默认 `Body` |

空状态不挂载页签控件；从空到有 result 时用上述默认值初始化。

## 4. Meta 顶栏

有 `result` 时始终显示，与当前一级页签无关。

| 情况 | 展示 |
|------|------|
| `errorClass === "http"` | `status statusText`（沿用 `status-2xx` 等色类）· `{totalMs} ms` · `响应 {responseSize}`；若 `body.length !== responseSize` 则追加 `· 正文 {body.length}`；`truncated` 时标「截断」；若有 `errorMessage` / `historyError` 仍挂在 meta（现有行为） |
| 其它 | 错误块：`errorClass`、`errorMessage`、`missingVars`、`historyError`（与现逻辑一致） |

**不**在 meta 显示请求体积。请求体积仅在 Request → Overview。

样式：继续 `.response-meta`；可微调 gap / 对齐，不加卡片、不加新色板。

## 5. Request

数据源：`result.prepared`（`HttpRequest`）。全部只读。若历史旧条目缺少 `prepared` 字段，按空请求处理（Method/URL 空串、query/headers 空对象、`body.type === "none"`），不报错、不回退到中栏 `draft`。

### 5.1 Overview

- 一行：Method（现有方法色 class）+ URL（`font-family: var(--mono)`）
- 一行：`请求 {requestSize}`（沿用 `sizeLabel`）
- 一行弱提示：「变量已展开」（`muted`）

### 5.2 Query / Headers

- 只读键值表（列：键、值；无增删）
- 无条目时一行文案「无」

### 5.3 Body

- 标明 `body.type`
- `none`：文案「无正文」
- `json` / `raw`：`<pre class="dump">`；json 尝试 `prettyBody`
- `form`：只读键值表；空则「无」

## 6. Response 与 Raw

### 6.1 Response

- 二级：`Body | Headers | Timeline`
- Body / Headers / Timeline 行为与现 `ResponsePane` 一致（JSON pretty、headers 多值 join、timings + redirects）
- 非 HTTP 错误时仍可进入；Body/Headers 可能为空，用户主要看 meta；不禁止切换到 Request

### 6.2 Raw

- 一级页签，无二级
- 内容：单一 `<pre class="dump">`，文本为  
  `{requestDump 或「无」}` + `\n\n----------\n\n` + `{responseDump 或「无」}`  
  （空串视为缺失，替换为「无」）

## 7. 空状态与错误

| 场景 | 行为 |
|------|------|
| `result === null` | `.empty-state`：标题「还没有响应」，说明「填 URL，按 Send 或 Ctrl+Enter」；无一级页签 |
| HTTP 结果 | meta + 页签按上文 |
| 非 HTTP | meta 错误块 + 页签仍可用 |
| 不新增 | toast、对话框、发送失败自动跳页签 |

## 8. 样式

- 一级、二级均用现有 `.tabs` / `.tab` / `.tab.active`（底边 accent 下划线规则不变）
- 二级页签可略增左内边距或减小字号一档以示层级；**不加**第二套选中色
- Overview 用简单块布局，不用卡片 / 阴影
- 外层 section **保留** class `response` / `response-error-state` / `response-meta` / `response-body`，避免无关 CSS 大改；组件名是 `ResultPane`，DOM class 不必同步改名

## 9. 测试与文档

测试（`web/`）：

- 有 result 时出现一级 `Request` / `Response` / `Raw`
- Request → Overview 可见 method、url、请求体积文案
- meta 文本**不含**「请求 {size}」形式的请求体积（响应体积仍在）
- Response 二级**无** Raw
- Raw 一级内容含分隔线及两侧 dump（或「无」）
- 现有依赖「响应空状态」文案的测试保持通过

实现后：`cd web && npm test`；`npm run build` 更新 `internal/server/ui/`。

README「界面」：将右栏描述改为 Request / Response / Raw，并注明 meta 为状态、耗时、响应体积；请求详情在 Request。

## 10. 实现顺序（指导，非计划正文）

1. 改名/拆页签骨架 + meta 精简  
2. Request 四个二级页签内容  
3. Response / Raw 迁入  
4. 测试 + README + 嵌入构建  

详细任务拆分在用户审阅本规格通过后，由 writing-plans 产出实现计划。
