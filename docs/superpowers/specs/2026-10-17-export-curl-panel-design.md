# 导出 curl 排版与说明栏

日期：2026-10-17  
状态：用户已审阅。实现计划：`docs/superpowers/plans/2026-10-17-export-curl-panel.md`  
前置：`docs/superpowers/specs/2026-09-17-export-curl-design.md` 的准备流程、勾选语义和 curl 子集。本文件只改命令排版、导出对话框布局，以及按参数给出的说明。不改变实际发送、`POST /api/prepare` 或导入 curl。

## 1. 目的与成功标准

导出的 curl 行数更少，短选项聚在一起并在 80 列内折行；结构参数各自成行。对话框左侧是功能选项，右侧是预览。另有独立的说明栏，默认隐藏，只解释当前命令里出现的参数。

成功标准：

- `formatCurl` 仍只返回命令字符串。复制到剪贴板的就是这份字符串。
- `explainCurl` 用同一份输入返回有序的 `{ text, explanation }[]`。`text` 与命令中的参数写法一致。
- 说明栏默认关闭，每次打开对话框都关闭，不写入本地存储。
- 左侧只留五项勾选。去掉「当前 Hosts 未命中此主机」和「使用请求 timeout（默认 30000ms）」。
- 勾选变化时，预览和说明一起更新，不再请求准备接口。

非目标：其它导出格式、编辑预览、预览与说明的点击联动、新的 curl 选项、改导入解析、改 Go、新增 npm 包。

## 2. 命令排版

### 2.1 片段

内部 `buildCurlPieces` 不导出。它按现有语义生成有序片段。每个片段有 `text`、`explanation` 和 `flow`：`pack`、`break` 或 `join`。

`formatCurl` 把片段拼成字符串。`explainCurl` 只取出 `text` 与 `explanation`。二者接收的输入与现在的 `formatCurl` 相同：`prepared`、`resolve`、`timeoutSeconds`、`options`。

片段顺序：

| 顺序 | 条件 | text | flow |
| --- | --- | --- | --- |
| 1 | 跟随重定向 | `-L` | pack |
| 2 | 跟随重定向且限制最大重定向 | `` `--max-redirs ${N}` ``，`N` 为 `settings.maxRedirects ?? 10` | pack |
| 3 | 跳过 TLS 校验 | `-k` | pack |
| 4 | 限制超时 | `` `--max-time ${S}` ``，`S` 为 `formatSeconds(timeoutSeconds)`，即 `String(timeoutSeconds)` | pack |
| 5 | 使用 Hosts 解析且存在 `resolve` | `` `--resolve ${shellSingleQuote(resolveArg(...))}` `` | break |
| 6 | 始终 | `` `-X ${prepared.method}` `` | break |
| 7 | 始终 | `shellSingleQuote(带 query 的 URL)` | join |
| 8 | 每个请求头 | `` `-H ${shellSingleQuote(`${name}: ${value}`)}` `` | break |
| 9 | 非 GET / HEAD 且有正文 | `` `--data-raw ${shellSingleQuote(正文)}` `` | break |

请求头仍按名字不区分大小写排序。未设置 User-Agent 时仍写入 `httptest/0.1`。JSON 与表单在需要时仍补 Content-Type。表单仍按键名排序后做 urlencoded。GET / HEAD 仍不输出正文。单引号转义仍是 POSIX `'\''`。IPv6 的 `--resolve` 仍给地址加方括号。`useResolve` 在没有 `resolve` 时不产生片段。未跟随重定向时不产生 `-L` 和 `--max-redirs`。

命令与片段文本有这条不变量：把每处 ` \\\n  ` 换成一个空格，结果等于 `curl ` 加上各 `text` 用单个空格连接。

### 2.2 折行

列宽按 JavaScript 字符串长度计，上限 80。只折 `pack` 片段。`break` / `join` 的行即使超过 80 列也不再拆开。

- 第一行前缀是 `curl`。其后各行前缀是两个空格。
- 除整个命令的最后一行外，行尾是空格加 `\`。
- `pack` 行一定还有后续行（至少有 `-X` 与 URL），因此每个 `pack` 行的 80 列都含行尾的 ` \`。
- 追加下一个短选项时，若当前行在前缀之外已有内容，且「当前行 + 空格 + 该选项 + 空格 + `\`」的长度大于 80，则先结束当前行，下一行用两个空格起头再放该选项。
- 一个短选项单独放上新行后仍超过 80，它仍独占该行。
- 没有 `pack` 片段时，第一个 `break` 行以 `curl` 开头，不另起一行只写 `curl`。
- `join` 片段用一个空格接在当前行末尾。因此 `-X` 与 URL 始终同一行。

短选项折行是内部纯函数，生产路径宽度固定为 80。它返回物理行数组，每一行都含行尾的 ` \`。单测用假参数覆盖折行，不依赖以后新增的真实 flag。宽度 20、参数为 `-L`、`--max-redirs 10`、`-k` 时，结果是这三行：

```bash
curl -L \
  --max-redirs 10 \
  -k \
```

宽度 10、只有 `--max-redirs 10` 时，结果只有一行：`curl --max-redirs 10 \`。没有短选项时返回空数组。`formatCurl` 再用 `\n` 把这些行和后面的结构行接起来。

### 2.3 代表性命令

Hosts 命中 IPv6、跟随重定向、限制 10 次、跳过 TLS、超时 30 秒、POST JSON 时，命令是：

```bash
curl -L --max-redirs 10 -k --max-time 30 \
  --resolve 'api.local:443:[2001:db8::1]' \
  -X POST 'https://api.local/v1/items?q=1' \
  -H 'Content-Type: application/json' \
  -H 'User-Agent: httptest/0.1' \
  --data-raw '{"a":1}'
```

当前这四项短选项合在第一行，长度不超过 80。

## 3. 说明文案

`explanation` 只解释参数本身，并写上单位。不把次数、秒数、主机、方法、请求头名字或值写进句子。同一类参数共用一句。

| 片段 | explanation |
| --- | --- |
| `-L` | 跟随重定向 |
| `--max-redirs` | 重定向次数上限，单位为次 |
| `-k` | 跳过 TLS 证书校验 |
| `--max-time` | 最长等待时间，单位为秒 |
| `--resolve` | 将主机的端口解析到指定 IP |
| `-X` | HTTP 方法 |
| URL | 请求地址，查询参数已写在 URL 里 |
| `-H` | 请求头 |
| `--data-raw` | 请求体原文 |

用户写的请求头和自动补上的 User-Agent、Content-Type 都是「请求头」。JSON、原文和表单都是「请求体原文」。命令里没有的片段不出现。

第 2.3 节那条命令的 `text` 依次为：`-L`、`--max-redirs 10`、`-k`、`--max-time 30`、`--resolve 'api.local:443:[2001:db8::1]'`、`-X POST`、`'https://api.local/v1/items?q=1'`、`-H 'Content-Type: application/json'`、`-H 'User-Agent: httptest/0.1'`、`--data-raw '{"a":1}'`。对应 `explanation` 用上表的固定句子。`explanation` 里不出现 `10`、`30`、`api.local`、`POST`、`application/json` 或 `{"a":1}`。这些内容只出现在 `text` 里。

## 4. 对话框

标题仍是「导出 curl」。点遮罩关闭。底部右侧是「取消」和「复制到剪贴板」。复制成功与失败的提示不变。准备失败仍不打开对话框。

`showExplain` 初始为 `false`。关闭对话框再打开时重新为 `false`。

### 4.1 三栏

中间区域是 `.curl-export-body`。

- **功能选项**：`fieldset`，`aria-label="功能选项"`，不渲染 `legend`。五项勾选与现有顺序、默认值、禁用规则相同。Hosts 未命中时「使用当前 Hosts 解析」禁用。未跟随重定向时「限制最大重定向」禁用。不渲染 `.curl-option-hint`。
- **预览**：标题「预览」。标题行右侧是 `type="button"` 的「说明」，`aria-pressed` 为 `"true"` 或 `"false"`。按下时边框色和字色为 `var(--accent)`。下面是 `pre.curl-preview`，`white-space: pre`，超出时在预览栏内滚动。不用 `pre-wrap`，也不用 `word-break: break-all`。
- **说明**：仅 `showExplain` 为真时渲染，`id="export-curl-explain"`，标题「说明」。每项两行：第一行是 `text`，等宽，过长时在本栏换行；第二行是 `explanation`，使用 `--muted`。列表顺序与 `explainCurl` 一致。本栏单独滚动。

面板关闭时不挂载说明区域，因此静态标记里没有 `export-curl-explain`，也没有「重定向次数上限，单位为次」「将主机的端口解析到指定 IP」「请求体原文」这三句。勾选标签「跟随重定向」仍在。

### 4.2 宽度

`.dialog` 的内边距仍是 `1rem`。栏间距 `0.75rem`。功能选项列 `11rem`，说明列 `16rem`，预览列 `minmax(0, 1fr)`。

导入对话框仍是 `min(560px, 92vw)`。导出对话框与它拆开，不再共用一条宽度规则。

- 说明关闭：导出对话框 `min(40rem, 92vw)`，两列。
- 说明打开且视口宽度至少 `64rem`：导出对话框 `min(58rem, 92vw)`，三列。此时 `92vw` 放得下 `58rem`，预览列不比关闭时更窄。
- 视口宽度小于 `64rem`：无论说明是否打开，都改为一列，顺序是功能选项、预览、说明。对话框宽度保持 `min(40rem, 92vw)`。

`64rem` 替换讨论时的 `720px`。`720px` 小于打开后的 `58rem`，三栏仍会在 `92vw` 里把预览挤窄，因此断点改成能放下 `58rem` 对话框的视口宽度。

对话框 `max-height: calc(100vh - 2rem)`，自身为纵向 flex。标题和底部按钮不滚出视口。`.curl-export-body` 占据剩余高度，预览栏和说明栏在内部滚动。预览栏 `min-height: 12rem`。

## 5. 改动范围

| 位置 | 改动 |
| --- | --- |
| `web/src/curl.ts` | 内部片段与折行；`formatCurl` 仍返回 `string`；新增 `explainCurl` |
| `web/src/curl.test.ts` | 新排版的精确字符串；说明文案；假参数折行 |
| `web/src/ExportCurlDialog.tsx` | 分栏、说明开关、去掉两句常驻说明 |
| `web/src/ExportCurlDialog.test.tsx` | 默认有「说明」且 `aria-pressed="false"`；无说明区域；无两句旧说明；Hosts 未命中仍禁用 |
| `web/src/styles.css` | 导出对话框宽度、分栏、预览滚动；删除不再使用的 `.curl-option-hint` |
| `README.md` | 「界面」中「导出 curl」（功能选项 + 预览 + 复制到剪贴板）改为「导出 curl」（左侧功能选项、右侧预览、可选说明栏、复制到剪贴板） |

不改 `internal/`、`POST /api/prepare`、`parseCurl`。

## 6. 测试

**折行**

- 第 2.2 节宽度 20 的三行结果，以及超长参数独占一行。
- 空短选项得到空数组。

**formatCurl**

- 第 2.3 节命令与实现完全一致，含续行、缩进和 IPv6 方括号。
- 关掉全部短选项且无 resolve 时，第一行是 `curl -X GET 'http://example.com/a'`。
- 既有语义仍成立：query 合并、JSON / 表单 / 原文正文、默认 User-Agent 与 Content-Type、引号转义、无 resolve 时无 `--resolve`、不跟随重定向时无 `-L` 和 `--max-redirs`、小数 `--max-time`。
- 续行不变量：把每处 ` \\\n  ` 换成一个空格后，等于 `curl ` 加各 `explainCurl(...).text` 用空格连接。

**explainCurl**

- 第 2.3 节的 `text` 序列与固定说明句子。说明句子与第 3 节表格完全一致。
- 关掉的选项不产生对应项。GET 无 `--data-raw`。

**对话框**

- 静态渲染含五项勾选、「预览」、「说明」、`aria-pressed="false"`、预览中的 curl。
- 不含 `id="export-curl-explain"`，不含「重定向次数上限，单位为次」「将主机的端口解析到指定 IP」「请求体原文」，不含「当前 Hosts 未命中此主机」和「默认 30000ms」。
- 无 resolve 时，Hosts 勾选为禁用。
- `followRedirects: false` 时预览不含 `-L`，最大重定向勾选为禁用。
- `insecureSkipVerify: true` 时预览含 `-k`。

开关打开后的三栏不在静态渲染里点击。说明内容由 `explainCurl` 覆盖。

## 7. 错误处理

| 情况 | 行为 |
| --- | --- |
| 缺变量 / 无效 method / 覆盖缺失 / 非法 timeout | 不弹窗；结果区同 Send |
| prepare 5xx / 网络失败 | 不弹窗；提示错误 |
| 无 Hosts 命中 | 对话框打开；Hosts 勾选禁用；命令和说明都没有 `--resolve` |
| 剪贴板失败 | 提示；对话框保留 |
| 复制成功 | 提示「已复制」并关闭 |
| 说明栏关闭 | 不影响预览和复制 |
