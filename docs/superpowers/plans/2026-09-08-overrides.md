# 独立覆盖（overrides）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用可切换的多套本机「覆盖」取代单文件 `secrets.yaml`：与环境独立选择、活动栏对称管理、顶栏双选择器，合并顺序为环境模板 → 当前覆盖。

**Architecture:** `workspace` 将 `Local` 改为 `{environment, override}` 两个名字；覆盖文件落在 `.httptest/local/overrides/<name>.yaml`；CRUD 与环境同构。HTTP 增加 `/api/overrides*`，`/api/local` 去掉 `secrets`。前端活动栏第四项「覆盖」+ 顶栏覆盖选择器（含「无」）；去掉顶栏密钥编辑面板。

**Tech Stack:** Go 1.22；React + TypeScript + Vite + 手写 CSS；Vitest；无新 npm / Go 依赖。

## Global Constraints

- 规格：`docs/superpowers/specs/2026-09-08-overrides-design.md`。
- 产品文案用「覆盖」；路径与 API 用 `overrides` / `override`；不再用「密钥」/ `secrets`。
- 覆盖名 = `overrides/` 下不含 `.yaml` 的文件名，不能含 `/`，规则同 `envPath` / `CleanRel`。
- YAML：`name` + `variables` 字符串 map；文件权限 `0600`；`local/` 目录 `0700`。
- 环境与覆盖完全独立；当前覆盖可为空（「无」）。
- `override` 非空但文件缺失 → `ErrOverrideNotFound` → execute 返回 `invalid`（HTTP 200 + Result），不是 500。
- 破坏性：不读、不迁 `secrets.yaml`；README 写手迁。
- 不新增 npm 包；界面中文。
- 本次不做：值遮罩、复制、从环境导入、分组、按环境绑定、自动迁移、加密。
- 不回头改写历史规格或计划文件（可更新 README）。

## File Structure

| 路径 | 职责 |
|------|------|
| `internal/workspace/env.go` | `Local`、`activeFile`、`writeActive`、去掉 secrets；可保留环境 CRUD |
| `internal/workspace/override.go` | `Override`、路径、`Put/List/Delete/RenameOverride`、`ErrOverride*` |
| `internal/workspace/env_test.go` | 环境测例改为新 `Local`；ResolvedVars 用覆盖 |
| `internal/workspace/override_test.go` | 覆盖 CRUD / ResolvedVars / 缺失文件 |
| `internal/server/server.go` | 注册 `/api/overrides*` |
| `internal/server/handlers.go` | local JSON、覆盖 handlers、`writeOverrideErr` |
| `internal/server/handlers_test.go` | local + overrides HTTP |
| `internal/server/execute.go` | `ErrOverrideNotFound` → invalid Result |
| `internal/server/execute_test.go` | 缺失覆盖 invalid |
| `web/src/types.ts` | `LocalConfig`、`Override` |
| `web/src/api.ts` | overrides CRUD；local 无 secrets |
| `web/src/activity.ts` / `activity.test.ts` | `LeftView` 含 `"override"` |
| `web/src/override.ts` / `override.test.ts` | 名称校验与 API 错误文案（覆盖） |
| `web/src/EnvEditor.tsx` | 可选空态文案，供环境/覆盖共用 |
| `web/src/ActivityBar.tsx` / `Sidebar.tsx` / `App.tsx` | 第四项与覆盖面板 |
| `web/src/TopBar.tsx` | 覆盖选择器；删除密钥面板 |
| `web/src/secrets.ts` | 删除 |
| `web/src/request.test.ts` | 去掉 secretsJSON 测例（或改测 `varsJSON`） |
| `web/src/Dialog.tsx` | intent/subject 扩展 override |
| `web/src/styles.css` | 去掉或精简 `.secrets-panel` |
| `README.md` | 「环境与覆盖」+ 手迁 |

---

### Task 1: Local 改为双名 + Put/List 覆盖 + ResolvedVars

**Files:**
- Create: `internal/workspace/override.go`
- Create: `internal/workspace/override_test.go`
- Modify: `internal/workspace/env.go`
- Modify: `internal/workspace/env_test.go`（所有 `Secrets` / `secrets.yaml` 断言）

**Interfaces:**
- Produces:
  - `type Override struct { Name string; Variables map[string]string }`（json/yaml 标签同 Environment）
  - `type Local struct { Environment string; Override string }`
  - `var ErrOverrideNotFound = errors.New("override not found")`
  - `func (w *Workspace) PutOverride(o Override) error`
  - `func (w *Workspace) ListOverrides() ([]Override, error)`
  - `func (w *Workspace) writeActive(environment, override string) error`（包内；写完整 `active.yaml`）
  - `ResolvedVars`：空 override 跳过；非空且文件不存在 → `fmt.Errorf("%w: %q", ErrOverrideNotFound, name)`
- Consumes: 现有 `CleanRel`、`Init`、环境读写
- 副作用：`DeleteEnvironment` / `RenameEnvironment` 调用 `writeActive` 时必须 **保留** 当前 `local.Override`（先 `GetLocal`）

- [ ] **Step 1: 写失败测试（覆盖 + ResolvedVars）**

在 `override_test.go`：

```go
package workspace

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestResolvedVarsOverrideWins(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutEnvironment(Environment{
		Name:      "local",
		Variables: map[string]string{"baseUrl": "http://127.0.0.1:8080", "token": "public"},
	}); err != nil {
		t.Fatal(err)
	}
	if err := ws.PutOverride(Override{
		Name:      "default",
		Variables: map[string]string{"token": "secret", "password": "p"},
	}); err != nil {
		t.Fatal(err)
	}
	if err := ws.PutLocal(Local{Environment: "local", Override: "default"}); err != nil {
		t.Fatal(err)
	}
	vars, err := ws.ResolvedVars()
	if err != nil {
		t.Fatal(err)
	}
	if vars["baseUrl"] != "http://127.0.0.1:8080" || vars["token"] != "secret" || vars["password"] != "p" {
		t.Fatalf("%v", vars)
	}
	st, err := os.Stat(filepath.Join(ws.LocalDir(), "local", "overrides", "default.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if st.Mode().Perm() != 0o600 {
		t.Fatalf("mode=%o want 0600", st.Mode().Perm())
	}
}

func TestResolvedVarsEmptyOverride(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutEnvironment(Environment{
		Name:      "local",
		Variables: map[string]string{"k": "v"},
	}); err != nil {
		t.Fatal(err)
	}
	if err := ws.PutLocal(Local{Environment: "local", Override: ""}); err != nil {
		t.Fatal(err)
	}
	vars, err := ws.ResolvedVars()
	if err != nil {
		t.Fatal(err)
	}
	if vars["k"] != "v" || len(vars) != 1 {
		t.Fatalf("%v", vars)
	}
}

func TestResolvedVarsMissingOverrideFile(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutLocal(Local{Environment: "", Override: "gone"}); err != nil {
		t.Fatal(err)
	}
	_, err = ws.ResolvedVars()
	if !errors.Is(err, ErrOverrideNotFound) {
		t.Fatalf("got %v", err)
	}
}

func TestPutListOverride(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutOverride(Override{Name: "b", Variables: map[string]string{"x": "1"}}); err != nil {
		t.Fatal(err)
	}
	if err := ws.PutOverride(Override{Name: "a", Variables: map[string]string{}}); err != nil {
		t.Fatal(err)
	}
	list, err := ws.ListOverrides()
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 2 || list[0].Name != "a" || list[1].Name != "b" {
		t.Fatalf("%+v", list)
	}
}

func TestGetPutLocalOverrideField(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutLocal(Local{Environment: "local", Override: "default"}); err != nil {
		t.Fatal(err)
	}
	got, err := ws.GetLocal()
	if err != nil {
		t.Fatal(err)
	}
	if got.Environment != "local" || got.Override != "default" {
		t.Fatalf("%+v", got)
	}
	if _, err := os.Stat(filepath.Join(ws.LocalDir(), "local", "secrets.yaml")); !os.IsNotExist(err) {
		t.Fatalf("secrets.yaml should not be written: %v", err)
	}
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `go test ./internal/workspace -run 'TestResolvedVars|TestPutListOverride|TestGetPutLocal' -count=1`

Expected: FAIL（缺符号或旧 `Secrets` 字段）。

- [ ] **Step 3: 实现 `override.go` 与改造 `env.go`**

`override.go` 要点：

```go
package workspace

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

var (
	ErrOverrideExists   = errors.New("override exists")
	ErrSameOverrideName = errors.New("same override name")
	ErrOverrideNotFound = errors.New("override not found")
)

type Override struct {
	Name      string            `json:"name" yaml:"name"`
	Variables map[string]string `json:"variables" yaml:"variables"`
}

func (w *Workspace) overridePath(name string) (string, string, error) {
	cleaned, err := CleanRel(name)
	if err != nil {
		return "", "", err
	}
	if strings.Contains(cleaned, "/") {
		return "", "", fmt.Errorf("invalid override name %q", name)
	}
	return filepath.Join(w.localDir, "local", "overrides", cleaned+".yaml"), cleaned, nil
}

func (w *Workspace) PutOverride(o Override) error {
	path, cleaned, err := w.overridePath(o.Name)
	if err != nil {
		return err
	}
	o.Name = cleaned
	if o.Variables == nil {
		o.Variables = map[string]string{}
	}
	data, err := yaml.Marshal(&o)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	_ = os.Chmod(filepath.Dir(path), 0o700)
	if err := os.WriteFile(path, data, 0o600); err != nil {
		return err
	}
	return os.Chmod(path, 0o600)
}

func (w *Workspace) ListOverrides() ([]Override, error) {
	root := filepath.Join(w.localDir, "local", "overrides")
	exists, err := checkDir(root)
	if err != nil {
		return nil, err
	}
	if !exists {
		return []Override{}, nil
	}
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, err
	}
	var list []Override
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".yaml") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(root, e.Name()))
		if err != nil {
			continue
		}
		var o Override
		if err := yaml.Unmarshal(data, &o); err != nil {
			continue
		}
		if o.Variables == nil {
			o.Variables = map[string]string{}
		}
		o.Name = strings.TrimSuffix(e.Name(), ".yaml")
		list = append(list, o)
	}
	sort.Slice(list, func(i, j int) bool { return list[i].Name < list[j].Name })
	return list, nil
}
```

在 `env.go`：

1. `Local` 改为 `Environment string` + `Override string`（json 标签 `environment` / `override`）。
2. 删除 `secretsFile`；`activeFile` 增加 `Override string \`yaml:"override"\``。
3. `writeActive(environment, override string)` 写入两个字段。
4. `PutLocal`：只 `MkdirAll` + `writeActive(local.Environment, local.Override)`，**不写** `secrets.yaml`。
5. `GetLocal`：只读 `active.yaml`，填两个字段；缺文件则皆空。
6. `ResolvedVars`：模板层不变；若 `local.Override != ""`，用 `overridePath` 读文件；`os.IsNotExist` → `fmt.Errorf("%w: %q", ErrOverrideNotFound, cleaned)`；成功则同名覆盖 map。
7. `DeleteEnvironment`：清环境时 `writeActive("", local.Override)`（保留覆盖名）。
8. `RenameEnvironment`：更新环境名时 `writeActive(newClean, local.Override)`。

- [ ] **Step 4: 更新 `env_test.go` 中所有 `Secrets` 用法**

- 删除或改写 `TestResolvedVarsSecretsOverride`（逻辑已迁到 `TestResolvedVarsOverrideWins`）。
- 凡 `PutLocal(Local{..., Secrets: ...})` 改为只设 `Environment` / `Override`；若测例曾依赖 secrets 值参与合并，改为 `PutOverride` + `Override` 名。
- 断言「删环境不丢覆盖名」：用 `Override: "keep"`，删环境后 `got.Override == "keep"`（替换原 `Secrets["t"]` 断言）。
- 全文件不得再引用 `Secrets` 或 `secrets.yaml`。

- [ ] **Step 5: 跑 workspace 测试**

Run: `go test ./internal/workspace -count=1`

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add internal/workspace/env.go internal/workspace/env_test.go internal/workspace/override.go internal/workspace/override_test.go
git commit -m "$(cat <<'EOF'
feat: 本机状态改为环境+覆盖名，并支持 overrides 文件。

EOF
)"
```

---

### Task 2: DeleteOverride / RenameOverride

**Files:**
- Modify: `internal/workspace/override.go`
- Modify: `internal/workspace/override_test.go`

**Interfaces:**
- Produces:
  - `func (w *Workspace) DeleteOverride(name string) error` — 当前覆盖则 `writeActive(env, "")`；缺失 → `os.ErrNotExist`
  - `func (w *Workspace) RenameOverride(oldName, newName string) (Override, error)` — 冲突 `ErrOverrideExists`；同名 `ErrSameOverrideName`；当前覆盖则同步 `active.yaml`
- 文件顺序与 `DeleteEnvironment` / `RenameEnvironment` 相同（含 case-only `.renaming`、失败回滚）；改 `active` 时保留 `local.Environment`。

- [ ] **Step 1: 追加失败测试**

```go
func TestDeleteOverrideClearsActive(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutOverride(Override{Name: "default", Variables: map[string]string{"k": "v"}}); err != nil {
		t.Fatal(err)
	}
	if err := ws.PutLocal(Local{Environment: "local", Override: "default"}); err != nil {
		t.Fatal(err)
	}
	if err := ws.DeleteOverride("default"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(ws.LocalDir(), "local", "overrides", "default.yaml")); !os.IsNotExist(err) {
		t.Fatal("file remains")
	}
	got, err := ws.GetLocal()
	if err != nil {
		t.Fatal(err)
	}
	if got.Override != "" || got.Environment != "local" {
		t.Fatalf("%+v", got)
	}
}

func TestDeleteOverrideLeavesOtherActive(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutOverride(Override{Name: "a", Variables: map[string]string{}}); err != nil {
		t.Fatal(err)
	}
	if err := ws.PutOverride(Override{Name: "b", Variables: map[string]string{}}); err != nil {
		t.Fatal(err)
	}
	if err := ws.PutLocal(Local{Override: "a"}); err != nil {
		t.Fatal(err)
	}
	if err := ws.DeleteOverride("b"); err != nil {
		t.Fatal(err)
	}
	got, err := ws.GetLocal()
	if err != nil {
		t.Fatal(err)
	}
	if got.Override != "a" {
		t.Fatalf("%+v", got)
	}
}

func TestRenameOverrideUpdatesActive(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutOverride(Override{Name: "old", Variables: map[string]string{"t": "1"}}); err != nil {
		t.Fatal(err)
	}
	if err := ws.PutLocal(Local{Environment: "local", Override: "old"}); err != nil {
		t.Fatal(err)
	}
	got, err := ws.RenameOverride("old", "new")
	if err != nil {
		t.Fatal(err)
	}
	if got.Name != "new" || got.Variables["t"] != "1" {
		t.Fatalf("%+v", got)
	}
	local, err := ws.GetLocal()
	if err != nil {
		t.Fatal(err)
	}
	if local.Override != "new" || local.Environment != "local" {
		t.Fatalf("%+v", local)
	}
}

func TestRenameOverrideConflict(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutOverride(Override{Name: "a", Variables: map[string]string{}}); err != nil {
		t.Fatal(err)
	}
	if err := ws.PutOverride(Override{Name: "b", Variables: map[string]string{}}); err != nil {
		t.Fatal(err)
	}
	_, err = ws.RenameOverride("a", "b")
	if !errors.Is(err, ErrOverrideExists) {
		t.Fatalf("got %v", err)
	}
}

func TestRenameOverrideSameName(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutOverride(Override{Name: "a", Variables: map[string]string{}}); err != nil {
		t.Fatal(err)
	}
	_, err = ws.RenameOverride("a", "a")
	if !errors.Is(err, ErrSameOverrideName) {
		t.Fatalf("got %v", err)
	}
}
```

- [ ] **Step 2: 跑测确认失败**

Run: `go test ./internal/workspace -run 'TestDeleteOverride|TestRenameOverride' -count=1`

Expected: FAIL（未定义方法）。

- [ ] **Step 3: 实现 Delete/Rename**

按 `DeleteEnvironment` / `RenameEnvironment` 复制逻辑到 `override.go`：路径用 `overridePath`；YAML 类型用 `Override`；更新 active 时调用 `writeActive(local.Environment, ""|newClean)`；哨兵用 `ErrOverrideExists` / `ErrSameOverrideName`。若环境侧有 `rewriteEnvNameYAML`，覆盖侧可用同等「改 YAML 内 name 字段」助手，或 `yaml.Marshal` 整对象（与 Put 一致即可，测试不依赖注释保留）。

- [ ] **Step 4: 再跑**

Run: `go test ./internal/workspace -count=1`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add internal/workspace/override.go internal/workspace/override_test.go
git commit -m "$(cat <<'EOF'
feat: 覆盖删改名并同步 active.yaml。

EOF
)"
```

---

### Task 3: HTTP `/api/overrides*` 与新 `/api/local`

**Files:**
- Modify: `internal/server/server.go`
- Modify: `internal/server/handlers.go`
- Modify: `internal/server/handlers_test.go`

**Interfaces:**
- Produces: 与规格 §3.2 一致的四个 overrides 路由；`localJSON` 为 `{environment, override}`；`writeOverrideErr` 映射 409/400/path
- `isInvalidPath`（或等价）须识别 `invalid override name`

- [ ] **Step 1: 改写 / 追加 handlers 测试**

把现有 `PUT /api/local` body 从 `{"environment":"local","secrets":{"t":"1"}}` 改为 `{"environment":"local","override":"default"}`；若测例依赖 secrets 值，先 `PUT /api/overrides/default`。

追加：

```go
func TestOverrideCRUDAndLocal(t *testing.T) {
	h := newTestHandler(t)
	putBody := []byte(`{"name":"default","variables":{"token":"s"}}`)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/overrides/default", putBody))
	if rr.Code != http.StatusOK {
		t.Fatalf("put %d %s", rr.Code, rr.Body.Bytes())
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/local", []byte(`{"environment":"","override":"default"}`)))
	if rr.Code != http.StatusOK {
		t.Fatalf("local %d", rr.Code)
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodGet, "/api/overrides", nil))
	if rr.Code != http.StatusOK {
		t.Fatal(rr.Code)
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/overrides/default/rename", []byte(`{"name":"prod"}`)))
	if rr.Code != http.StatusOK {
		t.Fatalf("rename %d %s", rr.Code, rr.Body.Bytes())
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodGet, "/api/local", nil))
	var loc struct {
		Environment string `json:"environment"`
		Override    string `json:"override"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &loc); err != nil {
		t.Fatal(err)
	}
	if loc.Override != "prod" {
		t.Fatalf("%+v", loc)
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodDelete, "/api/overrides/prod", nil))
	if rr.Code != http.StatusNoContent {
		t.Fatal(rr.Code)
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodGet, "/api/local", nil))
	if err := json.Unmarshal(rr.Body.Bytes(), &loc); err != nil {
		t.Fatal(err)
	}
	if loc.Override != "" {
		t.Fatalf("%+v", loc)
	}
}

func TestOverrideRenameConflict(t *testing.T) {
	h := newTestHandler(t)
	for _, name := range []string{"a", "b"} {
		body := []byte(`{"name":"` + name + `","variables":{}}`)
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/overrides/"+name, body))
		if rr.Code != http.StatusOK {
			t.Fatal(rr.Code)
		}
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/overrides/a/rename", []byte(`{"name":"b"}`)))
	if rr.Code != http.StatusConflict {
		t.Fatalf("got %d", rr.Code)
	}
}
```

（`newTestHandler` / `apiReq` 用文件中已有助手；若名称不同则跟现有测试一致。）

- [ ] **Step 2: 跑测确认失败**

Run: `go test ./internal/server -run 'TestOverride|TestLocal|TestEnv' -count=1`

Expected: 编译失败或断言失败（仍要 secrets / 无路由）。

- [ ] **Step 3: 实现 handlers**

`server.go` 注册：

```go
mux.HandleFunc("GET /api/overrides", s.handleListOverrides)
mux.HandleFunc("PUT /api/overrides/{name}", s.handlePutOverride)
mux.HandleFunc("DELETE /api/overrides/{name}", s.handleDeleteOverride)
mux.HandleFunc("POST /api/overrides/{name}/rename", s.handleRenameOverride)
```

`handlers.go`：`localJSON` 改为 `Environment` + `Override`；get/put 映射 `workspace.Local`。覆盖 handlers 镜像环境 handlers（`PutOverride`、`ListOverrides`、`DeleteOverride`、`RenameOverride`）。`writeOverrideErr`：

```go
func writeOverrideErr(w http.ResponseWriter, err error) {
	if errors.Is(err, workspace.ErrOverrideExists) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
		return
	}
	if errors.Is(err, workspace.ErrSameOverrideName) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writePathErr(w, err)
}
```

`isInvalidPath` 增加对 `invalid override name` 的识别。

- [ ] **Step 4: 再跑 server 测试**

Run: `go test ./internal/server -count=1`

Expected: PASS（execute 测例若仍用旧 local JSON，本任务一并改掉）。

- [ ] **Step 5: Commit**

```bash
git add internal/server/server.go internal/server/handlers.go internal/server/handlers_test.go
git commit -m "$(cat <<'EOF'
feat: 暴露 overrides API，并精简 /api/local。

EOF
)"
```

---

### Task 4: execute 将缺失覆盖判为 invalid

**Files:**
- Modify: `internal/server/execute.go`
- Modify: `internal/server/execute_test.go`（若无则创建；或扩现有）

**Interfaces:**
- Consumes: `workspace.ErrOverrideNotFound`、`executor.Result` / `ClassInvalid`
- Produces: `ResolvedVars` 返回该错误时 HTTP **200**，body 为 `Result{ErrorClass: invalid, ErrorMessage: err.Error(), Prepared: body.Request}`；其它 ResolvedVars 错误仍 500

- [ ] **Step 1: 写失败测试**

```go
func TestExecuteMissingOverrideInvalid(t *testing.T) {
	h := newTestHandler(t)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/local", []byte(`{"environment":"","override":"missing"}`)))
	if rr.Code != http.StatusOK {
		t.Fatal(rr.Code)
	}
	body := []byte(`{"id":"1","request":{"name":"R","method":"GET","url":"http://127.0.0.1/","query":{},"headers":{},"body":{"type":"none"}}}`)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/execute", body))
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d %s", rr.Code, rr.Body.Bytes())
	}
	var res struct {
		ErrorClass   string `json:"errorClass"`
		ErrorMessage string `json:"errorMessage"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if res.ErrorClass != "invalid" || !strings.Contains(res.ErrorMessage, "missing") {
		t.Fatalf("%+v", res)
	}
}
```

- [ ] **Step 2: 跑测确认失败**

Run: `go test ./internal/server -run TestExecuteMissingOverrideInvalid -count=1`

Expected: FAIL（现为 500 或非 invalid）。

- [ ] **Step 3: 改 `handleExecute`**

在 `vars, err := s.ws.ResolvedVars()` 之后：

```go
if err != nil {
	if errors.Is(err, workspace.ErrOverrideNotFound) {
		writeJSON(w, http.StatusOK, executor.Result{
			ErrorClass:   executor.ClassInvalid,
			ErrorMessage: err.Error(),
			Prepared:     body.Request,
		})
		return
	}
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
	return
}
```

补 `errors` import。

- [ ] **Step 4: 再跑**

Run: `go test ./internal/server -count=1`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add internal/server/execute.go internal/server/execute_test.go
git commit -m "$(cat <<'EOF'
fix: 当前覆盖文件缺失时 execute 返回 invalid。

EOF
)"
```

---

### Task 5: 前端类型、API、活动栏、override 文案助手

**Files:**
- Modify: `web/src/types.ts`
- Modify: `web/src/api.ts`
- Modify: `web/src/activity.ts`
- Modify: `web/src/activity.test.ts`
- Create: `web/src/override.ts`
- Create: `web/src/override.test.ts`
- Delete: `web/src/secrets.ts`（本任务可先留着，Task 7 删；若删则同步 `request.test.ts`）

**Interfaces:**
- `LocalConfig = { environment: string; override: string }`
- `export interface Override { name: string; variables: Record<string, string> }`（可与 Environment 同形）
- `getOverrides` / `putOverride` / `deleteOverride` / `renameOverride` 镜像 environments
- `LeftView` 增加 `"override"`
- `overrideNameError` / `overrideAPIError`：文案用「覆盖」；非法规则复用 `cleanEnvName`（从 `env.ts` import）

- [ ] **Step 1: 写 activity + override 失败测例**

`activity.test.ts` 增加：从 collection 点 override 打开；再点收起。

`override.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { overrideAPIError, overrideNameError } from "./override";

describe("overrideNameError", () => {
  it("rejects empty, slash, and duplicates", () => {
    expect(overrideNameError("", [])).not.toBeNull();
    expect(overrideNameError("a/b", [])).not.toBeNull();
    expect(overrideNameError("default", ["default"])).toBe("已有同名覆盖");
    expect(overrideNameError("default", [])).toBeNull();
  });
});

describe("overrideAPIError", () => {
  it("maps sentinels", () => {
    expect(overrideAPIError("same override name")).toBe("不能改成当前名称");
    expect(overrideAPIError("override exists")).toBe("已有同名覆盖");
    expect(overrideAPIError("404: Not Found")).toBe("覆盖不存在");
  });
});
```

- [ ] **Step 2: 跑 vitest 确认失败**

Run: `cd web && npm test -- --run src/activity.test.ts src/override.test.ts`

Expected: FAIL。

- [ ] **Step 3: 实现类型、api、activity、override.ts**

`override.ts` 示例：

```ts
import { cleanEnvName } from "./env";

export function overrideNameError(name: string, existing: string[]): string | null {
  const cleaned = cleanEnvName(name);
  if (cleaned === null) return name.trim() ? "名称非法" : "名称不能为空";
  if (cleaned.includes("/")) return "名称不能含 /";
  if (existing.includes(cleaned)) return "已有同名覆盖";
  return null;
}

export function overrideAPIError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("same override name")) return "不能改成当前名称";
  if (lower.includes("override exists")) return "已有同名覆盖";
  if (
    lower.includes("no such file") ||
    lower.includes("not found") ||
    /\b404\b/.test(lower)
  ) {
    return "覆盖不存在";
  }
  return message;
}
```

`api.ts` 增加 overrides 四个函数；`LocalConfig` 用途自动随 types 更新。

- [ ] **Step 4: 再跑**

Run: `cd web && npm test -- --run`

Expected: 本任务相关 PASS；若 App/TopBar 仍引用 `secrets`，可能 typecheck 失败——允许延后到 Task 6/7，但优先把 `types` 改动导致的编译错误在后续任务立刻修。若 `npm test` 因 TS 编不过，先把 `LocalConfig` 的调用点改成 `override: ""` 占位，去掉 `secrets` 字段读取。

- [ ] **Step 5: Commit**

```bash
git add web/src/types.ts web/src/api.ts web/src/activity.ts web/src/activity.test.ts web/src/override.ts web/src/override.test.ts
git commit -m "$(cat <<'EOF'
feat: 前端覆盖类型、API 与活动栏视图。

EOF
)"
```

---

### Task 6: 覆盖面板（活动栏 + 侧栏 + 编辑 + App CRUD）

**Files:**
- Modify: `web/src/ActivityBar.tsx`
- Modify: `web/src/Sidebar.tsx`
- Modify: `web/src/EnvEditor.tsx`（增加可选 `emptyTitle`，默认保持原环境文案）
- Modify: `web/src/Dialog.tsx`（intent: `create-override` | `rename-override`；confirm `subject?: "override"`）
- Modify: `web/src/App.tsx`
- Modify: `web/src/styles.css`（若需「发送」标记复用环境样式即可）

**Interfaces:**
- 树选中覆盖 ≠ 顶栏 `local.override`
- 覆盖视图：`Ctrl+S` 保存覆盖；`Ctrl+Enter` 不发送
- 删/改当前发送覆盖须确认；成功后 `setLocal` 与列表刷新

- [ ] **Step 1: ActivityBar 第四按钮**

文案 `覆盖`；`aria-pressed` / `active` 逻辑同环境；`onClickIcon("override")`。

- [ ] **Step 2: Sidebar 覆盖列表**

`view === "override"` 时列 `overrides` 名；`activeOverride={local?.override}` 显示发送标记（复用环境列表的 active 样式）；新建按钮打开 create-override 对话框。

- [ ] **Step 3: EnvEditor 空态**

```tsx
emptyTitle?: string;
// 默认：「在左侧选择一个环境，或新建」
// 覆盖传入：「在左侧选择一套覆盖，或新建」
```

- [ ] **Step 4: App 接线**

镜像环境状态机：`overrides` 列表、`editingOverride`、pairs、dirty、save/rename/delete handlers；load 时 `getOverrides()`；`onOverrideChange` 仅 `putLocal({...local, override})`。对话框分支处理 override intents；错误用 `overrideAPIError`。

快捷键：`left.view === "override"` 时 Save 走覆盖保存；Send 直接 return。

- [ ] **Step 5: 手工 / 构建检查**

Run: `cd web && npm test -- --run && npm run build`

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add web/src/ActivityBar.tsx web/src/Sidebar.tsx web/src/EnvEditor.tsx web/src/Dialog.tsx web/src/App.tsx web/src/styles.css
git commit -m "$(cat <<'EOF'
feat: 活动栏覆盖面板与 CRUD。

EOF
)"
```

---

### Task 7: 顶栏覆盖选择器；移除密钥面板

**Files:**
- Modify: `web/src/TopBar.tsx`
- Modify: `web/src/App.tsx`（去掉 `onSecretsChange`）
- Delete: `web/src/secrets.ts`
- Modify: `web/src/request.test.ts`（删除 secretsJSON describe，或改为测 `varsJSON`）
- Modify: `web/src/styles.css`（删除 `.secrets-panel` 及相关）

**Interfaces:**
- TopBar props：`overrides: Override[]`（或 `string[]` 名列表）、`onOverrideChange: (override: string) => void`；无 secrets 回调
- `<select>`：首项 value `""` 文案「无」；其余各套 name；`value={local?.override ?? ""}`

- [ ] **Step 1: 改 TopBar**

删除 pairs / secrets 面板 / 「密钥」按钮；在环境 `<select>` 旁加覆盖 `<select>`，label「覆盖」。

- [ ] **Step 2: App 传参**

`onOverrideChange`；传入 `overrides` 列表；删除 `onSecretsChange`。

- [ ] **Step 3: 删 secrets.ts 并修测试**

`request.test.ts` 若只测 secretsJSON，改为：

```ts
import { varsJSON } from "./env";
describe("varsJSON", () => {
  it("orders keys", () => {
    expect(varsJSON({ z: "1", a: "2" })).toBe(varsJSON({ a: "2", z: "1" }));
  });
});
```

- [ ] **Step 4: 验证**

Run: `cd web && npm test -- --run && npm run build`

Expected: PASS。全文搜索 `secrets` / `密钥`（`web/src`）应无用户可见残留（代码标识符亦应清除）。

- [ ] **Step 5: Commit**

```bash
git add web/src/TopBar.tsx web/src/App.tsx web/src/request.test.ts web/src/styles.css
git rm web/src/secrets.ts
git commit -m "$(cat <<'EOF'
feat: 顶栏覆盖选择器，移除密钥面板。

EOF
)"
```

---

### Task 8: README 与全量回归

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 更新 README**

- 「能做什么 / 界面 / 工作区」：密钥 → 覆盖；目录树改为 `local/overrides/`。
- 「环境与密钥」改标题为「环境与覆盖」：说明多套、顶栏可「无」、合并顺序、手迁步骤（拷 `secrets.yaml` 的 variables → `overrides/<name>.yaml`，设 `active.yaml` 的 `override`，可删旧文件）。
- 破坏性说明与 workdir 搬迁口吻一致。

- [ ] **Step 2: 全量测试**

Run: `go test ./...`  
Run: `cd web && npm test -- --run && npm run build`

Expected: 全部 PASS。

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: README 改为环境与覆盖，并说明手迁。

EOF
)"
```

---

## Self-Review (plan vs spec)

| 规格要求 | 任务 |
|---------|------|
| `overrides/<name>.yaml` + active 双字段 | Task 1 |
| Put/List + ResolvedVars + ErrOverrideNotFound | Task 1 |
| Delete/Rename + 同步 active | Task 2 |
| `/api/overrides*` + `/api/local` 无 secrets | Task 3 |
| 缺失覆盖 → invalid 不发送 | Task 4 |
| 活动栏第四项 + 编辑与顶栏独立 | Task 5–6 |
| 顶栏覆盖选择器含「无」；去掉密钥面板 | Task 7 |
| 破坏性手迁 + README | Task 8 |
| 不自动迁 secrets.yaml | 全局约束 / Task 1 不读旧文件 |
| 值遮罩等非目标 | 未列入任务 |
