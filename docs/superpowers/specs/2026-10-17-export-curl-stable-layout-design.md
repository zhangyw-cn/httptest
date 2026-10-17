# 导出 curl 对话框固定外框

日期：2026-10-17  
状态：用户已审阅。实现计划：`docs/superpowers/plans/2026-10-17-export-curl-stable-layout.md`  
前置：`docs/superpowers/specs/2026-10-17-export-curl-panel-design.md` 的命令排版、说明文案和对话框结构。本文件只改导出对话框的外框尺寸和分栏。覆盖该规格第 4.2 节的宽度、64rem 断点、一列堆叠，以及预览栏 `min-height: 12rem`。不改变实际发送、`POST /api/prepare`、导入 curl、命令文本或说明句子。

## 1. 目的与成功标准

开关「说明」、勾选功能选项、命令变长或变短时，导出对话框的外框宽高保持不变。多出来的内容在选项区、预览栏、说明栏内部滚动。

在同一视口下：

- 外框宽度始终是 `min(58rem, 92vw)`。
- 外框高度始终是 `min(32rem, calc(100vh - 2rem))`。这是整个 `.export-curl-dialog`，含标题、1rem 内边距和底部按钮。
- 视口至少 48rem 时，说明关闭为两列，打开为三列。打开后预览变窄，外框不变。
- 视口小于 48rem 时，选项在顶部横排，下面是预览；说明打开后，下面是预览加说明列。说明列上限 16rem，内容区更窄时缩小，外框仍不超过 `92vw`。外框宽高公式与宽屏相同。
- 拖动窗口跨过 48rem 时，外框宽度仍由 `min(58rem, 92vw)` 连续变化，不从 58rem 跳到 40rem。内部从左右栏换成上下排。

非目标：改 `ExportCurlDialog.tsx` 的 DOM、改 `curl.ts`、改 Go、跑会改写 `internal/server/ui/` 的构建、新增 npm 包、截图测试、其它导出格式。

## 2. 外框

`.dialog` 内边距仍是 `1rem`。全局 `box-sizing: border-box`，高度含内边距和边框。导入对话框仍是 `min(560px, 92vw)`。

`.export-curl-dialog`：

- `width` 与 `max-width` 都是 `min(58rem, 92vw)`。
- `min-width: 0`。对话框是遮罩里的 flex 子项，这条防止预览长行把它撑得比 `92vw` 更宽。
- `height: min(32rem, calc(100vh - 2rem))`。
- 删除现在的 `max-height: calc(100vh - 2rem)`。高度只由这一条 `height` 决定。
- 继续 `display: flex; flex-direction: column`。
- 删除 `.export-curl-dialog.with-explain` 的单独宽度。说明打开后宽度与关闭时相同。

遮罩仍是 flex 居中。高度取 `calc(100vh - 2rem)` 时，上下各余 1rem。

标题和 `.dialog-actions` 不滚动。`.curl-export-body` 为 `flex: 1; min-height: 0; min-width: 0`，占满剩余高度。栏间距仍是 `0.75rem`。

## 3. 宽屏分栏

视口宽度至少 48rem 时使用这套网格，不写在媒体查询里。

说明关闭：

```css
grid-template-columns: 11rem minmax(0, 1fr);
grid-template-rows: minmax(0, 1fr);
```

说明打开（`.export-curl-dialog.with-explain`）：

```css
grid-template-columns: 11rem minmax(0, 1fr) 16rem;
grid-template-rows: minmax(0, 1fr);
```

选项列 11rem，说明列 16rem，预览列 `minmax(0, 1fr)`。选项区保持纵向 flex，不换行。DOM 顺序不变：选项、预览、说明。说明仅在 `showExplain` 为真时挂载，因此关闭时网格只有前两列。

## 4. 窄屏分栏

`@media (max-width: 47.99rem)` 表示视口宽度小于 48rem。等于 48rem 时用第 3 节。

说明关闭时，网格为一列 `minmax(0, 1fr)`。说明打开时，网格为 `minmax(0, 1fr) minmax(0, 16rem)`。两行都是 `fit-content(6.5rem) minmax(0, 1fr)`。选项行用 `fit-content(6.5rem)` 随内容变高，上限 6.5rem。说明列有空间时是 16rem；内容区更窄时缩小，外框保持在 `92vw` 以内。

显式摆放，避免自动放置把预览放进说明列：

| 区域 | 行 | 列 |
| --- | --- | --- |
| `.curl-options` | 1 | `1 / -1` |
| `.curl-export-preview` | 2 | 1 |
| `.curl-export-explain` | 2 | 2，仅打开时存在 |

窄屏 `.curl-options`：

- `flex-direction: row`
- `flex-wrap: wrap`
- `align-content: flex-start`
- `max-height: 6.5rem`
- `overflow: auto`
- 项间距仍是 `0.35rem`

选项横排占满内容宽度。说明开关不改变选项区的可用宽度，因此也不改变它的高度。五项换行超过 6.5rem 时，在选项区内部滚动。预览和说明分掉第 2 行的剩余高度。

删除现在 `@media (max-width: 63.99rem)` 里把宽度改回 `min(40rem, 92vw)`、以及把网格改成一列并让整个 body 滚动的规则。

## 5. 栏内滚动

预览栏 `.curl-export-preview` 的 `min-height` 从 `12rem` 改为 `0`，并保持 `min-width: 0`。短命令下方留白，对话框不因此变矮。

`.curl-preview` 保持 `flex: 1; min-height: 0; overflow: auto; white-space: pre; word-break: normal`。长行在预览栏内横向滚动。不用 `pre-wrap`，也不用 `word-break: break-all`。

说明栏保持 `min-width: 0; min-height: 0; overflow: auto`。选项区在宽屏保持现有 `overflow: auto`。

宽屏和窄屏的 `.curl-export-body` 都是 `overflow: hidden`。滚动发生在选项区、预览栏和说明栏内部。

## 6. 不变的行为

`ExportCurlDialog.tsx` 不改。`with-explain` 仍在说明打开时加到对话框上。

以下保持 `2026-10-17-export-curl-panel-design.md` 第 4.1 节和第 7 节：

- 标题「导出 curl」。点遮罩关闭。底部是「取消」和「复制到剪贴板」。
- `showExplain` 初始为 `false`，每次打开对话框都关闭，不写入本地存储。
- 五项勾选的顺序、默认值和禁用规则不变。不渲染 `.curl-option-hint`。
- 预览标题行右侧是「说明」按钮，`aria-pressed` 为 `"true"` 或 `"false"`。
- 说明区域仅打开时渲染，`id="export-curl-explain"`。
- 复制成功提示「已复制」并关闭。复制失败提示「复制失败」，对话框保留。准备失败不打开对话框。
- 勾选变化只更新预览和说明，不再请求准备接口。

## 7. 改动范围

| 位置 | 改动 |
| --- | --- |
| `web/src/styles.css` | 固定导出对话框宽高；宽屏两列或三列；小于 48rem 时选项横排在顶部；预览 `min-height` 改为 0；删除 40rem / 58rem 宽度切换和 64rem 一列规则 |
| `README.md` | 「界面」里导出 curl 的分句 |

`README.md` 中把：

> 「导出 curl」（左侧功能选项、右侧预览、可选说明栏、复制到剪贴板）

改为：

> 「导出 curl」（宽屏左侧功能选项、右侧预览，视口小于 48rem 时选项在顶部；可选说明栏；复制到剪贴板）

不改 `web/src/ExportCurlDialog.tsx`、`web/src/ExportCurlDialog.test.tsx`、`web/src/curl.ts`、`internal/`。不运行 `npm run build`。

## 8. 测试

在 `web/` 运行 `npm test`。现有 `ExportCurlDialog` 与 `curl` 测试保持通过，包括：五项勾选、预览、「说明」且 `aria-pressed="false"`、关闭时不出现 `export-curl-explain` 和 `with-explain`、Hosts 与最大重定向的禁用、预览中的 curl 片段。不新增测试库，也不为像素尺寸加断言。

手工确认，同一视口内量外框：

- 开关说明、勾选选项、命令行数变化时，宽高不变。
- 视口至少 48rem：关闭时两列，打开时三列，预览变窄，外框仍是 `min(58rem, 92vw)` 乘 `min(32rem, calc(100vh - 2rem))`。
- 视口小于 48rem：选项在顶部，打开说明后预览与说明并排，外框公式相同。选项超过 6.5rem 时只滚选项区。
- 窗口高度小于 32rem 加上下边距时，对话框高度为 `calc(100vh - 2rem)`，页面本身不因此出现滚动条。
- 长行在预览栏内横向滚动。
