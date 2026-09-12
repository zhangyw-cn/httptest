# httptest Hosts 解析设计规格

日期：2026-09-12  
状态：已与用户对齐，待用户审阅本文件后进入实现计划  
前置规格：`2026-09-01-httptest-design.md`（executor Transport、execute）、`2026-09-06-env-panel-design.md`（命名 YAML、活动栏面板、active 联动）、`2026-09-08-overrides-design.md`（顶栏选择器与「无」）、`2026-09-09-settings-panel-design.md`（活动栏沉底设置、非请求视图主区）。本文件不取代它们，只增加独立于环境的 hosts 解析能力。

## 1. 目的与成功标准

支持多套可 git 共享的 hosts 配置：把指定域名解析为固定 IP，由 Go 出站 `DialContext` 生效，不修改系统 `/etc/hosts`。配置与环境、覆盖相互独立；发送时由顶栏选用（含「无」）。

成功标准：

- 工作区存在 `hosts/<name>.yaml`，可随项目提交共享。
- 活动栏有「Hosts」面板：新建、编辑 mappings、改名、删除；树选中与顶栏「发送用」选择器独立。
- 顶栏有 Hosts 选择器：选项为「无」+ 全部配置名；当前选用写入 `.httptest/local/` 的 active 状态（不进 git）。
- 选用某套后，请求 URL 的 hostname **精确匹配**（小写）命中则拨号到对应 IP；**HTTP `Host` 与 HTTPS SNI / 证书校验仍使用原域名**。
- 选「无」、映射未命中、或 URL 主机已是 IP 字面量：行为与现网系统 DNS / 直连一致。
- 跟随重定向时，同一张 mappings 对每一跳 hostname 继续生效。

非目标（本次不做）：通配符 / 子域后缀匹配、按环境或单请求绑定 hosts、读写系统 `/etc/hosts`、把 URL 改写成 IP 的伪方案、IPv6 解析策略 UI、与 `HTTP_PROXY` 联动、抽象「通用命名配置」大重构、新 npm 依赖。

## 2. 约束

| 项 | 决定 |
|---|---|
| 方案 | 与环境平行的完整能力：共享目录 + 活动栏面板 + 顶栏选择器 + active 字段 + executor Dial |
| 匹配 | 仅精确 hostname；读写与查找均规范为小写；不支持 `*.example.com` |
| 拨号 | 命中则 `dial(network, ip:port)`；不改 `req.URL.Host` / `req.Host` |
| 栈 | 现有 Go + React/TS/Vite + 手写 CSS；不新增 npm 包 |
| 语言 | 界面中文 |
| README | 实现后更新「界面」「工作区」：`hosts/`、顶栏 Hosts、活动栏 Hosts |

## 3. 架构

仍是单进程三层，不引入新顶层包名以外的架构；`workspace` 增 hosts 文件读写，`executor` 增 Dial 映射，`server` 增 API 并在 execute 时加载 active hosts。

```
浏览器
  活动栏「Hosts」→ 左树（编辑选中）
  顶栏「Hosts」  → 发送用当前配置（独立；可「无」）
       │
       ▼
server  /api/hosts* + active.hosts
        POST /api/execute 读取 active.hosts → 加载 mappings
       │
       ▼
workspace
  <workdir>/hosts/*.yaml
  <workdir>/.httptest/local/…  当前选用 hosts 名（不进 git）
       │
       ▼
executor
  Transport.DialContext：命中则 dial 固定 IP，否则默认解析
  Host / SNI 保持原域名
```

出站仍忽略 `HTTP_PROXY` / `HTTPS_PROXY`（既有 `Proxy = nil` 不变）。

### 3.1 组件边界

| 单元 | 职责 | 依赖 |
|---|---|---|
| `workspace` hosts | 列表 / 读写 / 改名 / 删除；校验名与 mappings；联动 active.hosts | 工作区路径、与环境相同的命名规则 |
| `server` `/api/hosts*` | CRUD + rename；错误码映射对齐环境 | workspace |
| active | 扩展现有发送用 active，增加 `hosts` 字符串字段（空 =「无」） | `.httptest/local/` |
| `executor` | `newExecuteTransport(mappings)`；Dial 查表；可选结果中暴露实际拨号 IP | mappings map |
| 前端 Hosts 面板 | 左树 + mappings 键值编辑；Dialog 新建/改名/删除；`Ctrl+S` | `/api/hosts*` |
| 顶栏选择器 | 「无」+ 名称列表；切换写 active.hosts | active API |

## 4. 数据模型与文件

### 4.1 共享文件

路径：`<workdir>/hosts/<name>.yaml`  
身份：不含 `.yaml` 的文件名 = 配置名；不能含 `/`；规则与 `environments/` 的 `envPath` / `CleanRel` 同类校验一致。

```yaml
name: lan
mappings:
  api.example.com: "10.0.0.5"
  pay.example.com: "10.0.0.8"
```

- `name`：与文件名一致；改名时文件与字段一起更新（对齐环境）。
- `mappings`：hostname → IP 字符串。空 map 合法（选用后等于未覆盖）。
- 键：保存与加载时规范为小写；禁止含 `://`、`/`、`:`（端口只出现在请求 URL 上）。
- 值：IPv4 或 IPv6 字面量；非法则拒绝保存。
- 同一文件内重复键（大小写视为同一主机）：拒绝，不静默覆盖。

### 4.2 当前选用（不进 git）

扩展 `.httptest/local/` 中现有「发送用」active 状态，增加字段 `hosts`：

- 非空字符串：发送使用该 hosts 配置名。
- 空或缺省：顶栏「无」，不应用任何映射。

与 `environment` / override 字段相互独立：切环境不改 hosts，切 hosts 不改环境。

**删除**当前选用的配置：删文件后把 active.hosts 清空为「无」（对齐环境删当前项）。  
**改名**当前选用的配置：active.hosts 写成新名。

## 5. API

### 5.1 Hosts CRUD

| 方法 | 路径 | 成功 | 作用 |
|---|---|---|---|
| `GET` | `/api/hosts` | 200，列表 | 列出全部 hosts 配置 |
| `PUT` | `/api/hosts/{name}` | 200 | upsert（校验并保存 mappings） |
| `DELETE` | `/api/hosts/{name}` | 204 | 删文件；若为当前选用则清空 active.hosts |
| `POST` | `/api/hosts/{name}/rename` | 200，body 为改名后对象 | body `{ "name": "<新名>" }`；若当前选用是旧名则改写 active.hosts |

路径非法（`..`、绝对路径、含 `/` 的名）→ 400。Host / Origin / JSON Content-Type 守卫不变。

| 错误 | HTTP |
|---|---|
| 非法名 / 非法 mappings | 400 |
| 源不存在 | 404 |
| 改名目标已存在 | 409 |
| 其它 | 500 |

新建同名保护可与环境相同：UI 提交前用列表查重；`PUT` 仍为 upsert。

### 5.2 Active

扩展现有 active 的 `GET` / `PUT`（同一资源，不另开 `/api/active-hosts`）：增加字段 `hosts`（字符串，空 =「无」）。顶栏切换只写 active，不改 mappings 文件内容。旧客户端或旧文件缺该字段时视为「无」。

### 5.3 Execute

`POST /api/execute`：**服务端**读取 active.hosts，加载对应 `hosts/<name>.yaml` 的 mappings，再交给 `executor`。不信任客户端自行提交的 mappings 正文（防篡改出站目标）；与环境变量以服务端 active 为准的模式一致。

若 active.hosts 非空但文件已不存在：**降级为「无」**（系统 DNS），不阻断发送。UI 在刷新列表后可将选择器显示为「无」。

## 6. Executor 行为

- `newExecuteTransport(mappings map[string]string)`（或等价参数）：在既有 Transport 定制（`Proxy = nil`、`DisableCompression` 等）之上设置 `DialContext`。
- 从 dial 地址解析 hostname 与 port；hostname 小写后查 `mappings`。
- **命中**：对 `ip:port` 建立连接（IPv6 字面量按 Go 惯例加方括号）。
- **未命中**或 mappings 为空 / nil：默认 dial（系统解析）。
- URL 主机已是 IP 字面量：不查表，直接连。
- 不修改请求 URL 的 host、不改写 `Host` 头；TLS 握手 SNI 与证书名校验仍用原域名。
- 重定向：同一 Client/Transport，同一 mappings 对后续跳转继续生效。
- 结果展示：命中自定义映射时，在 **Request → Overview** 增加只读字段展示实际拨号 IP（结果 JSON 字段名 `resolvedIP`）；未命中则省略或空，Timeline 不另做专门行。DNS 耗时：记 dial 前实际耗时即可（自定义映射通常接近 0），不单独发明错误分类。

连接/TLS/超时失败仍走现有 `connect` / `tls` / `timeout` / `dns` 分类。

## 7. UI

### 7.1 活动栏

- `LeftView` 增加 `"hosts"`，放在上方工作视图（与 collection / history / environment / override 一组）；`settings` 仍沉底。
- 文案：「Hosts」；再点当前图标只切换 `panelOpen`；`Ctrl+B` 行为不变。
- `view === "hosts"`：侧栏列配置名；主区为 mappings 编辑器；**不渲染** UrlBar、请求编辑器、响应区（与环境 / 覆盖 / 设置一致）。
- 树选中只用于编辑；顶栏选择器才是发送用当前 hosts。
- 新建 / 改名 / 删除走现有 Dialog；显式保存与未保存标记、`Ctrl+S` 对齐环境面板。
- Hosts 视图下 `Ctrl+Enter` 不发送（对齐环境面板）。

### 7.2 顶栏

- 在环境、覆盖旁增加 Hosts 选择器：`无` + 全部配置名。
- 切换即 `PUT` active.hosts；不触发发送。
- 设置视图下：顶栏仍显示工作相关控件（含 Hosts）；主区仍为设置表单。

### 7.3 编辑器校验

保存前（UI）与 `PUT`（服务端）双端校验：

- 空主机名或空 IP → 拒绝并提示。
- 主机名含 `://`、`/`、`:` → 拒绝。
- IP 非 IPv4/IPv6 字面量 → 拒绝。
- 重复主机名（大小写不敏感）→ 拒绝并提示，不静默合并。

### 7.4 结果区

有 hosts 命中时，Request → Overview 显示 `resolvedIP`；未命中不展示该行。

## 8. 错误处理与边界

| 情况 | 行为 |
|---|---|
| mappings 键/值非法 | `PUT` 400；UI 先拦 |
| 名非法 / 路径穿越 | 400 |
| 改名冲突 | 409 |
| 删/改名不存在 | 404 |
| active 指向已删文件 | execute 降级为「无」，不挡发送 |
| 命中 IP 但 TCP/TLS 失败 | 现有 `connect` / `tls` |
| 未命中且 DNS 失败 | 现有 `dns` |

边界：

- 只匹配 hostname，不匹配端口、path、完整 URL。
- 不读写系统 `/etc/hosts`。
- 出站忽略代理的既有策略不变。

## 9. 测试

最低集：

- **workspace**：读写、改名、删除、active.hosts 在删/改当前项时的联动；非法 mappings 拒绝。
- **executor**：命中则连到指定 IP 且请求 Host/SNI 仍为域名；未命中走默认解析；mappings 空 / nil 等价不覆盖；重定向第二跳同样应用 mappings。
- **API**：CRUD + rename 状态码；execute 使用 active.hosts；active 指向缺失文件时降级不 5xx。
- **前端**：选择器「无」、非法 host/IP、重复键保存校验（单测逻辑模块即可）。

## 10. README

实现完成后更新：

- 工作区布局增加 `hosts/`。
- 界面：活动栏 Hosts、顶栏 Hosts 选择器（含「无」）、与环境独立的说明。
