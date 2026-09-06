# httptest 环境管理面板设计规格

日期：2026-09-06  
状态：已与用户对齐，待用户审阅本文件后进入实现计划  
前置规格：`2026-09-01-httptest-design.md`（环境 YAML、替换顺序）、`2026-09-03-ui-ux-design.md`（壳层、活动栏、对话框）、`2026-09-05-workdir-design.md`（`environments/` 在工作目录）。

## 1. 目的与成功标准

在 Web UI 里完整管理可 git 共享的环境模板（`environments/<name>.yaml`）：新建、编辑变量、改名、删除。顶栏环境选择器仍只负责「发送用哪一套」；密钥面板与 `secrets.yaml` 不变。

成功标准：

- 活动栏第三项「环境」：左树列环境名，中间编辑变量；树选中与顶栏当前环境独立。
- 显式 Save（未保存标记、`Ctrl+S`），与请求一致。
- 可新建、改名、删除；删/改当前发送环境时服务端同步 `active.yaml`，且须对话框确认。
- 密钥仍只在顶栏密钥面板编辑；模板里不放密钥。

非目标（本次不做）：未保存切换拦截、环境复制、从密钥导入变量、环境子目录/分组、覆盖已存在的改名目标、密钥面板重做、多请求标签、新 HTTP 能力、新 npm 依赖。

## 2. 约束

| 项 | 决定 |
|---|---|
| 方案 | 服务端管生命周期：删除与改名在 workspace 内同时处理文件和（如需要）`active.yaml` |
| 身份 | 环境名 = `environments/` 下不含 `.yaml` 的文件名；不能含 `/`；规则与现有 `envPath` / `CleanRel` 相同 |
| YAML | `name` + `variables` 字符串 map，格式不变 |
| 密钥 | `.httptest/local/secrets.yaml` 与顶栏密钥面板不改 |
| 栈 | 现有 Go + React/TS/Vite + 手写 CSS；不新增 npm 包 |
| 语言 | 界面中文 |
| README | 实现后更新「界面」一节 |

## 3. 架构

仍是单进程三层，不引入新包。

```
浏览器
  活动栏「环境」→ 左树（编辑选中）
  顶栏「环境」  → 发送用的当前环境（独立）
       │
       ▼
server  /api/environments*
       │
       ▼
workspace
  <workdir>/environments/*.yaml
  <workdir>/.httptest/local/active.yaml   仅在删/改「当前环境」时由服务端改
```

`internal/executor` 与变量替换顺序不变：环境模板 → secrets。缺失 `{{var}}` 仍拒绝发送。

### 3.1 API

现有 `GET /api/environments`、`PUT /api/environments/{name}` 保留。`PUT` 仍为 upsert（保存变量要覆盖）。不新增单份 GET：编辑器数据来自列表项。

| 方法 | 路径 | 成功 | 作用 |
|---|---|---|---|
| `DELETE` | `/api/environments/{name}` | 204 | 删文件；若 `{name}` 等于当前环境，把 `active.yaml` 写成空环境名 |
| `POST` | `/api/environments/{name}/rename` | 200，body 为改名后的 `Environment` | body `{ "name": "<新名>" }`：写新文件、删旧文件；若旧名是当前环境，把 `active.yaml` 写成新名 |

路径非法（`..`、绝对路径、含 `/` 的环境名）仍 400。Host / Origin / JSON Content-Type 守卫不变。`POST .../rename` 的 JSON Content-Type 规则与其它写接口相同。

`workspace` 新增可区分错误，handler 映射：

| 错误 | HTTP |
|---|---|
| 非法名（现有 `invalid environment name` / `invalid path`） | 400 |
| 源文件不存在（`os.ErrNotExist`） | 404 |
| 改名目标已存在（哨兵 `workspace.ErrEnvExists`） | 409 |
| 其它 | 500 |

新建同名保护只在 UI：提交前用当前列表查重，对话框报错、不发 `PUT`。本机单用户，不在 `PUT` 上做「仅创建」。

### 3.2 改名与删除的文件顺序

**删除** `name`：

1. 解析并校验 `name`。
2. 读当前 `active.yaml`（缺文件视为当前环境为空）。
3. 读环境文件到内存（供 active 写入失败时写回）；不存在则返回 `os.ErrNotExist`（不改 active）。
4. `os.Remove` 环境文件。
5. 若删除前当前环境等于 `name`，把 `active.yaml` 写成空环境名。此步失败则把步骤 3 读到的内容写回原路径，再返回错误。

**改名** `old` → `new`：

1. 校验 `old`、`new`；`new` 与 `old` 相同则 400（无操作）。
2. 目标路径已存在 → `ErrEnvExists`，旧文件不动。
3. 读旧文件；不存在 → `os.ErrNotExist`。
4. 写入新文件，YAML 里的 `name` 改为 `new`，`variables` 用磁盘上的旧值（不夹带编辑器未保存内容）。
5. 删除旧文件。失败则删除已写的新文件，返回错误。
6. 若改名前当前环境等于 `old`，把 `active.yaml` 写成 `new`。失败则恢复旧路径文件、删除新路径文件（active 保持旧名）。

回滚自身再失败：返回 500；不继续改 active。测试覆盖「active 写入失败时文件已回到旧名」这一条成功回滚路径。

## 4. 组件与界面

切到「环境」时，UrlBar + 请求栏 + 响应栏整块换成环境编辑器。顶栏的环境 `<select>` 和密钥面板原样。刷新后默认仍是集合。

```
┌─ TopBar: httptest | cwd | 主题 | 环境▼ | 密钥 ─┐
├────┬──────────┬──────────────────────────────────┤
│ 活 │ 环境     │ local              未保存 改名 Save │
│ 动 │  local   │ 键        值                       │
│ 栏 │  prod    │ baseUrl   http://127.0.0.1:8080  × │
│    │  ＋新建  │ [添加变量]                          │
└────┴──────────┴──────────────────────────────────┘
```

**ActivityBar**  
第三个图标「环境」。点选规则不变：点当前图标开合树；点另一个图标切视图并打开树。`Ctrl+B` 只开合树、不改视图。`Ctrl+B` 的 tooltip 仍写在集合图标上（与现规格一致），快捷键在三视图都生效。

`LeftView` 从 `"collection" | "history"` 扩展为 `"collection" | "history" | "environment"`。`clickActivityIcon` / `togglePanel` 行为不因第三视图改变。

**Sidebar（环境视图）**  
标题「环境」，右侧「＋」新建。扁平列表，无文件夹。点一项 = 打开编辑，**不**调用 `putLocal`。正在编辑的项用现有树选中态。若某项名字等于顶栏当前环境，行上加灰色「发送」，不用选中态表示发送环境。行上「×」删除。

空状态：无环境时「还没有环境」+ 按钮「新建环境」（与「＋」同一入口）。树收起时不展示空状态。

**EnvEditor（新组件）**  
替换工作区主栏。顶行：环境名（只读）、未保存标记、改名、Save。下方键值表（明文，`type="text"`，不是密码框）和「添加变量」。无变量时留一行空白，与 Headers 相同。空键在保存时丢掉；同名键后者覆盖。

未选中环境：「在左侧选择一个环境，或新建」。Save / 改名在未选中时不可用。

**Dialog（复用，规则与请求对话框相同）**  
点遮罩不关。`Esc` 关。路径类打开时聚焦输入；`Enter` 提交非空（IME 组字中不触发）。删除类打开时聚焦「取消」，`Enter` 不提交。空名时主按钮 disabled。提交期间主按钮 disabled。背后 `inert`。

| 场景 | 标题 | 正文 | 主按钮 |
|---|---|---|---|
| 新建 | 环境名 | 「文件名，例如 `local`，不能含 `/`」+ 输入框 | 创建 |
| 改名 | 重命名环境 | 同上；若该项是顶栏当前环境，加一句「顶栏当前环境将改为新名称。」 | 重命名 |
| 删除 | 删除环境 | 「删除 `local`？此操作会从磁盘去掉该文件。」若该项是顶栏当前环境，加一句「顶栏当前环境将变为未选择。」 | 删除（`--err` 色） |

新建：客户端发现同名已在列表中 → 对话框内报错，不发请求。提交前若名称含 `/` 或未通过与 `CleanRel` 相同的可见规则 → 对话框内报错。

**App**  
环境草稿与请求草稿分开。切集合 ↔ 环境时两边都留在内存。环境树换项：用列表里目标环境覆盖编辑器，当前未保存丢掉（不做切换提醒）。

## 5. 数据流

**打开编辑**  
点树项：用 `GET /api/environments` 已加载列表中的那一项填编辑器。草稿为 `{ name, pairs[] }`，每行有稳定 id。脏标记：pairs 序列化结果与上次成功加载或保存的快照不同。

**保存**（Save 或环境视图下 `Ctrl+S`）  
`PUT /api/environments/{name}`，`{ name, variables }`。成功后更新快照、清未保存、再拉一遍环境列表（顶栏下拉选项同步；不改当前环境）。保存过程中 Save disabled。

**新建**  
对话框确认 → `PUT /api/environments/{name}` 且 `variables: {}` → 刷新环境列表 → 选中该项进入编辑器（空表一行空白）。不改顶栏当前环境。

**改名**  
对话框确认 → `POST /api/environments/{old}/rename` `{ "name": "新名" }` → 刷新环境列表 → `GET /api/local`（若改的是发送环境，顶栏变成新名；否则顶栏不动）→ 树选中改为新名，编辑器用接口返回的 `Environment` 填入（磁盘内容）。改名只搬家已保存文件，不把未保存变量写进新文件；未保存编辑丢弃。要保留编辑须先 Save 再改名。

**删除**  
对话框确认 → `DELETE /api/environments/{name}` → 刷新列表 → `GET /api/local`。若删的是正在编辑的项，清空编辑选中，主栏回到未选中空状态。若删的是发送环境，顶栏为「未选择」（服务端已写空 `active.yaml`）。

**顶栏切换当前环境**  
仍只 `PUT /api/local`，改 `environment`、保留 secrets。与树选中互不影响。

**快捷键**

| 视图 | `Ctrl+S` | `Ctrl+Enter` | `Ctrl+B` |
|---|---|---|---|
| 集合 / 历史 | 保存请求 | 发送 | 开合树 |
| 环境 | 保存当前编辑的环境；未选中或未脏则无操作 | 无操作 | 开合树 |

Mac 上 Cmd 等效，与现有 `shortcut.ts` 一致。

## 6. 错误处理

对话框内的 API 失败：错误显示在对话框内，不关窗，不写顶栏 banner。编辑器保存失败：编辑器内错误条，未保存标记保留，草稿不丢。

列表：`environments/` 不存在 → 空数组、不报错。单份坏 YAML 仍跳过。路径存在但不是目录 → 500。

## 7. 测试

后端（`internal/workspace` + `internal/server`）：

- `DeleteEnvironment`：文件消失；删当前环境则 `active.yaml` 环境名为空；删其它则 `active.yaml` 不变；不存在 → not exist。
- `RenameEnvironment`：新文件在、旧文件无，且 YAML `name` 为新名；改当前环境则 active 跟着变；改其它则 active 不变；目标已存在 → `ErrEnvExists` 且无副作用；非法名失败且无副作用；`old == new` → 错误且无副作用。
- 回滚：改名在写入 `active.yaml` 失败时，旧文件恢复、新文件不在。
- HTTP：`DELETE` 与 `POST .../rename` 的 204/200、400、404、409；路径逃逸 400。

前端：

- `LeftView` 含 `"environment"`；活动栏状态机覆盖三图标（点当前收起、点另一个打开）。
- 点环境树不调用 `putLocal`。
- 脏标记：改一对键值后为脏，Save 成功后清。

`go test ./...` 与 `web` 现有 Vitest 都要过。改前端后 `cd web && npm run build`，嵌入 `internal/server/ui/`。

## 8. README

「界面」一节补上：活动栏为集合 / 历史 / 环境；环境视图左树右变量表；新建 / 改名 / 删除走应用内对话框；树选中只编辑，顶栏选择器才是发送环境。
