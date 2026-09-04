# httptest README 设计规格

日期：2026-09-03  
状态：已与用户对齐，待用户审阅本文件后进入实现计划

## 1. 目的与成功标准

在仓库根目录新增一份 `README.md`，让克隆仓库的人能：

- 用一条构建命令跑起本机 UI，并知道默认地址与 `--open` 行为；
- 理解三栏界面、`.httptest/` 布局、请求 YAML、环境/密钥替换规则；
- 知道 v1 明确不做的功能；
- 在文末用最少步骤跑测试、重建嵌入式前端。

非目标：不写第二份设计规格，不复制 HTTP API 表与错误分类细节，不配图、不放徽章、不编造远程模块或 License。

成功标准：按 README 能从源码启动；YAML/目录示例与当前代码及 `docs/superpowers/specs/2026-09-01-httptest-design.md` 一致；贡献者不必读完整规格也能 `go test` 与重建 UI。

## 2. 约束

| 项 | 决定 |
|----|------|
| 路径 | 仅仓库根目录 `README.md`（一份） |
| 语言 | 简体中文 |
| 受众 | 使用者为主；末尾一节给贡献者 |
| 深度 | 中等：简介 + 快速开始 + CLI + 界面一段 + 工作区 + 一份 YAML + 环境/密钥 + v1 不做 + 开发 |
| 配图 | 无。不预留 `docs/screenshots/` 占位 |
| 结构 | 经典仓库 README（方案 1），不是按任务教程，也不是规格缩写 |
| 事实来源 | 以当前代码为准；产品行为与 `2026-09-01-httptest-design.md` 对齐 |
| 模块路径 | `httptest`，不可写成可 `go install` 的公开地址 |
| clone 行 | 写「克隆本仓库」，不编造 GitHub URL |
| 徽章 / License / 贡献指南 / CoC | 不写 |
| 文末链接 | 一句指向 `docs/superpowers/specs/2026-09-01-httptest-design.md` |

## 3. 文档结构

固定按此顺序，不增节、不调序：

1. 标题与一句话简介
2. 能做什么
3. 快速开始
4. 命令行
5. 界面
6. 工作区
7. 请求文件
8. 环境与密钥
9. v1 明确不做
10. 开发
11. 相关文档（单独极短一节，一句链接）

各节长度：第 3、6、7 节可含代码块；第 5 节一段话；其余为短列表或短段落。全文目标大约 150–250 行 Markdown，宁短勿把规格正文贴进来。

## 4. 各节内容

### 4.1 标题与简介

标题：`# httptest`

一句话（须点明「本机」和「Go 后端出站」）：本机 HTTP 调试工具。在项目目录运行一个 Go 二进制，浏览器打开 Web UI，由 Go 后端发出请求（避开浏览器 CORS），并展示请求、响应与诊断。

### 4.2 能做什么

短列表，只写 v1 已有能力：

- 一条命令启动；默认监听 `127.0.0.1:1370`，仅本机可访问
- 编辑并发送 GET、POST、PUT、PATCH、DELETE、HEAD、OPTIONS；未保存草稿也能发
- 响应区：状态码、头、格式化 Body、原始报文、体积、重定向链、分阶段耗时
- 集合与环境模板可随项目 git 共享；历史、密钥、本机覆盖不进 git
- 数据全部落在启动时当前目录的 `.httptest/`

### 4.3 快速开始

前置：Go 1.22+（与 `go.mod` 一致）。

命令块上方用一句话：「克隆本仓库后，在仓库根目录执行：」。不要 `git clone` URL，不要编造 GitHub / 模块代理地址，命令块里也不要 `cd`。

```bash
go build -o httptest ./cmd/httptest
./httptest --open
```

说明：

- `net.Listen` 成功之后才在 stdout 打印实际 URL，例如 `http://127.0.0.1:1370`。
- `--open` 尽力打开系统浏览器；失败则忽略，用户手动打开打印出的 URL。
- 浏览器打开后：选环境 → 填 Method/URL → Send。

### 4.4 命令行

```
httptest [--listen 127.0.0.1:1370] [--open]
```

必须写明：

- 工作区固定为当前工作目录下的 `.httptest/`，没有 `--workspace`。
- `--listen` 非法则退出码非 0。
- 监听 `0.0.0.0` 或 `::`（或空 host）时 stderr 警告：能连到该端口的人可把本机当 HTTP 代理。默认继续用回环地址。

### 4.5 界面

一段话，不配图：

- 顶栏：产品名、工作区路径（cwd）、环境选择器。
- 左栏：`集合 | 历史`。集合为目录树，可新建、删除请求。历史按时间倒序；点击回填中栏并展示当时响应。
- 中栏：Method、URL；标签 `Query | Headers | Body`；底部 **Send**、**Stop**、**Save**。Send 发送当前草稿。
- 右栏：状态码、总耗时、体积；标签 `Body | Headers | Raw | Timeline`。

不写 React/Vite 实现细节（放到第 10 节一句即可）。

### 4.6 工作区

首次启动若目录不存在则创建，并写入 `.httptest/.gitignore`，内容固定为：

```
local/
history/
```

目录树：

```
.httptest/
  .gitignore
  collections/
  environments/
  local/
  history/
```

树旁用短注释：`collections/` 与 `environments/` 可提交；`local/`（密钥、当前环境）与 `history/`（按日 jsonl）不提交。

请求身份 = 相对 `collections/` 的路径、无 `.yaml` 后缀（如 `auth/login`）。重命名文件即改名；移动目录即改分组。不另建 ID。

### 4.7 请求文件

路径：`collections/**/*.yaml`。

使用下面这一份示例（与产品规格一致，不要另造字段名）：

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

示例后用短列表，不展开成第二份规格：

- `method` 仅允许 GET、POST、PUT、PATCH、DELETE、HEAD、OPTIONS（大小写不敏感，落盘大写）。
- `query`、`headers`：string → string，无同名多值。
- `body.type` 为 `form` 时，`content` 为 YAML map，发送 `application/x-www-form-urlencoded`。
- `body.type` 为 `json` 且未设 `Content-Type` 时，默认 `application/json`。
- `body.type` 为 `none` 或 GET/HEAD 时不发送 body。
- URL、query、header、body 文本均可出现 `{{name}}`。

不列出 Body 的 JSON 编码细节、2MiB 截断、User-Agent 默认值（那些留在产品规格里）。

### 4.8 环境与密钥

`environments/<name>.yaml` 可提交，禁止放密钥。示例：

```yaml
name: local
variables:
  baseUrl: http://127.0.0.1:8080
  username: demo
```

`local/secrets.yaml`：同名变量覆盖模板，不提交。

`local/active.yaml`：

```yaml
environment: local
```

替换顺序：环境模板 → `secrets.yaml`。缺失任一 `{{var}}`：分类 `invalid`，列出变量名，**不发送**。

密钥可在 UI 中编辑（本机工具，不上传）。

### 4.9 v1 明确不做

一条列表，与产品规格非目标对齐：

Cookie 管理、Basic/Bearer 助手、multipart 上传、HTTP/2、WebSocket、gRPC、SSE、多请求标签页、账号登录、云同步、跳过 TLS 校验、关闭跟随重定向。

另用一两句行为事实（用户会踩到，不算「功能列表」膨胀）：

- 跟随重定向，最多 10 次。
- HTTPS 使用系统 CA。
- 出站忽略 `HTTP_PROXY` / `HTTPS_PROXY`。

不把错误分类表、诊断字段、CSRF/Host 校验写进 README。

### 4.10 开发

保持短。命令：

```bash
go test ./...
cd web && npm test
```

改前端后重建嵌入资源：

```bash
cd web && npm run build
go build -o httptest ./cmd/httptest
```

`npm run build` 的 `outDir` 是 `internal/server/ui/`（Vite `emptyOutDir: true`），然后由 `internal/server` `//go:embed ui`。不要写需要手工复制文件的步骤。

开发时可用 `web/` 的 Vite（`npm run dev`）把 `/api` 代理到 `http://127.0.0.1:1370`；须同时先启动 Go 服务。产品形态仍是单二进制。

仓库结构只列：

```
cmd/httptest/
internal/workspace/
internal/executor/
internal/server/
web/
```

不写 PR 流程、issue 模板、Code of Conduct。

### 4.11 相关文档

单独一节，标题 `## 相关文档`，正文仅一句：实现与文件格式细节见 [`docs/superpowers/specs/2026-09-01-httptest-design.md`](docs/superpowers/specs/2026-09-01-httptest-design.md)。

## 5. 错误处理与准确性

README 里的命令与行为必须和代码一致：

| 声明 | 代码依据 |
|------|----------|
| Go 1.22+ | `go.mod` |
| 默认 `127.0.0.1:1370` | `cmd/httptest/main.go` |
| listen 成功后才打印 URL | `main.go`：`net.Listen` 之后 `fmt.Println` |
| `--open` 失败忽略 | `main.go`：`_ = server.OpenBrowser(url)` |
| 公网监听警告 | `internal/server/listen.go` `WarnPublicListen` |
| 前端构建输出目录 | `web/vite.config.ts` `outDir: "../internal/server/ui"` |

实现 README 时若发现规格本节与代码冲突，以代码为准并改 README（不要为了文档去改产品行为）。

## 6. 测试

无自动化「README 测试」。实现计划里的验收：

- 按快速开始的 `go build` 命令能编过（不要求本会话真的 clone）。
- 文中 CLI 标志与 `flag.NewFlagSet` 一致（仅 `--listen`、`--open`）。
- YAML 示例字段能被 `internal/workspace` 的请求/环境类型解析（对照现有测试里的合法文件）。
- 未出现：假 GitHub URL、徽章、License、API 路由表、错误分类表、截图。

## 7. 范围边界

做：根目录 `README.md` 一篇。

不做：`CONTRIBUTING.md`、英文版、截图、改产品代码、改 `2026-09-01` 产品规格（除非发现与代码矛盾且用户另开任务）。
