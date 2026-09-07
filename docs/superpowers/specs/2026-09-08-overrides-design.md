# httptest 独立覆盖（overrides）设计规格

日期：2026-09-08  
状态：已与用户对齐，待用户审阅本文件后进入实现计划  
前置规格：`2026-09-01-httptest-design.md`（变量替换）、`2026-09-03-ui-ux-design.md`（壳层、活动栏）、`2026-09-05-workdir-design.md`（`.httptest/local/`）、`2026-09-06-env-panel-design.md`（环境面板对称行为）。

## 1. 目的与成功标准

用更通用的「覆盖」取代「密钥」：本机私有、可切换的多套变量集，与环境模板独立选择、独立管理；不暗示内容必须是敏感密钥。

成功标准：

- 磁盘为 `.httptest/local/overrides/<name>.yaml`；`active.yaml` 同时记录 `environment` 与 `override`（均可空）。
- 活动栏第四项「覆盖」：左列名称、中间编辑变量；树选中与顶栏「当前覆盖」独立。
- 顶栏：环境选择器 + 覆盖选择器（含「无」）；不再有顶栏内联编辑密钥。
- 合并顺序：环境模板 → 当前覆盖；缺失 `{{var}}` 或当前覆盖文件缺失时 `invalid`，不发送。
- `/api/local` 只传两个名字；覆盖 CRUD 走 `/api/overrides*`。
- 旧 `secrets.yaml` 破坏性废弃：代码不读；README 说明手迁。

非目标（本次不做）：值遮罩、覆盖复制、从环境导入变量、覆盖分组/子目录、按环境绑定覆盖、自动迁移/兼容读 `secrets.yaml`、加密存储、云同步、新 npm 依赖、新 HTTP 能力。

## 2. 约束

| 项 | 决定 |
|---|---|
| 方案 | 与环境同构的覆盖子系统；服务端管删/改名并同步 `active.yaml` |
| 命名 | 产品与文档用「覆盖」；路径与 API 用 `overrides` / `override`；不再用「密钥」/ `secrets` |
| 身份 | 覆盖名 = `overrides/` 下不含 `.yaml` 的文件名；不能含 `/`；规则同 `envPath` / `CleanRel` |
| YAML | `name` + `variables` 字符串 map，与环境文件同形 |
| 关联 | 环境与覆盖完全独立选择；不按环境绑定 |
| 空覆盖 | 顶栏可选「无」；此时只用环境模板 |
| 迁移 | 破坏性；无自动迁移 |
| 栈 | 现有 Go + React/TS/Vite + 手写 CSS |
| 语言 | 界面中文 |
| README | 实现后把「环境与密钥」改为「环境与覆盖」，并写手迁步骤 |

## 3. 架构

仍是单进程三层，不引入新包。

```
浏览器
  活动栏「覆盖」→ 左列（编辑选中）
  顶栏「覆盖」  → 发送用的当前覆盖（独立；可「无」）
  顶栏「环境」  → 发送用的当前环境（不变）
       │
       ▼
server  /api/overrides* 、 /api/local
       │
       ▼
workspace
  <workdir>/.httptest/local/overrides/*.yaml
  <workdir>/.httptest/local/active.yaml   # environment + override
```

`ResolvedVars`：读当前环境模板（若有），再被当前覆盖同名覆盖。`override` 为空则跳过覆盖层。`override` 非空但文件不存在：返回可区分错误（如 `ErrOverrideNotFound`），**不**静默当成无覆盖；execute 将其分类为 `invalid`，提示中带上覆盖名。环境文件缺失仍与现行为一致（跳过模板层，不因此 invalid）。

环境为空、覆盖非空：变量仅来自该覆盖（对称于旧「无环境仅 secrets」）。

### 3.1 磁盘布局

```
.httptest/local/
  active.yaml
  overrides/
    <name>.yaml
  # secrets.yaml  — 不再读取
```

`active.yaml`：

```yaml
environment: local
override: default    # 缺省键或空字符串 = 无覆盖
```

单套覆盖：

```yaml
name: default
variables:
  token: "..."
  password: "..."
```

权限：`local/` 目录 `0700`；覆盖文件 `0600`（写入后 chmod，与旧 secrets 文件一致）。

### 3.2 API

**覆盖 CRUD**（镜像 `/api/environments*`）：

| 方法 | 路径 | 成功 | 作用 |
|---|---|---|---|
| `GET` | `/api/overrides` | 200，列表 | 列出全部覆盖 |
| `PUT` | `/api/overrides/{name}` | 200 | upsert；body `{ "name", "variables" }`（与 Environment JSON 同形；路径名优先） |
| `DELETE` | `/api/overrides/{name}` | 204 | 删文件；若是当前覆盖，把 `active.yaml` 的 `override` 置空 |
| `POST` | `/api/overrides/{name}/rename` | 200，body 为改名后对象 | body `{ "name": "<新名>" }`；若旧名是当前覆盖，同步改 `active.yaml` |

路径非法（`..`、含 `/`）仍 400。Host / Origin / JSON Content-Type 守卫不变。

workspace 可区分错误 → handler 映射与环境一致：

| 错误 | HTTP |
|---|---|
| 非法名 | 400 |
| 源文件不存在 | 404 |
| 改名目标已存在 | 409 |
| 其它 | 500 |

新建同名保护只在 UI（列表查重）；本机单用户，`PUT` 不做「仅创建」。

**本机状态**：

| 方法 | 路径 | body |
|---|---|---|
| `GET` / `PUT` | `/api/local` | `{ "environment": "...", "override": "..." }` |

- `PUT /api/local` 只写两个名字，不写变量内容。
- 删除原 `secrets` 字段与读写路径。
- 缺 `active.yaml` 时 `environment`、`override` 皆为空字符串。

### 3.3 改名与删除顺序

与环境面板规格对称（读文件 → 写新/删旧 → 必要时更新 `active.yaml` → 失败回滚）。`case-only` 改名用临时 `.renaming` 文件，规则同环境。

**删除** `name`：

1. 校验名；读 `active.yaml`。
2. 读覆盖文件到内存；不存在则 404，不改 active。
3. 删文件；若 `active.override == name`，把 override 写成空；失败则写回文件。

**改名** `old → new`：

1. 校验；目标已存在且非 case-only → 409。
2. 写新文件、删旧（case-only 经临时名）。
3. 若当前覆盖是旧名，把 `active.yaml` 的 override 写成新名；失败则回滚文件。

## 4. UI

**活动栏**：第四项「覆盖」（顺序：集合 / 历史 / 环境 / 覆盖）。

- 左列：覆盖名；选中只打开编辑，不改顶栏当前覆盖。
- 中间：编辑 `variables`；显式 Save、未保存标记；覆盖视图下 `Ctrl+S` 保存覆盖，`Ctrl+Enter` 不发送。
- 新建 / 改名 / 删除用应用内对话框；删或改名触及「当前发送用覆盖」时须确认。

**顶栏**：

- 环境选择器保留。
- 原密钥面板改为覆盖 `<select>`：选项「无」+ 各套名称；变更只 `PUT /api/local` 更新 `override`，保留 `environment`。
- 去掉顶栏内联编辑变量；编辑一律在覆盖面板。

**文案**：界面、README、错误提示用「覆盖」；不再出现「密钥」（实现时全局替换用户可见文案与相关标识）。

## 5. 迁移

破坏性变更：

1. 将旧 `.httptest/local/secrets.yaml` 的 `variables` 拷入 `.httptest/local/overrides/<自选名>.yaml`（含 `name` 字段）。
2. 在 `active.yaml` 增加或设置 `override: <自选名>`（若希望发送时继续使用这些值）。
3. 可删除 `secrets.yaml`。

代码路径不读取、不迁移旧文件。若用户未手迁，旧值不会参与 `ResolvedVars`。

## 6. 测试

Go：

- workspace：覆盖 CRUD；改名冲突 409；删/改当前覆盖同步 `active.yaml`；`ResolvedVars` 覆盖优先；空 override；非空 override 但文件缺失 → `ErrOverrideNotFound`（或同等哨兵）。
- server：`/api/overrides*`；`/api/local` 新 JSON；execute 将 `ErrOverrideNotFound` 映射为 `invalid`（提示含覆盖名）。
- 回归：环境 CRUD 与仅环境变量发送仍通过。

前端：

- 纯函数（若抽出）：覆盖列表排序、local JSON 键等。
- 手工：顶栏双选择器独立；覆盖面板 Save；「无」发送；缺失套时不发送并提示。

## 7. 实现时需改动的主要表面

- `internal/workspace`：`Local` 类型、`secrets.yaml` → `overrides/`、`ResolvedVars`、覆盖 CRUD。
- `internal/server`：handlers、execute 前变量解析。
- `web/`：活动栏、覆盖面板（可对照环境面板）、顶栏选择器、API 客户端类型、文案。
- `README.md` 与本规格引用处。

实现顺序建议：workspace + 测试 → API → execute/invalid → 前端面板与顶栏 → README。
