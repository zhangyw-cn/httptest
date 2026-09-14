# httptest Hosts 双类型设计规格

日期：2026-09-15  
状态：已与用户对齐，待用户审阅本文件后进入实现计划  
前置规格：`2026-09-12-hosts-resolution-design.md`（Hosts 目录、顶栏选用、Dial、active.hosts）。本文件不取代该规格的拨号与 UI 骨架，只扩展文件模型为必填 `type` 的两种形态，并调整非法文件的列表行为。

## 1. 目的与成功标准

在现有 Hosts 能力上支持两种配置形态，统一落在 `hosts/<name>.yaml`，用必填字段 `type` 区分：

- `map`：现有 hostname → IP 的 `mappings` 键值编辑
- `hosts`：经典 hosts 原文（`content`），支持 `#` 注释与别名；UI 多行文本编辑，保存原样落盘

发送时仍由顶栏选用（含「无」），解析为 `map[string]string` 后走既有 `DialContext`；不修改系统 `/etc/hosts`；与环境、覆盖相互独立。

成功标准：

- 每个 hosts 文件必须含 `type: map` 或 `type: hosts`；缺省、空串或其它值视为非法。
- 非法文件使 `GET /api/hosts`（列表）失败，不静默跳过。
- 新建 Dialog 选择类型；创建后不可更改类型。
- `map` 沿用现有键值编辑器与校验；`hosts` 用等宽文本框编辑 `content`，校验通过后原样写入。
- `hosts` 类型解析时，主名与每个别名均精确匹配（小写）到同一 IP。
- `ActiveHostsMappings` / execute 对两种类型归一为同一张 map；Dial、Host、SNI、`resolvedIP` 语义不变。

非目标（本次不做）：通配符 / 子域后缀、读写系统 `/etc/hosts`、类型互转或自动迁移工具、缺省 `type` 兼容旧文件、按环境或单请求绑定 hosts、新 npm 依赖、抽象「通用命名配置」大重构。

## 2. 约束

| 项 | 决定 |
|---|---|
| 路径 | 仍为 `hosts/<name>.yaml`；不用 `.hosts` 后缀区分 |
| 类型 | 必填 `type: map` \| `type: hosts`；大小写敏感；创建后不可改 |
| 旧文件 | 无 `type` 不兼容；须手工补 `type: map`（并保留原 `mappings`） |
| 非法列表 | 任一 hosts 文件非法 → 列表接口失败（不跳过） |
| 发送降级 | `active.hosts` 指向的文件非法或缺失 → 降级为「无」，不阻断发送 |
| 匹配 | 仅精确 hostname（含别名展开后）；小写规范化 |
| 栈 | 现有 Go + React/TS/Vite + 手写 CSS；不新增 npm 包 |
| 语言 | 界面中文 |
| README | 实现后更新 Hosts 节：双类型示例、破坏性说明、新建选类型 |

## 3. 架构

仍是单进程三层；`executor` 拨号逻辑不变，只消费解析后的 map。

```
浏览器
  新建 Dialog → 选 type（map | hosts）
  活动栏 Hosts → map：键值编辑器；hosts：文本框（content）
  顶栏 Hosts  → 发送用配置名（与现网一致）
       │
       ▼
server  /api/hosts*（对象含 type + mappings|content）
        List：遇非法文件失败
        execute：ActiveHostsMappings → map
       │
       ▼
workspace
  hosts/<name>.yaml
  按 type 校验；hosts 类型解析 content → map（别名展开）
       │
       ▼
executor
  DialContext 查表（不变）
```

### 3.1 组件边界

| 单元 | 职责 | 依赖 |
|---|---|---|
| `workspace` hosts | 列表/读写/改名/删除；强制 `type`；按类型校验正文；`hosts` 解析别名；禁止改类型 | 工作区路径、既有命名规则 |
| hosts 文本解析 | 解析经典 hosts 行 → `map[string]string`；校验用 | 无 |
| `server` `/api/hosts*` | CRUD + rename；列表非法即失败；错误码映射 | workspace |
| active | 仍只存配置名字符串；不存 type | `.httptest/local/` |
| `executor` | 不变 | mappings map |
| 前端 Hosts | 新建选类型；按类型切换编辑器；保存校验；不提供改类型 | `/api/hosts*` |

## 4. 数据模型与文件

### 4.1 公共字段

路径：`<workdir>/hosts/<name>.yaml`  
身份：不含 `.yaml` 的文件名 = 配置名（与现网一致）。

```yaml
name: lan
type: map   # 必填：map | hosts
```

- `name` 与文件名一致；改名时文件与字段一起更新。
- `type` 仅允许 `map`、`hosts`；缺字段、空串、其它值 → 文件非法。
- `PUT` 更新已存在文件时：请求体 `type` 必须与磁盘已有 `type` 一致，否则 400。
- UI 不提供修改类型的入口。

### 4.2 `type: map`

```yaml
name: lan
type: map
mappings:
  api.example.com: "10.0.0.5"
  pay.example.com: "10.0.0.8"
```

- `mappings`：hostname → IP；空 map 合法。
- 键：保存与加载时规范为小写；禁止含 `://`、`/`、`:`。
- 值：IPv4 或 IPv6 字面量（`net.ParseIP`）；非法拒绝。
- 同文件重复键（大小写不敏感）→ 拒绝。
- 不得同时带**非空** `content`；有则 400。`content` 缺省或空串可忽略。
- `mappings` 缺省按空 map。

### 4.3 `type: hosts`

```yaml
name: lan
type: hosts
content: |
  10.0.0.5 api.example.com api
  # lan gateway
  10.0.0.8 pay.example.com
```

- `content`：经典 hosts 原文；可空（选用后等于无覆盖）。
- 保存：解析校验通过后**原样**写入 YAML 字符串（保留注释、空行、换行与排版）；不以解析结果回写覆盖原文。
- 不得同时带**非空** `mappings`；有则 400。`mappings` 缺省或空 map 可忽略。

行语法：

- 空行、整行以 `#` 开头的注释、以及行内第一个 `#` 之后的内容：不参与映射。
- 映射行：空白分隔的 `IP hostname [alias...]`（至少一个主机名）。
- `IP`：IPv4 / IPv6 字面量。
- `hostname` / `alias`：规范为小写后写入运行时 map；禁止含 `://`、`/`、`:`。
- 同一文件内任一主机名（主名或别名）重复 → 保存失败，不静默覆盖。
- 同一行多个名字全部映射到该行 IP。

### 4.4 运行时映射

`ActiveHostsMappings()`：

1. 读 `active.hosts`；空 → 返回 nil（「无」）。
2. 读对应 yaml；文件缺失、YAML 损坏、`type` 非法、正文非法 → 返回 nil（降级「无」），不返回 error 阻断 execute。
3. `map`：校验并返回 `mappings`；`hosts`：解析 `content` 得到 map（含别名）并返回。

列表路径与发送路径分离：列表对非法文件严格失败；发送对当前选用文件宽松降级。

### 4.5 破坏性变更

旧版无 `type` 的 `hosts/*.yaml` 会使 Hosts 列表失败，直到手工补上例如：

```yaml
name: lan
type: map
mappings:
  api.example.com: "10.0.0.5"
```

不提供自动迁移。

## 5. API

路径与守卫不变：`GET/PUT/DELETE /api/hosts/{name}`、`POST /api/hosts/{name}/rename`；Host / Origin / JSON Content-Type 守卫不变。

### 5.1 对象形状

```json
{
  "name": "lan",
  "type": "map",
  "mappings": { "api.example.com": "10.0.0.5" },
  "content": ""
}
```

或：

```json
{
  "name": "lan",
  "type": "hosts",
  "mappings": {},
  "content": "10.0.0.5 api.example.com api\n"
}
```

- 列表与单次写回均返回完整对象（含 `type` 与两种正文字段；未用字段为空串或空对象）。
- 服务端按 `type` 校验：未用字段若非空 → 400。

### 5.2 行为

| 方法 | 路径 | 成功 | 作用 |
|---|---|---|---|
| `GET` | `/api/hosts` | 200，列表 | 列出全部；**任一文件非法 → 失败**（HTTP 500，message 指明文件名与原因） |
| `PUT` | `/api/hosts/{name}` | 200 | upsert；新建必须带合法 `type`；已存在则禁止改 `type` |
| `DELETE` | `/api/hosts/{name}` | 204 | 删文件；若为当前选用则清空 `active.hosts` |
| `POST` | `/api/hosts/{name}/rename` | 200 | 改名；不改 `type`；若当前选用是旧名则改写 `active.hosts` |

| 错误 | HTTP |
|---|---|
| 非法名 / 非法 type / 非法正文 / 改类型 / 交叉字段非空 | 400 |
| 源不存在 | 404 |
| 改名目标已存在 | 409 |
| 列表时读到非法文件或其它 I/O | 500 |
| 其它 | 500 |

### 5.3 Execute

`POST /api/execute` 仍由服务端读 `active.hosts` 再加载 mappings；不信任客户端提交的 hosts 正文。选用文件非法或缺失时降级为「无」，不因此 5xx。

## 6. UI

- 新建 Dialog：名称 + 类型单选（`map` / `hosts`）；确认后创建并打开对应编辑器。
- `map`：现有键值对编辑器；`hosts`：等宽多行文本框编辑 `content`。
- 显式保存与未保存标记、`Ctrl+S` 对齐环境面板；Hosts 视图下 `Ctrl+Enter` 不发送。
- 树与顶栏仍只显示配置名；编辑区可用只读小标签提示当前 `type`。
- 不提供改类型；改名/删除 Dialog 行为不变。
- 前端保存前按类型做与服务端一致的校验（`map` 用现有逻辑；`hosts` 用同源语法规则的解析校验）。
- 若列表接口因非法文件失败：UI 展示错误信息（含原因），不假装空列表。

## 7. 错误处理与边界

| 情况 | 行为 |
|---|---|
| 缺/非法 `type` | 列表 500；PUT 400 |
| 改已有文件的 `type` | 400 |
| map/hosts 正文非法、交叉字段非空 | 400 |
| 改名冲突 | 409 |
| 删/改名不存在 | 404 |
| active 指向缺失或非法文件 | execute 降级「无」 |
| `hosts` 别名与主名冲突（重复） | 保存 400 |

边界：

- 只匹配 hostname（及别名），不匹配端口、path。
- 不读写系统 `/etc/hosts`。
- 出站忽略代理的既有策略不变。

## 8. 测试

最低集：

- **workspace**：缺/非法 `type` → `ListHosts` 报错；`map`/`hosts` 各自校验与保存；禁止改类型；`hosts` 别名展开；重复主机名拒绝；`content` 原样读写（注释保留）；交叉字段非空拒绝。
- **API**：两种类型 CRUD + rename 状态码；列表遇非法文件 500；PUT 改类型 400；execute 选用非法文件时降级不 5xx。
- **executor**：既有 Dial 测例保持；可选一条经 workspace 解析别名后命中的路径。
- **前端**：新建选类型；`map`/`hosts` 保存校验；无改类型入口；列表错误展示。

## 9. README

实现完成后更新：

- Hosts 节：说明 `type: map` 与 `type: hosts`，各给示例。
- 破坏性：必须有 `type`；旧文件需手工补 `type: map`。
- 界面：新建可选类型；`hosts` 类型为文本编辑（注释与别名）。

## 10. 与前置规格的关系

- Dial、精确匹配、顶栏「无」、active 联动、结果 `resolvedIP`：仍以 `2026-09-12-hosts-resolution-design.md` 为准。
- 本规格覆盖并修正该文件中「仅 mappings YAML、列表跳过损坏文件」的假设：改为必填 `type`、双正文形态、列表遇非法失败。
- 实现计划应同时更新受影响的测试夹具（例如补 `type: map`）与 README。
