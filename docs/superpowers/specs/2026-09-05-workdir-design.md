# httptest 工作目录设计规格

日期：2026-09-05  
状态：已与用户对齐，待用户审阅本文件后进入实现计划

## 1. 目的与成功标准

把工作区从「cwd 下的隐藏 `.httptest/` 一把梭」改成「工作目录是项目根，`.httptest/` 只放本机数据」，并支持启动时指定工作目录。

成功标准：

- 可 git 共享的请求和环境出现在工作目录下的 `collections/`、`environments/`，与源码同树。
- `.httptest/` 只含本机数据（密钥、当前环境、历史）及一条自我隔离的 `.gitignore`。
- `httptest [DIR]` 打开指定目录；省略则用启动时的当前目录。
- 启动不在工作目录创建 `collections/`、`environments/`；第一次保存时才创建。
- 顶栏与 `GET /api/workspace` 展示/返回的是工作区根的绝对路径，不是 `.httptest` 的父目录这种派生值。

非目标（本次不做）：自动迁移旧 `.httptest/collections` 与 `.httptest/environments`、改写项目根 `.gitignore`、`--workdir` 标志、工作区切换 UI、`httptest init` 子命令、清单文件 `httptest.yaml`、进程 `chdir`。

这是破坏性变更：旧布局下写在 `.httptest/collections`、`.httptest/environments` 的文件不再被读取。使用者自行搬到工作目录对应可见目录。README 写明。

## 2. 约束

| 项 | 决定 |
|----|------|
| 布局 | 方案 1：工作目录管共享文件；`.httptest` 自我隔离，不改用户已有文件 |
| 首次启动 | 只创建 `.httptest/`（含 `local/`、`history/`、`.gitignore`） |
| CLI | 仅位置参数 `httptest [DIR]`，无 `--workdir` |
| 旧数据 | 不兼容、不提示、不搬迁 |
| YAML / executor | 请求与环境文件格式、变量替换、执行协议不变 |
| API 路由 | 不增不删路径；`GET /api/workspace` 的 `cwd` 改名为 `workdir` |
| gitignore | 只维护 `.httptest/.gitignore`，内容固定为 `*\n`；不创建或修改工作目录根的 `.gitignore` |

## 3. 工作区布局与组件边界

工作目录是一等公民：用户指定（或默认 cwd）的目录就是工作区根。`.httptest/` 是它下面的本机数据目录。

```
<workdir>/                          # 工作区根（顶栏、API 的 workdir）
  collections/**/*.yaml             # 可 git 共享；首次保存请求时创建
  environments/<name>.yaml          # 可 git 共享；首次保存环境时创建
  .httptest/
    .gitignore                      # 固定为 *\n
    local/                          # 0700；secrets.yaml、active.yaml
    history/                        # 按日 jsonl
```

请求身份仍是相对 `collections/` 的路径（如 `auth/login`）。环境名仍是 `environments/` 下不含后缀的文件名。YAML schema 不变。

`internal/workspace.Workspace` 持有两个绝对路径，去掉现有的 `Dir()`（避免「工作区」和「本机目录」混用）：

- `Workdir() string`：工作区根；`collections/`、`environments/` 挂在这
- `LocalDir() string`：`<workdir>/.httptest`；`local/`、`history/` 挂在这

`Init(workdir string) (*Workspace, error)`：

- `filepath.Abs` 解析 `workdir`；调用方保证该路径已存在且是目录。
- 创建 `LocalDir()/local`（0700）和 `LocalDir()/history`（0755）。
- 若 `LocalDir()/.gitignore` 不存在则写入 `*\n`；已存在则不覆盖。
- 不创建 `collections/`、`environments/`。
- 不读取、不搬迁 `.httptest/collections` 或 `.httptest/environments`。

路径约束随存储根走（`CleanRel` 规则不变）：

- 请求文件不得逃出 `<workdir>/collections/`
- 环境文件不得逃出 `<workdir>/environments/`
- 本机文件不得逃出 `<workdir>/.httptest/`

写路径：`PutRequest` / `PutEnvironment` 按需 `MkdirAll` 父目录。当前 `PutEnvironment` 不建父目录，必须补上。`AppendHistory` 已有 `MkdirAll`，保持。

读路径：`collections/` 或 `environments/` **不存在**时，`ListRequests` / `ListEnvironments` 返回空切片且 error 为 nil。`filepath.Walk` / `ReadDir` 在缺目录时会失败，实现必须把 `os.ErrNotExist` 收成空列表。路径存在但不是目录，或其它遍历/读失败，返回 error（API 层 500）。单份坏 YAML 仍跳过，不拖垮整个列表。

`internal/executor` 不依赖工作区路径，本次不改行为。

## 4. CLI

```
httptest [DIR] [--listen 127.0.0.1:1370] [--open]
```

`DIR` 是工作区根，最多一个。省略则用 `os.Getwd()`。相对路径相对**进程** cwd 做 `filepath.Abs`。不调用 `os.Chdir`。不在 Go 里展开 `~`。

标志可出现在 `DIR` 前后。以下均合法：

- `httptest ~/proj --open`
- `httptest --open ~/proj`
- `httptest --listen 127.0.0.1:1371 --open ./api`

解析：把 argv 拆成标志与位置参数，再交给现有 `flag.FlagSet`；不引入新 CLI 库。遇到单独的 `--` 则其后全部当位置参数。`--listen ADDR` 与 `--listen=ADDR` 都要能拆开。抽出可测函数（例如拆 argv + 解析 DIR），避免为测 CLI 去成功 `Listen`。

校验与退出码：

| 情况 | 退出码 |
|------|--------|
| 未知标志、非法 `--listen`、超过一个位置参数 | 2 |
| `DIR` 不存在或不是目录 | 2 |
| `getcwd` / `Init` / listen / serve 失败 | 1 |

不存在的 `DIR` 不自动创建。必须在调用 `Init` 之前由 CLI 做存在性/目录校验，不能把「路径不存在」交给 `Init` 再变成退出码 1。stdout 仍只在 `net.Listen` 成功后打印 URL，不打印工作区路径。

## 5. API 与界面

`GET /api/workspace`：

```json
{ "workdir": "/abs/path/to/proj", "requests": [] }
```

- `workdir` 为 `Workdir()`，必须是绝对路径，且等于 `Init` 传入目录的绝对形式。
- 不再使用 `filepath.Dir(ws.Dir())`，也不再输出 `cwd` 字段。
- `collections/` 不存在时 `requests` 为 `[]`。

其它路由不变：`/api/requests/*`、`/api/environments/*`、`/api/local`、`/api/history`、`/api/execute`。路径非法（`..`、绝对路径）仍 400。Host / Origin / JSON Content-Type 守卫不变。

前端：`types.ts`、`App.tsx`、`TopBar` 改读 `workdir`。顶栏仍在原位置展示该路径（截断与 `title` 提示不变）。CSS 类名可继续叫 `cwd`，不强制改。无新 UI 单测。

## 6. 错误处理

- `Init` 无法创建目录、无法 chmod `local/` 为 0700、无法写入 `.gitignore`：启动失败，stderr 带原因，退出码 1。工作目录路径存在但不是目录：CLI 在 `Init` 前拦截，退出码 2。
- 列表：缺目录 → 空列表。同名文件占住目录位或其它 IO 错 → API `{"error":"..."}` 且 500。
- 写入：`MkdirAll` 或落盘失败按现有 `writePathErr` 映射 4xx/5xx。路径非法仍 400。
- 历史追加失败不改变执行结果的对外语义：若当前实现会把追加失败顶成错误，保持原行为；本次不顺手改。
- 不自动修复损坏的 `.httptest`。不在 stderr 或 UI 提示「检测到旧 collections」。

## 7. 测试

Go：`go test ./...`。不新开 E2E。

**workspace**

- `Init` 后 `Workdir()` 为传入目录的绝对路径，`LocalDir()` 为 `<workdir>/.httptest`；存在 `local/`（0700）、`history/`、`.gitignore` 内容为 `*\n`。
- `Init` 不创建 `collections/`、`environments/`。
- `ListRequests` / `ListEnvironments` 在对应目录缺失时返回空切片、error 为 nil。
- `PutRequest` 把文件写到 `<workdir>/collections/...`；`PutEnvironment` 写到 `<workdir>/environments/...`，二者都创建父目录。
- `Init` 幂等；已有 `.gitignore` 不覆盖。
- 把 yaml 放进 `<workdir>/.httptest/collections/` 后，`ListRequests` 仍为空（破坏性变更回归锁）。
- `CleanRel` 用例保持。
- 调用方从 `ws.Dir()` 改为 `Workdir()` / `LocalDir()`：`request_test`、`env_test`、`history_test`、`execute_test`。

**CLI**（`cmd/httptest`）

- 省略 DIR 时解析成功，工作区根为空约定（调用方再用 `Getwd`）；不因缺少位置参数而退出 2。
- DIR 在标志前、在标志后、`--listen ADDR`、`--listen=ADDR` 均能解析。
- 多余位置参数、DIR 不存在或不是目录 → 退出码 2。
- 默认 `--listen` / `--open` 用例继续有效。

**server**

- `GET /api/workspace` 的 `workdir` 为绝对路径，等于 `Init` 传入目录。
- 现有 JSON 断言从 `cwd` 改为 `workdir`（`handlers_test`、`guard_test` 的 `TestWorkspaceCwdIsAbsolute` 可改名）。
- 集合为空时 `requests` 为 `[]`。
- Host/Origin 守卫只改字段名，不改策略。
- 历史路径断言改为 `LocalDir()/history`。

**前端**

- `npm test` 现有纯函数用例保持通过。

## 8. 文档

实现时更新 `README.md`：

- 数据不再「全部落在 `.httptest/`」。
- 命令行为 `httptest [DIR] [--listen ...] [--open]`，删除「没有 `--workspace`」这类过时表述。
- 工作区树改为 §3 布局；`.gitignore` 内容改为 `*\n`。
- 明确破坏性变更：旧 `.httptest/collections`、`.httptest/environments` 不再读取；自行搬到工作目录下同名可见目录。

不回头改写 `docs/superpowers/specs/2026-09-01-httptest-design.md` 假装 v1 一开始就是新布局。历史计划文件不改。

## 9. 实现顺序（供计划阶段拆任务）

1. `Workspace` 双路径、`Init` 新布局、列表缺目录、Put 路径与测试
2. 其余 workspace 测试与 `Dir()` 调用点
3. server JSON `workdir` 与测试
4. CLI 拆 argv / 校验 DIR 与测试
5. 前端 `workdir`
6. README
