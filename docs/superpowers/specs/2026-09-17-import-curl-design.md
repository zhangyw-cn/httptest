# httptest 导入 curl 设计规格

日期：2026-09-17  
状态：已与用户对齐，待用户审阅本文件后进入实现计划  
前置：现有导出 curl（`formatCurl` / `ExportCurlDialog` / `POST /api/prepare`）、UrlBar Send split、「⋯」式溢出菜单需求。本文件新增「导入 curl」，并调整导入/导出入口；不改变实际发送与 prepare 语义。

## 1. 目的与成功标准

在 Web UI 将粘贴的 `curl` 命令解析为 httptest 请求草稿，便于从文档/终端快速填入编辑器。同时把导入与导出入口统一到 UrlBar 最右侧溢出菜单。

成功标准：

- UrlBar 最右侧为 **「⋯」按钮**；下拉含「导入 curl」「导出 curl」。Send 旁原 split 下拉与菜单项移除，Send 恢复为单按钮。
- 导入：粘贴命令 → 解析成功则写入**当前草稿**（不自动保存到集合）；失败则对话框内报错，草稿不变。
- 仅支持与产品模型对齐的 curl 子集；**任意未知/不支持 flag（含 `--resolve`）→ 整次失败**。
- `-L` 及若干客户端开关可出现但忽略；`--max-time` 写入 `timeout`；`-A` / `-e` 映射为头；method / URL(+query) / headers / body 映射到现有 `HttpRequest`。
- 纯前端解析，无新 API、无新 npm 包；导出行为（prepare + 导出对话框）保持不变，仅入口位置变。

非目标：粘贴自动检测、保存到集合、应用前预览/编辑、Cookie jar、代理、证书、multipart、`-u`、shell 变量 / `$()` / 反引号、保证与任意 curl 方言 100% 兼容。

## 2. 约束

| 项 | 决定 |
|----|------|
| 落点 | 仅当前编辑器草稿；保留现有草稿 `name` |
| 入口 | UrlBar 最右侧「⋯」溢出菜单：导入 curl / 导出 curl |
| 原导出入口 | 删除 Send split；不再从 Send 旁下拉导出 |
| 可见性 | 与 Send 相同（集合 / 历史工作模式）；发送中禁用「⋯」菜单 |
| 不支持 flag | 整次失败（对话框错误），不部分应用 |
| 栈 | 现有 Go + React/TS/Vite + 手写 CSS；不新增 npm 包；无 Go API 变更 |
| 语言 | 界面中文；协议词保留 curl / Send 等 |
| README | 实现后更新「界面」中导出说明，并补导入一句 |

## 3. 架构

采用**纯前端 allowlist 解析**：

```
UrlBar [⋯] ─┬─ 导入 curl → ImportCurlDialog
            │                │
            │                ▼
            │         parseCurl(text)
            │          ├─ ok  → 写入当前草稿，关对话框
            │          └─ err → 对话框内错误，草稿不变
            │
            └─ 导出 curl → POST /api/prepare → ExportCurlDialog（现有）
```

不在服务端解析 curl；不写 history；导入不发网。

## 4. 交互与界面

### 4.1 UrlBar

从左到右大致为：Method | URL | [未保存] | Send | Stop | 保存 | **⋯**。

- 「⋯」：`aria-label` 建议「更多」；`aria-haspopup="menu"`；展开后两项：「导入 curl」「导出 curl」。
- 发送中（及现有 exporting 忙态）禁用「⋯」并关闭菜单。
- 点击菜单项后关闭菜单，再触发对应回调。

### 4.2 导入对话框

- 标题：导入 curl
- 多行文本框：粘贴完整 curl 命令（支持 `\` 续行）
- 按钮：**应用**、**取消**
- 应用：调用 `parseCurl`；成功则把结果合并进草稿（见 §5.4）并关闭；失败则在对话框内显示错误，不关闭、不改草稿
- 不二次确认覆盖未保存修改

### 4.3 导出

逻辑与现有规格一致（prepare 失败写结果区；成功打开导出对话框）。仅入口改为「⋯」菜单。

## 5. curl 解析语义

### 5.1 流水线

1. 按行去掉整行 `#` 注释（行首可选空白后为 `#`）
2. 合并 `\` + 换行续行
3. shell 分词：单引号 / 双引号 / 无引号；**不支持** `$VAR`、`$()`、反引号、未闭合引号
4. 第一个 token 必须为字面量 `curl`（大小写敏感；不接受 `/usr/bin/curl` 等路径形式）
5. 按 flag 表消费；遇未知或不支持 → 失败并点名 flag
6. 映射为请求字段（见 §5.4）

**分词限制（v1）：** 不支持粘连短选项（如 `-vL`、`-sS`）；短选项与参数须为独立 token（`-m 30`，不支持 `-m30`）。违规 → 整次失败。

### 5.2 接受并映射

| Flag / 参数 | 行为 |
|-------------|------|
| URL 位置参数（恰好一个） | 见 §5.4 URL/query |
| `-X` / `--request` | method；须为 GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS（大小写不敏感，落盘大写） |
| `-I` / `--head` | method = `HEAD`（与后续 `-X` 按出现顺序后者覆盖） |
| `-H` / `--header` | `Name: value` → `headers`；同名后者覆盖 |
| `-A` / `--user-agent` | `User-Agent` 头 |
| `-e` / `--referer` | `Referer` 头 |
| `-d` / `--data` / `--data-raw` / `--data-binary` | body 文本（三者等价） |
| `-G` / `--get` | 有 data 时把 data 并入 query，method 倾向 GET（与 curl 一致） |
| `--max-time` / `-m` | `timeout` = `<n>s`（整数或小数秒）；非法数值 → 失败 |

`-A` / `-e` 与 `-H` 对同名头冲突时：**按命令出现顺序，后者覆盖**。

### 5.3 可出现但忽略

不写入草稿；带值的 flag 须消费其参数后再忽略。

| Flag |
|------|
| `-L` / `--location` |
| `--compressed` |
| `-v` / `--verbose` |
| `-s` / `--silent` |
| `-S` / `--show-error` |
| `-i` / `--include` |
| `-o` / `--output`（吞一个参数） |
| `-O` / `--remote-name` |
| `-#` / `--progress-bar` |
| `-f` / `--fail` |
| `--no-progress-meter` |

### 5.4 Method / URL / Body / name

**Method 默认（对齐常见 curl）：**

- 有 data 且无 `-X`/`-I`、无 `-G` → `POST`
- 无 data 且无 `-X`/`-I` → `GET`
- GET/HEAD：若仍带 data 且非 `-G` → 失败（httptest 不发送这类 body）

**URL / query：**

- URL 内 search 拆到 `query`（同名后者覆盖）；`url` 保留 scheme/host/path（无 search）
- `-G` 时 data 按 `application/x-www-form-urlencoded` 规则拆进 `query`，无 body

**Body 类型：**

- 无 data → `none`
- `Content-Type` 含 `application/json` → `json`（`content` 为字符串）
- 含 `application/x-www-form-urlencoded` → `form`（解析为 string→string map；解析失败则退回 `raw`）
- 否则 → `raw`

**应用到草稿：** 用解析结果整体替换 `method` / `url` / `query` / `headers` / `body` / `timeout`；**仅保留**当前草稿的 `name`。命令未出现 `--max-time`/`-m` 时，结果中不设 `timeout`（清除草稿原有 timeout，发送走产品默认 30s）。

### 5.5 显式失败（非穷尽）

`--resolve`、`-u` / `--user`、`-b` / `-c`、`--cookie` / `--cookie-jar`、`--proxy` / `-x`、`-k` / `--insecure`、`-F` / `--form`、`--http2`、多 URL、缺 URL、未知 flag、无法分词的 shell 语法、非法 method、非法 `--max-time`。

## 6. 组件拆分

| 位置 | 职责 |
|------|------|
| `web/src/UrlBar.tsx` | 去掉 send-split；最右侧「⋯」菜单；`onImportCurl` / `onExportCurl` |
| `ImportCurlDialog`（新） | 粘贴框 + 应用 / 取消 + 错误区 |
| `web/src/curl.ts` | 新增 `parseCurl`、分词、allowlist（纯函数），与现有 `formatCurl` 同文件族 |
| `web/src/App.tsx` | 打开导入对话框；成功则更新 draft |
| 导出相关 | prepare / ExportCurlDialog 不变，仅改入口接线 |

## 7. 测试

**前端（vitest）**

- `parseCurl`：基础 GET；`-X`+`-H`+`--data-raw`；`-A`/`-e` 与 `-H` 覆盖顺序；`-L`/`-v`/`--compressed` 忽略；`--resolve` 失败；未知 flag 失败；`--max-time` → `timeout`；`-G`+data；`-I` → HEAD；json/form/raw 推断；续行与引号；`#` 行注释。
- `UrlBar`：无 Send split；「⋯」可触发导入/导出；busy 时禁用。
- `ImportCurlDialog`：失败留窗；成功调用 onApply。

**Go：** 无新后端行为；无需新增 prepare/import API 测试。

## 8. 文档与发布

- README「界面」：删除「Send 右侧菜单可导出 curl」表述；改为 UrlBar 最右侧「⋯」可导入/导出 curl；导入写入当前草稿，不支持项整次失败。
- 无破坏性工作区格式变更；无 API 变更。
- 对 UI 而言：Send split 移除为可见交互变更，属本功能一部分。

## 9. 错误处理摘要

| 情况 | 行为 |
|------|------|
| 解析失败（含不支持 flag） | 对话框内错误；草稿不变 |
| 导入成功 | 关对话框；草稿更新；按现有逻辑标 dirty |
| 导出 prepare 业务失败 | 不弹导出窗；结果区同 Send |
| 导出 prepare 传输失败 | 不弹窗；现有错误提示 |
| 发送中 | 「⋯」禁用 |

## 10. 与导出 curl 的关系

- 导出规格见 `2026-09-17-export-curl-design.md`；本规格不修改 curl 生成语义。
- 从本工具导出的命令若含 `--resolve`，**不能直接再导入**（`--resolve` 硬失败）；用户需删掉该段后再导入。`-L`、`--max-time`、默认 UA 头等可导入。
