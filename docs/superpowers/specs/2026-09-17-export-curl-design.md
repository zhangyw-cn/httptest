# httptest 导出 curl 设计规格

日期：2026-09-17  
状态：已与用户对齐，待用户审阅本文件后进入实现计划  
前置：现有 Send / `executor.Prepare` / Hosts Dial / UrlBar / 结果区错误呈现。本文件新增「导出 curl」，不改变实际发送行为。

## 1. 目的与成功标准

在 Web UI 将**变量展开后、与 Send 意图一致**的 HTTP 请求导出为可粘贴的 `curl` 命令，便于在终端复现或分享。

成功标准：

- UrlBar 的 Send 旁下拉可选「导出 curl」。
- 导出前走与 Send 相同的变量解析与 `Prepare`；缺变量、无效 method、覆盖缺失、非法 timeout 等**拒绝导出**，错误呈现与 Send 失败一致（写入结果区，不打开导出对话框）。
- 对话框同时提供**功能勾选**与**只读 curl 预览**；勾选变化时预览即时更新，无需再次请求。
- 可将预览全文一键复制到剪贴板。
- 可选复现 Hosts：默认勾选「使用当前 Hosts 解析」，命中时生成 `curl --resolve`；无命中则该项禁用。
- 不发网、不写历史。

非目标（本次不做）：其它导出格式（HTTPie、fetch 等）、编辑预览正文、Cookie 罐 / 代理 / 证书 / `--insecure` / HTTP/2、导出快捷键、保证与 Go `http.Client` 字节级一致。

## 2. 约束

| 项 | 决定 |
|----|------|
| 数据源 | 当前编辑器草稿 + 顶栏当前环境 / 覆盖 / Hosts；展开后与 Send 的 `prepared` 同形 |
| 入口 | Send split button：主按钮仍为 Send；右侧下拉 v1 仅「导出 curl」 |
| 可见性 | 与 Send 相同（集合 / 历史工作模式）；发送中禁用导出 |
| 对话框 | 功能选项 + 只读预览 + 复制 / 取消；预览不可编辑 |
| 默认勾选 | Hosts 解析：开；跟随重定向：开；限制超时：开 |
| 栈 | 现有 Go + React/TS/Vite + 手写 CSS；不新增 npm 包 |
| 语言 | 界面中文；协议词保留 curl / Send 等 |
| README | 实现后在「界面」补一句导出 curl 说明 |

## 3. 架构

采用**轻量 prepare API + 前端拼 curl**：

```
草稿 ──POST /api/prepare──► server
                              │ ResolvedVars → Prepare
                              │ ActiveHostsMappings → 是否命中 resolve
                              │ 不发网、不写 history、不登记 cancel
                              ▼
                         prepared + resolve? + timeoutSeconds
                              │
                              ▼
                    ExportCurlDialog（勾选 → formatCurl → 预览 / 复制）
```

不在服务端生成整段 curl；勾选选项仅影响前端 `formatCurl`。

## 4. API：`POST /api/prepare`

### 4.1 请求

```json
{ "request": { /* 当前草稿，与 execute 的 request 同形 */ } }
```

无需 `id`、`requestPath`。

### 4.2 成功

HTTP 200，JSON 至少含：

| 字段 | 含义 |
|------|------|
| `prepared` | 展开后的请求（与 execute 成功时的 `prepared` 同形） |
| `resolve` | 可选；Hosts 命中时 `{ "host", "port", "ip" }`，对应 `--resolve host:port:ip` |
| `timeoutSeconds` | 实际超时（秒，可为小数，供 `--max-time`）：合法 `timeout` 由 `ParseDuration` 换算；缺省或空则 **30**（与 executor 默认一致） |

`port`：取自 `prepared.url`；缺省时 http→80、https→443。命中规则与 Dial 一致（hostname 小写精确匹配；URL host 已是 IP 字面量则不命中）。

### 4.3 失败（业务）

与 execute 对齐：HTTP 200 + `errorClass` / `errorMessage` / `missingVars`（及必要时的 `prepared`）。覆盖文件缺失等同 execute。前端**不打开**导出对话框，将该结果写入结果区。

非法 `timeout` 字符串：`errorClass: invalid`，不返回可用的 `timeoutSeconds`。

### 4.4 失败（传输 / 服务）

5xx 或网络错误：前端提示，不打开对话框；不伪造结果区 execute 形态（可用现有全局/内联错误路径，实现计划时与 App 现有模式对齐）。

### 4.5 明确不做

- prepare 不接受勾选选项。
- prepare 不返回整段 curl 字符串。
- prepare 不写入 history、不进入 cancel map。

## 5. 交互与界面

### 5.1 入口

- UrlBar：Send 主按钮右侧下拉箭头；菜单项「导出 curl」。
- 触发：`onExportCurl` → `POST /api/prepare`（当前草稿）。

### 5.2 对话框

- 标题：导出 curl
- **功能区**（勾选；文案面向能力，可不强调 flag 名）：
  - **使用当前 Hosts 解析** — 默认开；无 `resolve` 时禁用，说明「当前 Hosts 未命中此主机」
  - **跟随重定向** — 默认开 → 对应 `-L`
  - **限制超时** — 默认开 → 对应 `--max-time <timeoutSeconds>`；说明使用请求 timeout（默认 30s）
- **预览区**：只读等宽文本，展示当前勾选生成的完整 curl；勾选变化即时重算
- 按钮：**复制到剪贴板**、**取消**
- 复制成功：短暂「已复制」反馈后可自动关闭；剪贴板失败则提示并保留对话框

### 5.3 刻意不做

- 预览不可编辑。
- v1 下拉无其它导出项。
- 不新增导出快捷键。

## 6. curl 语义

### 6.1 骨架

```bash
curl [-L] [--max-time N] [--resolve host:port:ip] \
  -X METHOD 'URL_WITH_QUERY' \
  -H 'Name: value' ... \
  [--data-raw '...']
```

### 6.2 与 Send 对齐

- Method、展开后 URL；将 `query` 合并进 URL（标准 query 编码）。
- 用户 headers 全部 `-H`。
- 若用户未设 `Content-Type`，且 body 会带默认类型：json → `application/json`，form → `application/x-www-form-urlencoded`，预览中**写出**该头。
- 若用户未设 `User-Agent`，预览写入与 executor 相同的 `httptest/0.1`。
- GET/HEAD：不生成 body 参数。
- `json` / `raw`：`--data-raw` + 正文；`form`：urlencoded 后 `--data-raw`；`none`：无 body。
- 勾选「跟随重定向」→ `-L`；「限制超时」→ `--max-time`；「Hosts 解析」且存在 `resolve` → `--resolve`。

### 6.3 转义与格式

- 参数值用单引号；内容中的 `'` 按 POSIX 拆成 `'\''`。
- 预览可读：主参数换行 + `\` 续行；复制内容与预览一致。

### 6.4 明确不做

- 不导出 Cookie 罐、证书、代理、HTTP/2、`--insecure`。
- 不把 `Connection: close` 等 transport 细节写入（除非用户 headers 已有）。
- 目标是可粘贴复现意图，非报文 dump 逐字节复刻。

## 7. 组件拆分

| 位置 | 职责 |
|------|------|
| `server` `handlePrepare` | 路由 `POST /api/prepare`；复用 vars / Prepare / Hosts |
| `executor` 或 `server` 小函数 | 由 prepared URL + mappings 得到 `resolve`；算 `timeoutSeconds` |
| `web/src/api.ts` | `prepare(request)` |
| `web/src/curl.ts` | `formatCurl`、shell 单引号转义、勾选默认值（纯函数） |
| `web/src/UrlBar.tsx` | Send split + 下拉 |
| `ExportCurlDialog`（新组件或 Dialog 新 kind） | 勾选 + 预览 + 复制 |
| `App.tsx` | 编排 prepare → 失败写 result / 成功开对话框 |

## 8. 测试

**Go**

- prepare：缺变量 → invalid + missingVars；成功含 prepared；Hosts 命中含 resolve、未命中无 resolve；非法 timeout → invalid；调用后 history 无新增。

**前端（vitest）**

- `formatCurl`：method、query 合并、json/form body、默认 CT/UA、三开关、引号转义。
- UrlBar：下拉可触发导出回调。
- 对话框：切换勾选更新预览字符串（轻量渲染测即可）。

## 9. 文档与发布

- README「界面」：Send 旁可导出 curl（功能选项 + 预览 + 复制）。
- 无破坏性变更；无工作区格式变更。

## 10. 错误处理摘要

| 情况 | 行为 |
|------|------|
| 缺变量 / 无效 method / 覆盖缺失 / 非法 timeout | 不弹窗；结果区同 Send |
| prepare 5xx / 网络失败 | 不弹窗；提示错误 |
| 无 Hosts 命中 | 对话框打开；「Hosts 解析」禁用 |
| 剪贴板失败 | 提示；对话框保留 |
