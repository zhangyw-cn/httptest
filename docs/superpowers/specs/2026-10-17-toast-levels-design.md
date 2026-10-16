# 轻提示分错误、警告、信息

日期：2026-10-17  
状态：已与用户对齐，待用户审阅本文件后进入实现计划  
前置规格：`docs/superpowers/specs/2026-10-11-toast-notices-design.md`、`docs/superpowers/specs/2026-10-15-toast-outline-design.md`。本文件取代 2026-10-15 那份里的左侧色条、中性边框，以及失败红字、提示蓝条和提示字色。位置、队列、悬停暂停和关闭按钮保持 2026-10-11 那份。「已复制」仍是 3 秒。`hint` 这一级改名为 `info`。

## 1. 目的

失败和短暂反馈共用一种表面色，级别只靠细色条区分。改成错误、警告、信息各自的底色、边框和字色，让深色界面上的提示不再像一块浅色卡片贴在顶栏上。

成功标准：

- 失败是错误，短暂反馈是信息。「已复制」仍在 3 秒后消失。
- 存在警告这一级，当前没有任何业务文案调用它。
- 深色和浅色主题各用下面写定的底色、边框和字色。没有左侧色条。
- 入队、重复判断、悬停暂停和关闭行为不变。

## 2. 级别与行为

队列仍在 `web/src/toast.ts`。重复键仍是「正文 + 级别 + 是否不倒计时」。空字符串不入队。悬停暂停、恢复和手动关闭不变。

| 级别 | 函数 | 时长 | 角色 | 类名 |
| --- | --- | --- | --- | --- |
| 错误 | `notifyError` | 8000ms | `alert` | `toast toast-error` |
| 错误，不倒计时 | `notifySticky` | 无 | `alert` | `toast toast-error` |
| 警告 | `notifyWarning` | 5000ms | `status` | `toast toast-warning` |
| 信息 | `notifyInfo` | 3000ms | `status` | `toast toast-info` |

`ToastItem.kind` 是 `"error" | "warning" | "info"`。删除 `notifyHint`，不留别名。`ExportCurlDialog` 里复制成功改为 `notifyInfo("已复制")`。`noticesForResult` 和 `publishResultNotices` 仍只入队错误。

同一句正文可以同时作为错误和警告存在，因为级别不同。警告不使用 `notifySticky`。

## 3. 外观

去掉 `.toast::before`、`.toast-error::before`、`.toast-hint::before`。`.toast` 去掉只为裁切色条而加的 `overflow: hidden` 和 `position: relative`。不新增 DOM 节点。关闭按钮仍是 `color: inherit`，所以跟该级字色相同。

`.toast` 保留现有布局、`border-radius: 8px`、内边距和 `box-shadow: var(--toast-shadow)`。它不再设置 `background`，也不再使用 `var(--surface)`、`var(--line)`、`var(--err)`、`var(--ink)` 或 `var(--accent)`。

每一级用一条规则设置底色、字色和 `border: 1px solid` 加自己的边框变量：

- `.toast-error` 使用 `--toast-error-bg`、`--toast-error-border`、`--toast-error-ink`
- `.toast-warning` 使用 `--toast-warning-bg`、`--toast-warning-border`、`--toast-warning-ink`
- `.toast-info` 使用 `--toast-info-bg`、`--toast-info-border`、`--toast-info-ink`

变量写在现有的两个主题块里。

深色（`:root` 与 `html[data-theme="dark"]`）：

| 变量 | 值 |
| --- | --- |
| `--toast-shadow` | `0 4px 16px rgb(0 0 0 / 28%)` |
| `--toast-error-bg` | `#361e1c` |
| `--toast-error-border` | `#d67166` |
| `--toast-error-ink` | `#f2e2de` |
| `--toast-warning-bg` | `#31281c` |
| `--toast-warning-border` | `#d29d41` |
| `--toast-warning-ink` | `#f0e9db` |
| `--toast-info-bg` | `#1a2d25` |
| `--toast-info-border` | `#47ae7e` |
| `--toast-info-ink` | `#ddeee6` |

浅色（`html[data-theme="light"]` 与 `html[data-theme="system"][data-resolved-theme="light"]`）：

| 变量 | 值 |
| --- | --- |
| `--toast-shadow` | `0 4px 16px rgb(0 0 0 / 12%)` |
| `--toast-error-bg` | `#f7eeed` |
| `--toast-error-border` | `#9d2d25` |
| `--toast-error-ink` | `#53211d` |
| `--toast-warning-bg` | `#f5f0e6` |
| `--toast-warning-border` | `#815822` |
| `--toast-warning-ink` | `#4a331c` |
| `--toast-info-bg` | `#e8f2ed` |
| `--toast-info-border` | `#27684a` |
| `--toast-info-ink` | `#183a2d` |

系统主题解析为深色时使用深色块，解析为浅色时使用浅色块。不另写第三套颜色。

## 4. 范围

改这些文件：

- `web/src/toast.ts`
- `web/src/Toaster.tsx`
- `web/src/styles.css`
- `web/src/ExportCurlDialog.tsx`
- `web/src/toast.test.ts`
- `web/src/Toaster.test.tsx`
- `web/src/toast-outline.test.ts`

对话框说明、`.curl-option-hint`、各处空状态都不改。不改 Go，不改 README，不加 npm 包。完成后 `cd web && npm run build`，更新 `internal/server/ui/`。

## 5. 测试

`toast.test.ts`：空的 `notifyInfo` 和 `notifyWarning` 不入队。信息 3000ms 消失，错误仍是 8000ms。警告 5000ms 消失，此时同队列里的错误还在。同一句正文的错误和警告同时存在，各算一条。

`Toaster.test.tsx`：同时渲染错误、警告和信息。标记含 `toast-error` 与 `role="alert"`，含 `toast-warning`、`toast-info` 与 `role="status"`，含关闭按钮。不含 `toast-hint`，不含 `banner`。

`toast-outline.test.ts` 改读 `styles.css` 源文，并同时满足：

- 源文没有 `.toast::before`，没有 `toast-hint`
- `.toast` 含 `border-radius: 8px` 和 `box-shadow: var(--toast-shadow)`
- `.toast` 不含 `overflow: hidden`、`position: relative`、`var(--line)`、`var(--surface)`
- 三个级别规则分别含 `border: 1px solid` 和自己的三个变量
- 深色主题块含第 3 节深色表的全部色值和 `28%` 阴影
- 浅色主题块含第 3 节浅色表的全部色值和 `12%` 阴影

然后 `cd web && npm test` 通过，再 `cd web && npm run build`。嵌入 CSS 中能找到 `#361e1c` 和 `#f7eeed`，且没有 `toast-hint`。
