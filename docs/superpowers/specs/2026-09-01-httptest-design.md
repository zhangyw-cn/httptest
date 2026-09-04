# httptest 设计规格

日期：2026-09-01  
状态：已与用户对齐，待用户审阅规格文件后进入实现计划

## 1. 目的与成功标准

httptest 是本机 HTTP 调试工具。开发者在项目目录运行一个 Go 二进制，浏览器打开 Web UI，通过 **Go 后端发出**任意 HTTP 请求，并看到请求、响应和诊断信息。

成功标准（v1）：

- 一条命令启动；默认只有本机浏览器能访问。
- 能编辑并发送核心 REST 请求（见 §5），未保存草稿也能发。
- 响应区能看到状态码、头、格式化 Body、原始报文、体积、重定向链、分阶段耗时，以及 DNS/连接/TLS/超时分类。
- 请求分组、环境模板可随项目 git 共享；历史、密钥、本机覆盖不进 git。
- 数据全部落在启动时当前目录的 `.httptest/`。

非目标（v1 明确不做）：Cookie 管理、Basic/Bearer 助手、multipart 上传、HTTP/2/WebSocket/gRPC/SSE、多请求标签页、账号登录、云同步、SQLite、跳过 TLS 校验开关、关闭跟随重定向的开关。

## 2. 约束

| 项 | 决定 |
|----|------|
| 运行形态 | 单个 Go 二进制，`embed` 前端静态资源 |
| 前端 | React + TypeScript + Vite |
| 工作区 | 启动时的 cwd 下 `.httptest/`（v1 不提供 `--workspace`） |
| 监听 | 默认 `127.0.0.1:1370`；`--listen host:port` 可改为例如 `0.0.0.0:1370` |
| 浏览器 | `--open` 可选，启动后尝试打开系统浏览器 |
| 变量语法 | `{{name}}`，未定义则拒绝发送 |
| 产品名 vs 标准库 | 二进制与模块名可用 `httptest`；内部包不得叫 `httptest`。测试里 `net/http/httptest` 用标准库导入即可 |

## 3. 架构

一个进程、一个本地 HTTP 服务。浏览器只打这个服务。出站请求全部由 Go 发出（避开 CORS，才能拿到握手/重定向/错误分类）。

```
浏览器 UI  --HTTP-->  server（静态 UI + /api）
                         |
                         +--> workspace（读写 .httptest）
                         |
                         +--> executor（变量替换 + Transport + httptrace）
                         |
                         v
                    目标 HTTP 服务
```

三层职责：

- **workspace**：collections / environments / local / history 的文件读写；首次启动建目录和 `.gitignore`。
- **executor**：替换变量、发请求、组装诊断结果。
- **server**：托管 UI 与 API；限制写路径必须在 `.httptest/` 内。

发布：`go build` 产出单文件。开发：前端 `web/` 用 Vite，可代理到 Go；产品形态仍是单二进制。

## 4. 工作区布局

```
.httptest/
  .gitignore
  collections/
    auth/
      login.yaml
    users/
      list-users.yaml
  environments/
    local.yaml
    prod.yaml
  local/
    secrets.yaml
    active.yaml
  history/
    2026-09-01.jsonl
```

首次启动若目录不存在则创建。`.gitignore` 内容固定为：

```
local/
history/
```

**版本管理**

- 提交：`collections/`、`environments/`、工作区 `.gitignore`
- 不提交：`local/`（密钥、覆盖、当前环境）、`history/`

请求身份就是相对 `collections/` 的路径（如 `auth/login`）。重命名文件即重命名请求；移动目录即改分组。不另建 ID 数据库。

### 4.1 请求文件

`collections/**/*.yaml`：

```yaml
name: Login
method: POST
url: "{{baseUrl}}/api/login"
query: {}
headers:
  Accept: application/json
body:
  type: json    # none | json | raw | form
  content: |
    {"user": "{{username}}"}
timeout: 30s    # 可选，默认 30s
```

- `method` 仅允许：GET、POST、PUT、PATCH、DELETE、HEAD、OPTIONS（大小写不敏感，落盘大写）。
- `query`、`headers`：v1 均为 string → string，不支持同名多值。
- `body.type` 为 `form` 时，`content` 为 YAML map（string → string），发送为 `application/x-www-form-urlencoded`。
- `body.type` 为 `json` 且未设 `Content-Type` 时，默认 `application/json`。
- `body.type` 为 `none` 或 GET/HEAD 时不发送 body。

### 4.2 环境与密钥

`environments/<name>.yaml`（可提交，禁止放密钥）：

```yaml
name: local
variables:
  baseUrl: http://127.0.0.1:8080
  username: demo
```

`local/secrets.yaml`（不提交）：同名变量覆盖模板。

`local/active.yaml`：

```yaml
environment: local
```

替换顺序：环境模板 → `secrets.yaml`。URL、query、header、body 文本均替换。缺失任一 `{{var}}`：分类 `invalid`，列出变量名，**不发送**。

### 4.3 历史

`history/YYYY-MM-DD.jsonl`，每行一条 JSON：

- `id`（UUID）
- `time`
- 替换后的请求快照（method/url/headers/query/body）
- 响应摘要（status、headers、body 或截断标记）
- 诊断（耗时、体积、重定向、错误分类）
- 可选 `requestPath`（若来自已保存文件）

v1 只支持回放（回填编辑器并展示当时响应），不自动另存为请求。

## 5. 请求执行

使用 `http.Client` + 自定义 `Transport` + `httptrace`。

行为：

- 跟随重定向，最多 10 次；每一跳记入诊断。v1 无「关闭跟随」开关。
- 默认超时 30s（请求文件可覆盖）。
- HTTPS 使用系统 CA；v1 不提供 insecure skip。
- 记录：DNS / 连接 / TLS / 首字节 / 总耗时（`float64` 毫秒，保留亚毫秒）；请求体字节数与响应**线上**字节数；重定向链（status + location）。
- 原始报文：替换变量之后，用 `httputil.DumpRequestOut` 与 `DumpResponse`。Transport **关闭透明 gzip**（`DisableCompression`），因此 dump 保留 `Content-Encoding` 与压缩体；UI 的 Body 标签再解压展示。
- 出站 **忽略 `HTTP_PROXY` / `HTTPS_PROXY`**（`Transport.Proxy = nil`），避免公司代理静默拦截本机调试流量。
- Body 超过 2MiB：截断，结果标 `truncated: true`。
- User-Agent 若调用方未设置，则为 `httptest/0.1`。

错误分类（互斥，按检测顺序）：

| 分类 | 含义 |
|------|------|
| `invalid` | 缺变量、URL 非法、method 不支持；未出站 |
| `canceled` | 用户停止 |
| `timeout` | 超过 deadline |
| `dns` | 解析失败 |
| `connect` | 连接被拒或不可达 |
| `tls` | 证书或握手失败 |
| `http` | 已得到 HTTP 响应（含 4xx/5xx） |

传输失败与 `http` 失败都写入历史。

## 6. HTTP API

前缀 `/api`。无登录账号。静态 UI 挂在 `/`。

浏览器侧仍须防护：`/api` 只接受 Host 为 `localhost` / 回环或字面量 IP 的请求；若带 `Origin`，必须与 Host 同源；`POST`/`PUT`/`PATCH` 必须是 `application/json`。这堵住 simple-request CSRF 与 DNS rebinding 读密钥。

| 用途 | 方法与路径 |
|------|------------|
| 工作区树 | `GET /api/workspace` |
| 读请求 | `GET /api/requests/{path}` 例如 `/api/requests/auth/login` |
| 写请求 | `PUT /api/requests/{path}` |
| 删请求 | `DELETE /api/requests/{path}` |
| 新建 | `POST /api/requests` body 含相对路径与内容 |
| 环境模板 | `GET /api/environments`、`PUT /api/environments/{name}` |
| 本机状态 | `GET /api/local`、`PUT /api/local`（secrets + 当前环境名） |
| 执行 | `POST /api/execute`（阻塞直到结束或取消） |
| 停止 | `POST /api/execute/{id}/cancel` |
| 历史 | `GET /api/history?limit=50`、`GET /api/history/{id}` |

`POST /api/execute` 由**客户端生成** UUID 作为 `id`（与随后的 cancel 相同），并带上编辑器中的完整请求（method/url/headers/query/body/timeout）及可选 `requestPath`。该 HTTP 调用阻塞直到完成、失败或被 cancel。未保存草稿可执行。Stop 用同一个 `id` 另开请求调用 cancel；服务端用 `context` 取消对应 in-flight 的 Client.Do。`GET /api/history` 默认最新 50 条，`limit` 最大 200。

写接口的 path 必须是相对路径，规范化后不得逃出 `.httptest/`。出现 `..` 则 400。`PUT`/`POST` 请求文件时按需创建中间目录（例如 `auth/login` 会创建 `collections/auth/`）。

`0.0.0.0` 监听时，启动日志必须警告：网络上能连到该端口的人可把本机当 HTTP 代理。

## 7. 前端

布局（已选定）：**三栏**。

- **顶栏**：产品名、工作区路径（cwd）、环境选择器（绑定 `local/active.yaml`）。
- **左栏**：`集合 | 历史`。集合为目录树，可新建、删除请求。历史按时间倒序；点击回填中栏并展示当时响应。
- **中栏**：Method、URL；标签 `Query | Headers | Body`；Body 按 none/json/raw/form 切换。底部 **Send**、**Stop**、**Save**。未保存改动有提示。Send 发当前草稿。
- **右栏**：状态码、总耗时、请求体体积、响应线上体积。标签 `Body | Headers | Raw | Timeline`。JSON Body pretty-print；其它为文本。失败时状态强调错误分类。`Raw` 同时展示发出的请求原文与响应原文。`Timeline` 展示分阶段耗时与重定向链。渲染异常由 error boundary 拦住，避免整页白屏。

技术：React + TypeScript；组件 state / 少量 context，不引入 Redux。v1 不做多标签编辑、不做独立主题开关（跟随系统颜色）。

本机密钥在 UI 中可编辑（本地工具，不上传）。

## 8. CLI

```
httptest [--listen 127.0.0.1:1370] [--open]
```

- 工作区固定为 `./.httptest`。
- `net.Listen` **成功之后**才在 stdout 打印实际 URL（如 `http://127.0.0.1:1370`）；端口占用时不会先打出打不开的地址。
- `--listen` 非法则退出码非 0。

## 9. 仓库结构（实现时）

```
cmd/httptest/          # main
internal/workspace/
internal/executor/
internal/server/
web/                   # Vite + React + TS
docs/superpowers/specs/
```

前端构建产物由 server 包 `embed`。

## 10. 测试

Go：`go test ./...`

- workspace：创建布局、gitignore、CRUD、拒绝路径穿越
- 变量替换：命中、secrets 覆盖、缺失则 `invalid`
- executor：`net/http/httptest` 假服务覆盖 2xx/4xx、头、JSON、重定向链、超时分类、gzip 线上体积
- server：execute 与请求 CRUD 的少量 handler 测试；embed 产物含 `ui/index.html`

前端：`cd web && npm test`（vitest，纯函数：normalizeRequest、目录树、密钥 JSON 键序）。v1 不强制 E2E；手工验证 Send / Save / 删除 / 历史回放 / 环境切换。

## 11. 实现顺序（供计划阶段拆任务）

1. workspace 文件格式与测试
2. executor（含诊断）与测试
3. HTTP API
4. 嵌入式静态占位页打通 execute
5. React 三栏 UI
6. CLI 与 embed 发布路径
