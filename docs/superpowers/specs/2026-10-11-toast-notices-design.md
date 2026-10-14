# 失败与短暂反馈统一为顶部轻提示

日期：2026-10-11  
状态：已与用户对齐，待用户审阅本文件后进入实现计划  
前置规格：`docs/superpowers/specs/2026-09-10-result-pane-design.md`。本文件取代其中「非 HTTP 在 meta 画错误块」和「不新增 toast」。结果区页签、Overview、空状态文案不改。

## 1. 目的与成功标准

`invalid` / `缺少变量：baseUrl` 这类失败不再出现在带底边的结果状态条里，也不再给结果区加左侧红边。全应用的失败和短暂反馈共用一条顶部中央的轻提示。空状态和常驻说明留在原地。

成功标准：

- 失败 8 秒后消失，短暂反馈 3 秒后消失，都可以手动关闭。
- 同一句、同一级别还在显示时不另起一条，只把倒计时重新算满。
- 结果区非 HTTP 失败仍保留 Request / Response / Raw，只是不再显示错误正文和 `response-error-state`。
- 空状态、对话框路径说明、导出 curl 的说明、「变量已展开」仍是页面上的原文。

## 2. 约束

| 项 | 决定 |
|----|------|
| 范围 | 仅 `web/` 前端（含嵌入构建产物）。不改 Go 协议、错误分类、`errorMessage` 原文 |
| 栈 | 现有 React + TypeScript + Vite + 手写 CSS |
| 依赖 | 不新增 npm 包 |
| 位置 | 视口顶部中央，纵向往下排，新的一条在最上 |
| 时长 | 提示 3000ms，失败 8000ms。鼠标悬停该条时暂停，移开后按剩余时间继续 |
| 条数 | 不设上限，不写入本地，刷新即清空 |
| 语言 | 缺变量和历史写入失败用中文模板；分类名和后端说明保持原文 |

实现后 `cd web && npm run build` 更新 `internal/server/ui/`。README 不改。

## 3. 结构

轻提示队列是模块级存储，不依赖某次渲染里的 React state。`Toaster` 挂在 `ErrorBoundary` 外面（`main.tsx`），订阅该存储。这样界面崩溃后队列仍能画出来。

```text
StrictMode
  Toaster          订阅队列，画在顶部中央
  ErrorBoundary    崩溃时入队一条不倒计时的失败，子树改为空白
    App            各失败路径调用入队，不再自己画失败文案
```

入队只发生在事件处理、请求回调和 `componentDidCatch`，不在渲染期间调用。

调用入口：

- `notifyError(message)`：失败，8000ms
- `notifyHint(message)`：短暂反馈，3000ms
- `notifySticky(message)`：只给界面崩溃用，不倒计时

空字符串直接丢掉，不入队。轻提示路径自身不再产生新的失败提示。

重复判定键是「正文 + 级别 + 是否不倒计时」。已在显示的定时条再次入队时，剩余时间重置为该级别的完整时长。已在显示的崩溃条再次入队时不做任何事。

每条可单独关闭。关闭只移除该条：不改结果、不关对话框、不重新启用按钮。

悬停：进入时清掉计时器并记下剩余时间；离开时按剩余时间重设计时器。

## 4. 外观

容器固定在视口顶部中央，`z-index` 高于对话框遮罩（现为 20）。容器本身不接收点击，只有每条提示接收点击，避免挡住顶栏其余区域。

单条：`background: var(--surface)`，`box-shadow: 0 4px 16px rgb(0 0 0 / 28%)`。圆角、细边框和左侧色条见 `docs/superpowers/specs/2026-10-15-toast-outline-design.md`，本句不再要求无边框、无左侧色条。失败用 `--err`，提示用 `--ink`。`max-width: 22rem`，过长换行。条与条间距 `0.5rem`。容器 `top: 0.75rem`，水平居中。右上有关闭按钮，可读名称是「关闭」。

失败条目 `role="alert"`，提示条目 `role="status"`。

删除只服务于这些失败文案的样式：`.response-error-state`、`.env-editor-error`、`.dialog p.error`、`.banner`。若 `.error` 再无引用，删除该规则。

界面崩溃的兜底不再使用 `.banner.error`。边界内子树不渲染；说明只来自队列里那条不倒计时的提示，正文为「界面出错：」加上错误消息。用户关掉它之后页面仍是空白，刷新才恢复。

## 5. 数据流

### 5.1 执行结果

`noticesForResult(result)` 返回自上而下的展示句，空数组表示不弹。`setResult(null)` 不调用它。发送成功、导出准备失败、点开历史记录，凡是 `setResult` 收到非空结果，都按返回顺序入队（先入队最后一句，使第一句留在最上）。

主要失败句，命中即停：

1. `missingVars` 非空：`缺少变量：` + 名字用 `, ` 连接。此时不再使用 `errorMessage`。
2. 否则 `errorMessage` 非空：`errorClass` 非空时为「分类：说明」（例如 `dns：connection refused`、`http：redirect limit reached (10)`）；分类为空时只写说明。
3. 否则 `errorClass` 不是 `http` 且非空：只写分类。

`http` 且没有缺变量、没有 `errorMessage` 时，不为状态码另起一条。状态码、耗时、体积仍留在 `.response-meta`。HTTP 的 meta 不再渲染 `errorMessage` 和 `historyError`。

`historyError` 非空时追加一句：`历史记录未写入：` + 原文。它排在主要失败句下面。

非 HTTP 结果不渲染 `.response-meta`（其中已无内容），也不再加 `response-error-state`。外层仍是 `.response`。一级页签照常可用。

### 5.2 其余失败

这些路径改为 `notifyError`，并删除原来的失败状态和失败节点：

| 来源 | 正文 | 去掉的界面 |
|----|------|------------|
| 工作区加载、发送、保存、导出准备时接口抛错 | `Error.message`，否则 `String(err)` | 顶栏 `.banner.error` 与 App 的 `error` 状态 |
| 对话框提交失败（含「请等待…保存完成」「不能改成当前名称」） | 现在写进 `dialogError` 的那句 | `DialogMode.error`、对话框内 `<p className="error">`、`dialogError` 状态 |
| 导入 curl 解析失败 | 现在对话框里的那句 | `ImportCurlDialog` 内的错误段落和本地 error 状态。对话框保持打开，草稿不变 |
| 环境 / 覆盖 / Hosts 保存或校验失败 | 现在写进对应 error 状态的那句 | `EnvEditor` / `HostsContentEditor` 的 `error` 属性及 `.env-editor-error` |
| Hosts 列表加载失败 | 现在的 `hostsAPIError(...)` | 侧栏不再显示「Hosts 列表加载失败」和错误原文 |
| 历史列表加载失败 | `Error.message`，否则 `String(err)` | 侧栏历史错误段落 |

Hosts 列表加载失败后，侧栏空状态仍是标题「还没有 Hosts」、说明「用侧栏 ＋ 或下方按钮创建」。新建按钮保持禁用，直到一次加载成功。禁用用布尔值表示，不再把错误原文传进侧栏。提示消失不解除禁用。

历史列表加载失败后，列表为空时仍显示「发送成功的请求会列在这里」。

### 5.3 短暂反馈与常驻说明

复制成功：`notifyHint("已复制")`，对话框立即关闭。按钮文字保持「复制到剪贴板」，不再改成「已复制」，也不再等 600ms。

复制失败：`notifyError("复制失败")`，对话框保持打开。

以下原文留在原地，不入队：各空状态（「还没有响应」「填 URL，按 Send 或 Ctrl+Enter」、集合 / 环境 / 覆盖 / 历史的空说明、设置空说明）、对话框 `hint`、导出 curl 的 `.curl-option-hint`、Request Overview 的「变量已展开」。

## 6. 测试

后端测试不改。

`web/src/toast.test.ts`：

- 空字符串不入队
- 失败时长 8000ms，提示 3000ms，到期后移除
- 同一句同一级别只重置倒计时
- 手动关闭只移除该条
- `notifySticky` 不到期；重复入队不新增
- 暂停后剩余时间不变，继续后按剩余时间到期

`noticesForResult` 与队列放在同一模块，一并测试：

- 缺变量 → `缺少变量：baseUrl`；同时有 `errorMessage` 时仍只有这一句
- `dns` + `connection refused` → `dns：connection refused`
- 只有分类 → 分类原文
- `http` 且无 `errorMessage` → 无主要失败句
- `http` + `redirect limit reached (10)` → `http：redirect limit reached (10)`
- `historyError` → 单独一句 `历史记录未写入：…`，排在主要失败句之后

界面标记（沿用 `renderToStaticMarkup`）：

- 非 HTTP 结果不含 `response-error-state` 和错误正文，仍含 Request / Response / Raw
- 非 HTTP 结果不含 `.response-meta`
- `EnvEditor` / `HostsContentEditor` 不再有 `error` 属性，标记里不含 `env-editor-error`
- Hosts 列表失败时侧栏空状态为「还没有 Hosts」，新建控件禁用
- 轻提示标记位于顶部中央容器内，有关闭按钮；失败与提示级别不同
- 对话框仍渲染 `hint`，不渲染失败段落
- `ErrorBoundary` 兜底不再渲染 `.banner`

更新 `web/src/result-pane-ui.test.tsx` 与 `web/src/hosts-panel.test.tsx` 中对旧错误块的断言。
