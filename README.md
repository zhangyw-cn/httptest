# httptest

本机 HTTP 调试工具。在项目目录运行一个 Go 二进制，浏览器打开 Web UI，由 Go 后端发出请求（避开浏览器 CORS），并展示请求、响应与诊断。

## 能做什么

- 一条命令启动；默认监听 `127.0.0.1:1370`，仅本机可访问
- 编辑并发送 GET、POST、PUT、PATCH、DELETE、HEAD、OPTIONS；未保存草稿也能发
- 响应区：状态码、头、格式化 Body、原始报文、体积、重定向链、分阶段耗时
- 集合与环境模板可随项目 git 共享（工作目录下的 `collections/`、`environments/`）；历史、覆盖在 `.httptest/`，不进 git

## 快速开始

需要 Go 1.22+。模块路径为 `github.com/zhangyw-cn/httptest`。

```bash
go install github.com/zhangyw-cn/httptest/cmd/httptest@latest
httptest --open
```

或从源码构建：

```bash
git clone https://github.com/zhangyw-cn/httptest.git
cd httptest
go build -o httptest ./cmd/httptest
./httptest --open
```

`net.Listen` 成功之后才会在 stdout 打印实际 URL（例如 `http://127.0.0.1:1370`）。`--open` 会尽力打开系统浏览器；失败则忽略，请手动打开打印出的地址。

浏览器打开后：选环境（可选覆盖，可留「无」）→ 填 Method/URL → Send。

## 命令行

```
httptest [DIR] [--listen 127.0.0.1:1370] [--open]
```

- `DIR` 为工作区根，最多一个；省略则用启动时的当前目录。标志可写在 `DIR` 前后（例如 `httptest ~/proj --open`）。
- `DIR` 必须已存在且为目录，否则退出码 2；不会自动创建该目录。
- `--listen` 非法或多余位置参数则退出码 2。
- 监听 `0.0.0.0`、`::` 或空 host 时，stderr 会警告：能连到该端口的人可把本机当 HTTP 代理。默认请继续用回环地址。

## 界面

顶栏是产品名、工作区路径、环境选择器与覆盖选择器（覆盖可选「无」），不含主题切换。左侧活动栏上方切换集合、历史、环境与覆盖，底部为设置；再点当前图标收起树（`Ctrl+B`）。树展开时宽 220px。设置视图下左侧为分类树（外观），中间为主题浅色/深色/系统三档，不显示 UrlBar、请求编辑器与响应区。集合/历史视图下 Method、URL、Send、Stop、Save 横跨中间请求栏和右侧响应栏（`Ctrl+Enter` 发送，`Ctrl+S` 保存请求）。环境视图左侧列环境名，中间编辑模板变量（`Ctrl+S` 保存环境，`Ctrl+Enter` 不发送）；覆盖视图同理编辑本机覆盖集，树选中只打开编辑，顶栏选择器才是发送用的当前环境与覆盖。新建/改名/删除在应用内对话框完成，不使用浏览器原生弹窗。请求栏为 `Query | Headers | Body`；右侧结果栏 meta 为状态码、总耗时、响应体积，一级页签为 `Request | Response | Raw`。Request 二级为 `Overview | Query | Headers | Body`（只读变量展开后的请求，Overview 含请求体积）；Response 二级为 `Body | Headers | Timeline`；Raw 为请求 dump 与响应 dump。

## 工作区

首次启动只创建 `.httptest/`（本机数据），并在其中写入 `.gitignore`：

```
*
```

`collections/`、`environments/` 在第一次保存请求或环境时才创建。

```
<workdir>/
  collections/      # 请求，可提交
  environments/     # 环境模板，可提交
  .httptest/
    .gitignore
    local/
      overrides/    # 覆盖集，不提交
      active.yaml   # 当前环境与覆盖，不提交
    history/        # 按日 jsonl，不提交
```

这是破坏性变更：旧版本写在 `.httptest/collections/`、`.httptest/environments/` 的文件不再读取。请自行搬到工作目录下对应的可见目录。

请求身份是相对 `collections/` 的路径、不含 `.yaml` 后缀（例如 `auth/login`）。重命名文件即改名，移动目录即改分组，不另建 ID。

## 请求文件

路径：`collections/**/*.yaml`。

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

- `method` 仅允许 GET、POST、PUT、PATCH、DELETE、HEAD、OPTIONS（大小写不敏感，落盘大写）。
- `query`、`headers`：string → string，无同名多值。
- `body.type` 为 `form` 时，`content` 为 YAML map，发送 `application/x-www-form-urlencoded`。
- `body.type` 为 `json` 且未设 `Content-Type` 时，默认 `application/json`。
- `body.type` 为 `none` 或 GET/HEAD 时不发送 body。
- URL、query、header、body 文本均可出现 `{{name}}`。

## 环境与覆盖

`environments/<name>.yaml` 可提交，禁止放敏感值：

```yaml
name: local
variables:
  baseUrl: http://127.0.0.1:8080
  username: demo
```

`.httptest/local/overrides/<name>.yaml` 存放本机覆盖集，不提交；可建多套，顶栏覆盖选择器切换（含「无」表示不应用任何覆盖集）：

```yaml
name: dev
variables:
  baseUrl: http://127.0.0.1:3000
  apiKey: sk-local-only
```

`.httptest/local/active.yaml` 记录当前环境与覆盖：

```yaml
environment: local
override: dev
```

替换顺序：环境模板 → 当前覆盖集（若顶栏未选覆盖则为空）。缺失任一 `{{var}}`，或 `active.yaml` 指向的覆盖集文件不存在时，分类为 `invalid`，列出变量名，**不发送**。覆盖集可在 UI 中编辑（本机工具，不上传）。

这是破坏性变更：旧版 `.httptest/local/secrets.yaml` 不再读取。请自行迁移：将其 `variables` 拷到 `overrides/<name>.yaml`（例如 `overrides/default.yaml`），执行 `chmod 600 .httptest/local/overrides/<name>.yaml`，在 `active.yaml` 设 `override: <name>`，确认无误后可删 `secrets.yaml`。不会自动迁移。

## v1 明确不做

Cookie 管理、Basic/Bearer 助手、multipart 上传、HTTP/2、WebSocket、gRPC、SSE、多请求标签页、账号登录、云同步、跳过 TLS 校验、关闭跟随重定向。

跟随重定向最多 10 次。HTTPS 使用系统 CA。出站忽略 `HTTP_PROXY` / `HTTPS_PROXY`。

## 开发

```bash
go test ./...
```

改前端后重建嵌入资源（Vite 输出到 `internal/server/ui/`，由 Go `embed`，无需手工复制）：

```bash
cd web && npm run build
go build -o httptest ./cmd/httptest
```

开发时可用 `web/` 的 Vite（`npm run dev`）把 `/api` 代理到 `http://127.0.0.1:1370`，须同时先启动 Go 服务。产品形态仍是单二进制。

```
cmd/httptest/
internal/workspace/
internal/executor/
internal/server/
web/
```

## 相关文档

实现与文件格式细节见 [docs/superpowers/specs/2026-09-01-httptest-design.md](docs/superpowers/specs/2026-09-01-httptest-design.md)。工作目录布局见 [docs/superpowers/specs/2026-09-05-workdir-design.md](docs/superpowers/specs/2026-09-05-workdir-design.md)。
