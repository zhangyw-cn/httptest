# Hosts 解析 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持多套可 git 共享的 `hosts/<name>.yaml`：顶栏选用后由 executor `DialContext` 把精确匹配的 hostname 拨到固定 IP，Host/SNI 仍用原域名；活动栏独立编辑，与环境/覆盖互不影响。

**Architecture:** 与环境平行：`workspace` 管 `hosts/*.yaml` 与 `active.hosts`；`server` 增 `/api/hosts*` 并在 `POST /api/execute` 服务端加载 mappings；`executor` 的 `newExecuteTransport(mappings)` 定制 Dial；前端活动栏「Hosts」+ 顶栏选择器（含「无」）。不引入新顶层包、不新增 npm 依赖。

**Tech Stack:** Go 1.22；React + TypeScript + Vite + 手写 CSS；Vitest；`gopkg.in/yaml.v3`（已有）。

## Global Constraints

- 规格：`docs/superpowers/specs/2026-09-12-hosts-resolution-design.md`。
- 路径：`<workdir>/hosts/<name>.yaml`（可提交）；`active.hosts` 在 `.httptest/local/active.yaml`（不进 git）。
- 名称规则同 `envPath` / `CleanRel`：不能含 `/`；非法路径 → 400。
- 匹配：仅精确 hostname；读写与查找均小写；禁止 `://`、`/`、`:`；值须为 IPv4/IPv6 字面量；重复键（大小写不敏感）拒绝。
- 拨号：命中则 `dial(ip:port)`；不改 `req.URL.Host` / `req.Host`；TLS SNI/证书名仍用原域名。
- `active.hosts` 空或缺省 =「无」；指向缺失文件时 execute **降级为无**，不 5xx、不挡发送。
- 删当前选用 → 清空 `active.hosts`；改名当前选用 → 写成新名。
- 出站 `Proxy = nil` 不变；界面中文；不新增 npm 包。
- 本次不做：通配符、按环境绑定、读写系统 `/etc/hosts`、代理联动、通用命名配置重构。
- 不回头改写历史规格或计划文件（可更新 README）。

## File Structure

| 路径 | 职责 |
|------|------|
| `internal/workspace/env.go` | `Local`/`activeFile`/`writeActive` 增加 `Hosts`；env 删改名保留 hosts |
| `internal/workspace/override.go` | override 删改名调用 `writeActive` 时保留 `Hosts` |
| `internal/workspace/hosts.go` | `HostsFile`、路径、校验、CRUD、`ActiveHostsMappings` |
| `internal/workspace/hosts_test.go` | hosts CRUD / 校验 / active 联动 / 缺失降级 |
| `internal/workspace/env_test.go` / `override_test.go` | 写 `writeActive`/`PutLocal` 的测例兼容 `Hosts` |
| `internal/executor/result.go` | `ResolvedIP string \`json:"resolvedIP,omitempty"\`` |
| `internal/executor/dial.go` | `mapDialAddress` |
| `internal/executor/execute.go` | `Execute(..., hosts)`；`newExecuteTransport(mappings)` |
| `internal/executor/dial_test.go` / `execute_test.go` / `diag_test.go` | Dial 与 Host 头 / 重定向 / 全部 `Execute` 加 hosts 参数 |
| `internal/server/server.go` | 注册 `/api/hosts*` |
| `internal/server/handlers.go` | hosts handlers、`localJSON.Hosts`、`writeHostsErr`、`isInvalidPath` |
| `internal/server/execute.go` | 加载 `ActiveHostsMappings` 再 `Execute` |
| `internal/server/handlers_test.go` / `execute_test.go` | CRUD + rename；execute 用 active；缺失降级 |
| `web/src/types.ts` | `HostsFile`、`LocalConfig.hosts`、`Result.resolvedIP?` |
| `web/src/api.ts` | hosts CRUD；local 含 hosts |
| `web/src/hosts.ts` / `hosts.test.ts` | 名称与 mappings 校验、API 文案、行状态、Dialog 工厂 |
| `web/src/Dialog.tsx` | intent/subject 扩展 hosts |
| `web/src/activity.ts` / `activity.test.ts` | `LeftView` 含 `"hosts"` |
| `web/src/work-layout.ts` / `work-layout.test.ts` | `WorkMode` 含 `"hosts"` |
| `web/src/shortcut.ts` / `shortcut.test.ts` | `shouldSaveOnCtrlS("hosts")`；`shouldSendOnEnter("hosts")===false` |
| `web/src/ActivityBar.tsx` | Hosts 图标与文案 |
| `web/src/TopBar.tsx` / `TopBar.test.tsx` | Hosts 选择器（无 + 缺失提示） |
| `web/src/Sidebar.tsx` | hosts 树 |
| `web/src/EnvEditor.tsx` | 可选列标题（主机名 / IP） |
| `web/src/App.tsx` | Hosts 面板状态、保存、对话框、快捷键 |
| `web/src/ResultPane.tsx` / `result-pane-ui.test.tsx` | Overview 展示 `resolvedIP` |
| `web/src/hosts-panel.test.tsx` | 活动栏 Hosts 文案与行状态 |
| `README.md` | 工作区 `hosts/`、界面顶栏/活动栏 Hosts |

---

### Task 1: Local 增加 Hosts + writeActive 三字段

**Files:**
- Modify: `internal/workspace/env.go`
- Modify: `internal/workspace/override.go`
- Modify: `internal/workspace/env_test.go`
- Modify: `internal/workspace/override_test.go`

**Interfaces:**
- Produces:
  - `type Local struct { Environment string; Override string; Hosts string }`（json：`environment`/`override`/`hosts`）
  - `type activeFile struct { Environment, Override, Hosts string }`（yaml 同名字段）
  - `func (w *Workspace) writeActive(environment, override, hosts string) error`
  - `PutLocal` / `GetLocal` 读写三个字段；非空 `Hosts` 本任务用 `CleanRel` + 禁 `/`（错误文案 `invalid hosts name %q`）；Task 2 改为 `hostsPath`
- Consumes: 现有 `GetLocal`、`MkdirAll` local 目录
- 副作用：所有 `writeActive(...)` 调用点必须读写三字段；删/改环境或覆盖时 **保留** `local.Hosts`

- [ ] **Step 1: 写失败测试**

在 `env_test.go` 追加：

```go
func TestGetPutLocalHostsField(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutLocal(Local{Environment: "local", Override: "dev", Hosts: "lan"}); err != nil {
		t.Fatal(err)
	}
	got, err := ws.GetLocal()
	if err != nil {
		t.Fatal(err)
	}
	if got.Environment != "local" || got.Override != "dev" || got.Hosts != "lan" {
		t.Fatalf("%+v", got)
	}
}

func TestDeleteEnvironmentPreservesHosts(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutEnvironment(Environment{Name: "local", Variables: map[string]string{}}); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutLocal(Local{Environment: "local", Override: "keep", Hosts: "lan"}); err != nil {
		t.Fatal(err)
	}
	if err := ws.DeleteEnvironment("local"); err != nil {
		t.Fatal(err)
	}
	got, err := ws.GetLocal()
	if err != nil {
		t.Fatal(err)
	}
	if got.Environment != "" || got.Override != "keep" || got.Hosts != "lan" {
		t.Fatalf("%+v", got)
	}
}
```

在 `override_test.go` 追加：

```go
func TestDeleteOverridePreservesHosts(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutOverride(Override{Name: "dev", Variables: map[string]string{}}); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutLocal(Local{Environment: "local", Override: "dev", Hosts: "lan"}); err != nil {
		t.Fatal(err)
	}
	if err := ws.DeleteOverride("dev"); err != nil {
		t.Fatal(err)
	}
	got, err := ws.GetLocal()
	if err != nil {
		t.Fatal(err)
	}
	if got.Override != "" || got.Hosts != "lan" || got.Environment != "local" {
		t.Fatalf("%+v", got)
	}
}
```

现有 `PutLocal(Local{...})` 字面量可省略 `Hosts`（零值 `""`）；若有完整结构体字面量断言则补字段。

- [ ] **Step 2: 跑测确认失败**

Run: `go test ./internal/workspace -run 'TestGetPutLocalHostsField|TestDeleteEnvironmentPreservesHosts|TestDeleteOverridePreservesHosts' -count=1`

Expected: 编译失败（`Local` 无 `Hosts`）或断言失败。

- [ ] **Step 3: 最小实现**

1. `Local` / `activeFile` 增加 `Hosts string`（yaml:`hosts`，json:`hosts`）。
2. `writeActive(environment, override, hosts string)` 写三个字段。
3. `PutLocal`：保留非空 Override 的 `overridePath` 校验；非空 Hosts 时：

```go
if local.Hosts != "" {
	cleaned, err := CleanRel(local.Hosts)
	if err != nil {
		return Local{}, err
	}
	if strings.Contains(cleaned, "/") {
		return Local{}, fmt.Errorf("invalid hosts name %q", local.Hosts)
	}
	local.Hosts = cleaned
}
```

并调用 `writeActive(local.Environment, local.Override, local.Hosts)`。

4. `GetLocal`：读出 `Hosts`；YAML 缺字段视为 `""`。
5. `DeleteEnvironment` → `writeActive("", local.Override, local.Hosts)`；`RenameEnvironment` → `writeActive(newClean, local.Override, local.Hosts)`。
6. `DeleteOverride` → `writeActive(local.Environment, "", local.Hosts)`；`RenameOverride` → `writeActive(local.Environment, newClean, local.Hosts)`。

- [ ] **Step 4: 跑测确认通过**

Run: `go test ./internal/workspace -count=1`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add internal/workspace/env.go internal/workspace/override.go internal/workspace/env_test.go internal/workspace/override_test.go
git commit -m "$(cat <<'EOF'
feat: active.yaml 增加 hosts 字段并保留联动。

EOF
)"
```

---

### Task 2: Hosts Put/List + mappings 校验 + ActiveHostsMappings

**Files:**
- Create: `internal/workspace/hosts.go`
- Create: `internal/workspace/hosts_test.go`
- Modify: `internal/workspace/env.go`（`PutLocal` 非空 Hosts 改调 `hostsPath`）

**Interfaces:**
- Produces:
  - `type HostsFile struct { Name string \`json:"name" yaml:"name"\`; Mappings map[string]string \`json:"mappings" yaml:"mappings"\` }`
  - `var ErrInvalidHostsMapping = errors.New("invalid hosts mapping")`
  - `var ErrHostsExists = errors.New("hosts exists")`（Task 3 用；本任务可先声明）
  - `var ErrSameHostsName = errors.New("same hosts name")`（同上）
  - `func (w *Workspace) hostsPath(name string) (path, cleaned string, err error)` — 根 `filepath.Join(w.workdir, "hosts")`
  - `func normalizeAndValidateMappings(in map[string]string) (map[string]string, error)`
  - `func (w *Workspace) PutHosts(h HostsFile) (HostsFile, error)` — 目录 `0755`，文件 `0644`
  - `func (w *Workspace) ListHosts() ([]HostsFile, error)`
  - `func (w *Workspace) ActiveHostsMappings() (map[string]string, error)` — `Hosts==""` → `nil,nil`；文件缺失 → `nil,nil`；非法名 → `nil,nil`；其它 IO/YAML/校验错误上抛
- Consumes: `CleanRel`、`checkDir`、`GetLocal`

- [ ] **Step 1: 写失败测试**

```go
package workspace

import (
	"os"
	"path/filepath"
	"testing"
)

func TestPutListHostsNormalizesKeys(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	saved, err := ws.PutHosts(HostsFile{
		Name: "lan",
		Mappings: map[string]string{
			"API.Example.COM": "10.0.0.5",
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if saved.Mappings["api.example.com"] != "10.0.0.5" {
		t.Fatalf("%v", saved.Mappings)
	}
	if _, ok := saved.Mappings["API.Example.COM"]; ok {
		t.Fatal("raw key should be normalized away")
	}
	list, err := ws.ListHosts()
	if err != nil || len(list) != 1 || list[0].Name != "lan" {
		t.Fatalf("%v %v", list, err)
	}
	st, err := os.Stat(filepath.Join(ws.Workdir(), "hosts", "lan.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if st.Mode().Perm() != 0o644 {
		t.Fatalf("mode=%o", st.Mode().Perm())
	}
}

func TestPutHostsRejectsBadMapping(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	cases := []map[string]string{
		{"http://x": "1.1.1.1"},
		{"a/b": "1.1.1.1"},
		{"a:80": "1.1.1.1"},
		{"ok": "not-an-ip"},
		{"": "1.1.1.1"},
		{"ok": ""},
	}
	for _, m := range cases {
		if _, err := ws.PutHosts(HostsFile{Name: "lan", Mappings: m}); err == nil {
			t.Fatalf("expected error for %v", m)
		}
	}
}

func TestNormalizeDuplicateHost(t *testing.T) {
	_, err := normalizeAndValidateMappings(map[string]string{
		"Foo.COM": "1.1.1.1",
		"foo.com": "2.2.2.2",
	})
	if err == nil {
		t.Fatal("expected duplicate")
	}
}

func TestActiveHostsMappings(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutHosts(HostsFile{Name: "lan", Mappings: map[string]string{"api.test": "127.0.0.1"}}); err != nil {
		t.Fatal(err)
	}
	m, err := ws.ActiveHostsMappings()
	if err != nil || m != nil {
		t.Fatalf("empty active: %v %v", m, err)
	}
	if _, err := ws.PutLocal(Local{Hosts: "lan"}); err != nil {
		t.Fatal(err)
	}
	m, err = ws.ActiveHostsMappings()
	if err != nil || m["api.test"] != "127.0.0.1" {
		t.Fatalf("%v %v", m, err)
	}
	if _, err := ws.PutLocal(Local{Hosts: "gone"}); err != nil {
		t.Fatal(err)
	}
	m, err = ws.ActiveHostsMappings()
	if err != nil || m != nil {
		t.Fatalf("missing file should degrade: %v %v", m, err)
	}
}
```

- [ ] **Step 2: 跑测确认失败**

Run: `go test ./internal/workspace -run 'TestPutListHosts|TestPutHostsRejects|TestNormalizeDuplicateHost|TestActiveHostsMappings' -count=1`

Expected: 编译失败（符号不存在）。

- [ ] **Step 3: 实现 `hosts.go`**

```go
package workspace

import (
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

var (
	ErrHostsExists         = errors.New("hosts exists")
	ErrSameHostsName       = errors.New("same hosts name")
	ErrInvalidHostsMapping = errors.New("invalid hosts mapping")
)

type HostsFile struct {
	Name     string            `json:"name" yaml:"name"`
	Mappings map[string]string `json:"mappings" yaml:"mappings"`
}

func (w *Workspace) hostsPath(name string) (string, string, error) {
	cleaned, err := CleanRel(name)
	if err != nil {
		return "", "", err
	}
	if strings.Contains(cleaned, "/") {
		return "", "", fmt.Errorf("invalid hosts name %q", name)
	}
	return filepath.Join(w.workdir, "hosts", cleaned+".yaml"), cleaned, nil
}

func normalizeAndValidateMappings(in map[string]string) (map[string]string, error) {
	out := map[string]string{}
	if in == nil {
		return out, nil
	}
	for host, ip := range in {
		h := strings.ToLower(strings.TrimSpace(host))
		ip = strings.TrimSpace(ip)
		if h == "" || ip == "" {
			return nil, fmt.Errorf("%w: empty host or ip", ErrInvalidHostsMapping)
		}
		if strings.Contains(h, "://") || strings.ContainsAny(h, "/:") {
			return nil, fmt.Errorf("%w: bad host %q", ErrInvalidHostsMapping, host)
		}
		if net.ParseIP(ip) == nil {
			return nil, fmt.Errorf("%w: bad ip %q", ErrInvalidHostsMapping, ip)
		}
		if _, dup := out[h]; dup {
			return nil, fmt.Errorf("%w: duplicate host %q", ErrInvalidHostsMapping, h)
		}
		out[h] = ip
	}
	return out, nil
}

func (w *Workspace) PutHosts(h HostsFile) (HostsFile, error) {
	path, cleaned, err := w.hostsPath(h.Name)
	if err != nil {
		return HostsFile{}, err
	}
	mappings, err := normalizeAndValidateMappings(h.Mappings)
	if err != nil {
		return HostsFile{}, err
	}
	h.Name = cleaned
	h.Mappings = mappings
	data, err := yaml.Marshal(&h)
	if err != nil {
		return HostsFile{}, err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return HostsFile{}, err
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return HostsFile{}, err
	}
	return h, nil
}

func (w *Workspace) ListHosts() ([]HostsFile, error) {
	root := filepath.Join(w.workdir, "hosts")
	exists, err := checkDir(root)
	if err != nil {
		return nil, err
	}
	if !exists {
		return []HostsFile{}, nil
	}
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, err
	}
	var list []HostsFile
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".yaml") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(root, e.Name()))
		if err != nil {
			continue
		}
		var h HostsFile
		if err := yaml.Unmarshal(data, &h); err != nil {
			continue
		}
		if h.Mappings == nil {
			h.Mappings = map[string]string{}
		}
		if norm, err := normalizeAndValidateMappings(h.Mappings); err == nil {
			h.Mappings = norm
		}
		h.Name = strings.TrimSuffix(e.Name(), ".yaml")
		list = append(list, h)
	}
	sort.Slice(list, func(i, j int) bool { return list[i].Name < list[j].Name })
	return list, nil
}

func (w *Workspace) ActiveHostsMappings() (map[string]string, error) {
	local, err := w.GetLocal()
	if err != nil {
		return nil, err
	}
	if local.Hosts == "" {
		return nil, nil
	}
	path, _, err := w.hostsPath(local.Hosts)
	if err != nil {
		return nil, nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var h HostsFile
	if err := yaml.Unmarshal(data, &h); err != nil {
		return nil, err
	}
	return normalizeAndValidateMappings(h.Mappings)
}
```

`PutLocal` 非空 Hosts 改为：

```go
if local.Hosts != "" {
	_, cleaned, err := w.hostsPath(local.Hosts)
	if err != nil {
		return Local{}, err
	}
	local.Hosts = cleaned
}
```

- [ ] **Step 4: 跑测确认通过**

Run: `go test ./internal/workspace -count=1`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add internal/workspace/hosts.go internal/workspace/hosts_test.go internal/workspace/env.go
git commit -m "$(cat <<'EOF'
feat: 读写 hosts YAML 并校验 mappings。

EOF
)"
```

---

### Task 3: Hosts Delete / Rename + active.hosts 联动

**Files:**
- Modify: `internal/workspace/hosts.go`
- Modify: `internal/workspace/hosts_test.go`

**Interfaces:**
- Produces:
  - `func (w *Workspace) DeleteHosts(name string) error` — 当前选用则 `writeActive(env, override, "")`
  - `func (w *Workspace) RenameHosts(oldName, newName string) (HostsFile, error)` — `ErrSameHostsName` / `ErrHostsExists`；当前选用则 `writeActive(env, override, newClean)`；YAML `name` 用 `rewriteNameYAML`

- [ ] **Step 1: 写失败测试**

```go
func TestDeleteHostsClearsActive(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutHosts(HostsFile{Name: "lan", Mappings: map[string]string{}}); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutLocal(Local{Environment: "e", Override: "o", Hosts: "lan"}); err != nil {
		t.Fatal(err)
	}
	if err := ws.DeleteHosts("lan"); err != nil {
		t.Fatal(err)
	}
	got, err := ws.GetLocal()
	if err != nil {
		t.Fatal(err)
	}
	if got.Hosts != "" || got.Environment != "e" || got.Override != "o" {
		t.Fatalf("%+v", got)
	}
}

func TestRenameHostsUpdatesActive(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutHosts(HostsFile{Name: "old", Mappings: map[string]string{"a.com": "1.1.1.1"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutLocal(Local{Hosts: "old"}); err != nil {
		t.Fatal(err)
	}
	h, err := ws.RenameHosts("old", "new")
	if err != nil || h.Name != "new" {
		t.Fatalf("%v %v", h, err)
	}
	got, err := ws.GetLocal()
	if err != nil || got.Hosts != "new" {
		t.Fatalf("%+v %v", got, err)
	}
	if _, err := os.Stat(filepath.Join(ws.Workdir(), "hosts", "new.yaml")); err != nil {
		t.Fatal(err)
	}
}

func TestRenameHostsConflict(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	for _, n := range []string{"a", "b"} {
		if _, err := ws.PutHosts(HostsFile{Name: n, Mappings: map[string]string{}}); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := ws.RenameHosts("a", "b"); !errors.Is(err, ErrHostsExists) {
		t.Fatalf("%v", err)
	}
}
```

（`hosts_test.go` 顶部 import 需含 `"errors"`、`"os"`、`"path/filepath"`。）

- [ ] **Step 2: 跑测确认失败**

Run: `go test ./internal/workspace -run 'TestDeleteHosts|TestRenameHosts' -count=1`

Expected: 编译失败。

- [ ] **Step 3: 实现 Delete/Rename**

追加到 `hosts.go`：

```go
func (w *Workspace) DeleteHosts(name string) error {
	path, cleaned, err := w.hostsPath(name)
	if err != nil {
		return err
	}
	local, err := w.GetLocal()
	if err != nil {
		return err
	}
	st, err := os.Stat(path)
	if err != nil {
		return err
	}
	perm := st.Mode().Perm()
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	if err := os.Remove(path); err != nil {
		return err
	}
	if local.Hosts != cleaned {
		return nil
	}
	if err := w.writeActive(local.Environment, local.Override, ""); err != nil {
		return wrapRestore(err, os.WriteFile(path, data, perm))
	}
	return nil
}

func (w *Workspace) RenameHosts(oldName, newName string) (HostsFile, error) {
	oldPath, oldClean, err := w.hostsPath(oldName)
	if err != nil {
		return HostsFile{}, err
	}
	newPath, newClean, err := w.hostsPath(newName)
	if err != nil {
		return HostsFile{}, err
	}
	if oldClean == newClean {
		return HostsFile{}, ErrSameHostsName
	}
	oldSt, err := os.Stat(oldPath)
	if err != nil {
		return HostsFile{}, err
	}
	perm := oldSt.Mode().Perm()
	caseOnly := false
	if newSt, err := os.Stat(newPath); err == nil {
		if os.SameFile(oldSt, newSt) {
			caseOnly = true
		} else {
			return HostsFile{}, ErrHostsExists
		}
	} else if !os.IsNotExist(err) {
		return HostsFile{}, err
	}
	data, err := os.ReadFile(oldPath)
	if err != nil {
		return HostsFile{}, err
	}
	var h HostsFile
	if err := yaml.Unmarshal(data, &h); err != nil {
		return HostsFile{}, err
	}
	if h.Mappings == nil {
		h.Mappings = map[string]string{}
	}
	h.Name = newClean
	out, err := rewriteNameYAML(data, newClean)
	if err != nil {
		return HostsFile{}, err
	}
	if err := os.MkdirAll(filepath.Dir(newPath), 0o755); err != nil {
		return HostsFile{}, err
	}
	writePath := newPath
	if caseOnly {
		writePath = newPath + ".renaming"
	}
	if err := os.WriteFile(writePath, out, perm); err != nil {
		return HostsFile{}, err
	}
	if err := os.Remove(oldPath); err != nil {
		_ = os.Remove(writePath)
		return HostsFile{}, err
	}
	if caseOnly {
		if err := os.Rename(writePath, newPath); err != nil {
			_ = os.WriteFile(oldPath, data, perm)
			_ = os.Remove(writePath)
			return HostsFile{}, err
		}
	}
	rollback := func() error {
		rerr := os.WriteFile(oldPath, data, perm)
		if !caseOnly {
			_ = os.Remove(newPath)
		} else {
			_ = os.Remove(writePath)
		}
		return rerr
	}
	local, err := w.GetLocal()
	if err != nil {
		return HostsFile{}, wrapRestore(err, rollback())
	}
	if local.Hosts != oldClean {
		return h, nil
	}
	if err := w.writeActive(local.Environment, local.Override, newClean); err != nil {
		return HostsFile{}, wrapRestore(err, rollback())
	}
	return h, nil
}
```

- [ ] **Step 4: 跑测确认通过**

Run: `go test ./internal/workspace -count=1`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add internal/workspace/hosts.go internal/workspace/hosts_test.go
git commit -m "$(cat <<'EOF'
feat: hosts 删改名并同步 active.hosts。

EOF
)"
```

---

### Task 4: Executor DialContext + resolvedIP

**Files:**
- Modify: `internal/executor/result.go`
- Modify: `internal/executor/execute.go`
- Create: `internal/executor/dial.go`
- Create: `internal/executor/dial_test.go`
- Modify: `internal/executor/execute_test.go`、`internal/executor/diag_test.go`
- Modify: `internal/server/execute.go`（本任务先传 `nil`，Task 5 接 mappings）

**Interfaces:**
- Produces:
  - `Result.ResolvedIP string \`json:"resolvedIP,omitempty"\``
  - `func Execute(ctx context.Context, req workspace.Request, vars map[string]string, hosts map[string]string) Result`
  - `func newExecuteTransport(mappings map[string]string) *http.Transport`
  - `func mapDialAddress(address string, mappings map[string]string) (dialAddr string, resolvedIP string, hit bool)`

- [ ] **Step 1: 写失败测试**

`dial_test.go`：

```go
package executor

import "testing"

func TestMapDialAddressHit(t *testing.T) {
	addr, ip, hit := mapDialAddress("api.example.com:443", map[string]string{"api.example.com": "10.0.0.5"})
	if !hit || ip != "10.0.0.5" || addr != "10.0.0.5:443" {
		t.Fatalf("%q %q %v", addr, ip, hit)
	}
}

func TestMapDialAddressMissAndIPLiteral(t *testing.T) {
	if _, _, hit := mapDialAddress("other.com:80", map[string]string{"api.example.com": "10.0.0.5"}); hit {
		t.Fatal("miss should not hit")
	}
	if _, _, hit := mapDialAddress("10.0.0.5:80", map[string]string{"10.0.0.5": "1.1.1.1"}); hit {
		t.Fatal("ip literal should not remap")
	}
	if _, _, hit := mapDialAddress("api.example.com:80", nil); hit {
		t.Fatal("nil map")
	}
}

func TestMapDialAddressIPv6(t *testing.T) {
	addr, ip, hit := mapDialAddress("api.example.com:443", map[string]string{"api.example.com": "2001:db8::1"})
	if !hit || ip != "2001:db8::1" || addr != "[2001:db8::1]:443" {
		t.Fatalf("%q %q %v", addr, ip, hit)
	}
}
```

`execute_test.go` 追加（需 import `net/url`）：

```go
func TestExecuteHostsMappingKeepsHostHeader(t *testing.T) {
	var sawHost string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawHost = r.Host
		w.WriteHeader(200)
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()
	u, err := url.Parse(srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	hostURL := "http://api.example.com:" + u.Port() + "/x"
	res := Execute(context.Background(), workspace.Request{Method: "GET", URL: hostURL}, nil, map[string]string{
		"api.example.com": "127.0.0.1",
	})
	if res.ErrorClass != ClassHTTP || res.Status != 200 {
		t.Fatalf("%+v", res)
	}
	if sawHost != "api.example.com:"+u.Port() {
		t.Fatalf("host=%q", sawHost)
	}
	if res.ResolvedIP != "127.0.0.1" {
		t.Fatalf("resolvedIP=%q", res.ResolvedIP)
	}
}

func TestExecuteHostsRedirectSecondHop(t *testing.T) {
	mux := http.NewServeMux()
	srv := httptest.NewServer(mux)
	defer srv.Close()
	u, _ := url.Parse(srv.URL)
	port := u.Port()
	mux.HandleFunc("/a", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "http://pay.example.com:"+port+"/b", http.StatusFound)
	})
	mux.HandleFunc("/b", func(w http.ResponseWriter, r *http.Request) {
		if r.Host != "pay.example.com:"+port {
			t.Errorf("hop2 host=%q", r.Host)
		}
		w.WriteHeader(200)
		_, _ = w.Write([]byte("done"))
	})
	mappings := map[string]string{
		"api.example.com": "127.0.0.1",
		"pay.example.com": "127.0.0.1",
	}
	res := Execute(context.Background(), workspace.Request{
		Method: "GET",
		URL:    "http://api.example.com:" + port + "/a",
	}, nil, mappings)
	if res.ErrorClass != ClassHTTP || res.Status != 200 || res.Body != "done" {
		t.Fatalf("%+v", res)
	}
	if len(res.Redirects) < 1 {
		t.Fatalf("redirects=%v", res.Redirects)
	}
}
```

把所有现有 `Execute(ctx, req, vars)` 改为 `Execute(ctx, req, vars, nil)`（含 `diag_test.go`）。

- [ ] **Step 2: 跑测确认失败**

Run: `go test ./internal/executor -run 'TestMapDialAddress|TestExecuteHosts' -count=1`

Expected: 编译失败或 FAIL。

- [ ] **Step 3: 实现**

`dial.go`：

```go
package executor

import (
	"net"
	"strings"
)

func mapDialAddress(address string, mappings map[string]string) (string, string, bool) {
	if len(mappings) == 0 {
		return address, "", false
	}
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return address, "", false
	}
	if net.ParseIP(host) != nil {
		return address, "", false
	}
	key := strings.ToLower(host)
	ip, ok := mappings[key]
	if !ok {
		return address, "", false
	}
	return net.JoinHostPort(ip, port), ip, true
}
```

`execute.go` 中：

```go
func Execute(ctx context.Context, req workspace.Request, vars map[string]string, hosts map[string]string) (res Result) {
	// ... 现有 Prepare / timeout / NewRequest 不变 ...
	var lastResolved string
	client := &http.Client{
		Transport: newExecuteTransport(hosts, &lastResolved),
		CheckRedirect: /* 现有不变 */,
	}
	resp, err := client.Do(httpReq)
	res.ResolvedIP = lastResolved
	// ... 其余不变 ...
}

func newExecuteTransport(mappings map[string]string, lastResolved *string) *http.Transport {
	t := http.DefaultTransport.(*http.Transport).Clone()
	t.Proxy = nil
	t.DisableKeepAlives = true
	t.DisableCompression = true
	if len(mappings) == 0 {
		return t
	}
	dialer := &net.Dialer{}
	t.DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
		addr, ip, hit := mapDialAddress(address, mappings)
		if hit {
			address = addr
			if lastResolved != nil {
				*lastResolved = ip
			}
		}
		return dialer.DialContext(ctx, network, address)
	}
	return t
}
```

（`execute.go` 增加 `"context"` 已有；补 `"net"`。）

`server/execute.go` 暂：`executor.Execute(ctx, body.Request, vars, nil)`。

- [ ] **Step 4: 跑测确认通过**

Run: `go test ./internal/executor ./internal/server -count=1`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add internal/executor internal/server/execute.go
git commit -m "$(cat <<'EOF'
feat: executor 按 hosts mappings 定制 DialContext。

EOF
)"
```

---

### Task 5: HTTP `/api/hosts*` + local.hosts + execute 加载 mappings

**Files:**
- Modify: `internal/server/server.go`
- Modify: `internal/server/handlers.go`
- Modify: `internal/server/handlers_test.go`
- Modify: `internal/server/execute.go`
- Modify: `internal/server/execute_test.go`

**Interfaces:**
- Produces: 路由与规格 §5.1 一致；`localJSON` 含 `hosts`；`writeHostsErr`；execute 调 `ActiveHostsMappings` 再 `Execute(..., mappings)`
- `isInvalidPath` 识别 `invalid hosts name`

- [ ] **Step 1: 写 / 改 handlers 与 execute 测试**

```go
func TestHostsCRUDAndLocal(t *testing.T) {
	h := newTestHandler(t)
	putBody := []byte(`{"name":"lan","mappings":{"api.example.com":"10.0.0.5"}}`)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/hosts/lan", putBody))
	if rr.Code != http.StatusOK {
		t.Fatalf("put %d %s", rr.Code, rr.Body.Bytes())
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/local", []byte(`{"environment":"","override":"","hosts":"lan"}`)))
	if rr.Code != http.StatusOK {
		t.Fatalf("local %d %s", rr.Code, rr.Body.Bytes())
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/hosts/lan/rename", []byte(`{"name":"lab"}`)))
	if rr.Code != http.StatusOK {
		t.Fatalf("rename %d %s", rr.Code, rr.Body.Bytes())
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodGet, "/api/local", nil))
	var loc struct {
		Hosts string `json:"hosts"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &loc); err != nil {
		t.Fatal(err)
	}
	if loc.Hosts != "lab" {
		t.Fatalf("%+v", loc)
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodDelete, "/api/hosts/lab", nil))
	if rr.Code != http.StatusNoContent {
		t.Fatal(rr.Code)
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodGet, "/api/local", nil))
	if err := json.Unmarshal(rr.Body.Bytes(), &loc); err != nil {
		t.Fatal(err)
	}
	if loc.Hosts != "" {
		t.Fatalf("%+v", loc)
	}
}

func TestHostsPutInvalidMapping(t *testing.T) {
	h := newTestHandler(t)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/hosts/lan", []byte(`{"name":"lan","mappings":{"a/b":"1.1.1.1"}}`)))
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("got %d", rr.Code)
	}
}

func TestHostsRenameConflict(t *testing.T) {
	h := newTestHandler(t)
	for _, name := range []string{"a", "b"} {
		body := []byte(`{"name":"` + name + `","mappings":{}}`)
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/hosts/"+name, body))
		if rr.Code != http.StatusOK {
			t.Fatal(rr.Code)
		}
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/hosts/a/rename", []byte(`{"name":"b"}`)))
	if rr.Code != http.StatusConflict {
		t.Fatalf("got %d", rr.Code)
	}
}
```

`execute_test.go`：

```go
func TestExecuteMissingHostsFileDegrades(t *testing.T) {
	h := newTestHandler(t)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/local", []byte(`{"environment":"","override":"","hosts":"gone"}`)))
	if rr.Code != http.StatusOK {
		t.Fatal(rr.Code)
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()
	body := []byte(`{"id":"1","request":{"name":"t","method":"GET","url":"` + srv.URL + `","query":{},"headers":{},"body":{"type":"none"}}}`)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/execute", body))
	if rr.Code != http.StatusOK {
		t.Fatalf("%d %s", rr.Code, rr.Body.Bytes())
	}
}

func TestExecuteUsesActiveHosts(t *testing.T) {
	h := newTestHandler(t)
	var sawHost string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawHost = r.Host
		w.WriteHeader(200)
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()
	u, _ := url.Parse(srv.URL)
	port := u.Port()
	put := []byte(`{"name":"lan","mappings":{"api.example.com":"127.0.0.1"}}`)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/hosts/lan", put))
	if rr.Code != http.StatusOK {
		t.Fatal(rr.Code)
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/local", []byte(`{"environment":"","override":"","hosts":"lan"}`)))
	if rr.Code != http.StatusOK {
		t.Fatal(rr.Code)
	}
	reqURL := "http://api.example.com:" + port + "/x"
	body := []byte(`{"id":"2","request":{"name":"t","method":"GET","url":"` + reqURL + `","query":{},"headers":{},"body":{"type":"none"}}}`)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/execute", body))
	if rr.Code != http.StatusOK {
		t.Fatalf("%d %s", rr.Code, rr.Body.Bytes())
	}
	var res struct {
		Status     int    `json:"status"`
		ResolvedIP string `json:"resolvedIP"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if res.Status != 200 || res.ResolvedIP != "127.0.0.1" {
		t.Fatalf("%+v", res)
	}
	if sawHost != "api.example.com:"+port {
		t.Fatalf("host=%q", sawHost)
	}
}
```

- [ ] **Step 2: 跑测确认失败**

Run: `go test ./internal/server -run 'TestHosts|TestExecuteMissingHosts|TestExecuteUsesActiveHosts' -count=1`

Expected: 404 或编译失败。

- [ ] **Step 3: 实现 handlers + execute**

`server.go` 增加：

```go
mux.HandleFunc("GET /api/hosts", s.handleListHosts)
mux.HandleFunc("PUT /api/hosts/{name}", s.handlePutHosts)
mux.HandleFunc("DELETE /api/hosts/{name}", s.handleDeleteHosts)
mux.HandleFunc("POST /api/hosts/{name}/rename", s.handleRenameHosts)
```

`handlers.go`：

```go
func (s *server) handleListHosts(w http.ResponseWriter, r *http.Request) {
	list, err := s.ws.ListHosts()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if list == nil {
		list = []workspace.HostsFile{}
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *server) handlePutHosts(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	var h workspace.HostsFile
	if err := json.NewDecoder(r.Body).Decode(&h); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	h.Name = name
	saved, err := s.ws.PutHosts(h)
	if err != nil {
		writeHostsErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *server) handleDeleteHosts(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if err := s.ws.DeleteHosts(name); err != nil {
		writeHostsErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) handleRenameHosts(w http.ResponseWriter, r *http.Request) {
	oldName := r.PathValue("name")
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	h, err := s.ws.RenameHosts(oldName, body.Name)
	if err != nil {
		writeHostsErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, h)
}

type localJSON struct {
	Environment string `json:"environment"`
	Override    string `json:"override"`
	Hosts       string `json:"hosts"`
}

func writeHostsErr(w http.ResponseWriter, err error) {
	if errors.Is(err, workspace.ErrHostsExists) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
		return
	}
	if errors.Is(err, workspace.ErrSameHostsName) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if errors.Is(err, workspace.ErrInvalidHostsMapping) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writePathErr(w, err)
}
```

更新 `handleGetLocal` / `handlePutLocal` 读写 `Hosts`。

`isInvalidPath` 增加：

```go
strings.Contains(msg, "invalid hosts name")
```

`execute.go`：

```go
mappings, err := s.ws.ActiveHostsMappings()
if err != nil {
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
	return
}
result := executor.Execute(ctx, body.Request, vars, mappings)
```

- [ ] **Step 4: 跑测确认通过**

Run: `go test ./internal/server ./internal/workspace ./internal/executor -count=1`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add internal/server
git commit -m "$(cat <<'EOF'
feat: 暴露 /api/hosts 并在 execute 加载 active hosts。

EOF
)"
```

---

### Task 6: 前端 types / api / hosts 校验模块

**Files:**
- Modify: `web/src/types.ts`
- Modify: `web/src/api.ts`
- Create: `web/src/hosts.ts`
- Create: `web/src/hosts.test.ts`
- Modify: `web/src/Dialog.tsx`

**Interfaces:**
- Produces:
  - `interface HostsFile { name: string; mappings: Record<string, string> }`
  - `LocalConfig.hosts: string`
  - `Result.resolvedIP?: string`
  - `getHosts` / `putHosts` / `deleteHosts` / `renameHosts`
  - `hostsNameError` / `hostsAPIError` / `validateHostMappings` / `hostsRowStates` / `hostsDeleteDialog` / `hostsRenameConfirmDialog`
  - Dialog `intent`: `"create-hosts" | "rename-hosts"`；`subject`: `"hosts"`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "vitest";
import {
  hostsNameError,
  hostsAPIError,
  validateHostMappings,
  hostsRowStates,
} from "./hosts";

describe("hostsNameError", () => {
  it("rejects slash and duplicates", () => {
    expect(hostsNameError("a/b", [])).toBe("名称不能含 /");
    expect(hostsNameError("lan", ["lan"])).toBe("已有同名 Hosts");
    expect(hostsNameError("lan", [])).toBeNull();
  });
});

describe("validateHostMappings", () => {
  it("rejects empty, bad host, bad ip, duplicates", () => {
    expect(validateHostMappings({ "": "1.1.1.1" })).toMatch(/空/);
    expect(validateHostMappings({ "a/b": "1.1.1.1" })).toMatch(/主机名/);
    expect(validateHostMappings({ "a.com": "x" })).toMatch(/IP/);
    expect(
      validateHostMappings({ "A.com": "1.1.1.1", "a.com": "2.2.2.2" }),
    ).toMatch(/重复/);
    expect(validateHostMappings({ "api.example.com": "10.0.0.5" })).toBeNull();
  });
});

describe("hostsAPIError", () => {
  it("maps known errors", () => {
    expect(hostsAPIError("hosts exists")).toBe("已有同名 Hosts");
    expect(hostsAPIError("same hosts name")).toBe("不能改成当前名称");
  });
});

describe("hostsRowStates", () => {
  it("separates send badge from editing selection", () => {
    expect(hostsRowStates(["lan", "lab"], "lan", "lab")).toEqual([
      { name: "lan", itemClassName: "req-item", showSendBadge: true },
      { name: "lab", itemClassName: "req-item active", showSendBadge: false },
    ]);
  });
});
```

- [ ] **Step 2: 跑测确认失败**

Run: `cd web && npm test -- --run hosts.test.ts`

Expected: 无法解析模块或 FAIL。

- [ ] **Step 3: 实现**

`types.ts`：

```ts
export interface HostsFile {
  name: string;
  mappings: Record<string, string>;
}

export interface LocalConfig {
  environment: string;
  override: string;
  hosts: string;
}

// Result 增加：
  resolvedIP?: string;
```

`api.ts`（在 overrides 旁追加；import `HostsFile`）：

```ts
export async function getHosts(): Promise<HostsFile[]> {
  const res = await fetch("/api/hosts");
  return parseJSON<HostsFile[]>(res);
}

export async function putHosts(
  name: string,
  hosts: HostsFile,
): Promise<HostsFile> {
  const res = await fetch(`/api/hosts/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(hosts),
  });
  return parseJSON<HostsFile>(res);
}

export async function deleteHosts(name: string): Promise<void> {
  const res = await fetch(`/api/hosts/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  await parseJSON<void>(res);
}

export async function renameHosts(
  name: string,
  next: string,
): Promise<HostsFile> {
  const res = await fetch(
    `/api/hosts/${encodeURIComponent(name)}/rename`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next }),
    },
  );
  return parseJSON<HostsFile>(res);
}
```

`hosts.ts`：完整内容见下方（与 override.ts 同构，校验规则按规格 §7.3）：

```ts
import { cleanEnvName } from "./env";
import type { DialogMode } from "./Dialog";

export function hostsNameError(name: string, existing: string[]): string | null {
  const cleaned = cleanEnvName(name);
  if (cleaned === null) return name.trim() ? "名称非法" : "名称不能为空";
  if (cleaned.includes("/")) return "名称不能含 /";
  if (existing.includes(cleaned)) return "已有同名 Hosts";
  return null;
}

export function validateHostMappings(
  mappings: Record<string, string>,
): string | null {
  const seen = new Map<string, string>();
  for (const [rawHost, rawIP] of Object.entries(mappings)) {
    const host = rawHost.trim().toLowerCase();
    const ip = rawIP.trim();
    if (!host || !ip) return "主机名与 IP 不能为空";
    if (host.includes("://") || host.includes("/") || host.includes(":")) {
      return "主机名非法（不能含 ://、/ 或 :）";
    }
    if (!isIPLiteral(ip)) return "IP 非法（须为 IPv4 或 IPv6 字面量）";
    if (seen.has(host)) return "主机名重复（大小写不敏感）";
    seen.set(host, ip);
  }
  return null;
}

function isIPLiteral(ip: string): boolean {
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    return ip.split(".").every((p) => {
      const n = Number(p);
      return n >= 0 && n <= 255;
    });
  }
  if (ip.includes(":")) {
    return /^[0-9a-fA-F:]+$/.test(ip);
  }
  return false;
}

export function hostsAPIError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("same hosts name")) return "不能改成当前名称";
  if (lower.includes("hosts exists")) return "已有同名 Hosts";
  if (
    lower.includes("no such file") ||
    lower.includes("not found") ||
    /\b404\b/.test(lower)
  ) {
    return "Hosts 不存在";
  }
  return message;
}

export interface HostsRowState {
  name: string;
  itemClassName: "req-item" | "req-item active";
  showSendBadge: boolean;
}

export function hostsRowStates(
  names: string[],
  activeHosts: string,
  editingHosts: string | null,
): HostsRowState[] {
  return names.map((name) => ({
    name,
    itemClassName: editingHosts === name ? "req-item active" : "req-item",
    showSendBadge: activeHosts === name,
  }));
}

export function hostsDeleteDialog(name: string, isActive: boolean): DialogMode {
  return {
    kind: "confirm",
    title: "删除 Hosts",
    body: isActive
      ? `删除 ${name}？此操作会从磁盘去掉该文件。顶栏当前 Hosts 将变为无。`
      : `删除 ${name}？此操作会从磁盘去掉该文件。`,
    submitLabel: "删除",
    error: null,
    path: name,
    subject: "hosts",
  };
}

export function hostsRenameConfirmDialog(name: string, next: string): DialogMode {
  return {
    kind: "confirm",
    title: "重命名当前发送 Hosts",
    body: `将当前发送 Hosts ${name} 重命名为 ${next}？顶栏当前 Hosts 也会更新。`,
    submitLabel: "重命名",
    error: null,
    path: name,
    next,
    subject: "hosts",
  };
}
```

`Dialog.tsx` 的 `intent` 联合类型追加 `"create-hosts" | "rename-hosts"`；`subject` 追加 `"hosts"`。

- [ ] **Step 4: 跑测确认通过**

Run: `cd web && npm test -- --run hosts.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add web/src/types.ts web/src/api.ts web/src/hosts.ts web/src/hosts.test.ts web/src/Dialog.tsx
git commit -m "$(cat <<'EOF'
feat: 前端 Hosts 类型、API 与校验。

EOF
)"
```

---

### Task 7: 活动栏 LeftView + workMode + shortcut + ActivityBar

**Files:**
- Modify: `web/src/activity.ts`
- Modify: `web/src/activity.test.ts`
- Modify: `web/src/work-layout.ts`
- Modify: `web/src/work-layout.test.ts`
- Modify: `web/src/shortcut.ts`
- Modify: `web/src/shortcut.test.ts`
- Modify: `web/src/ActivityBar.tsx`
- Create: `web/src/hosts-panel.test.tsx`

**Interfaces:**
- Produces: `LeftView` 含 `"hosts"`；`ACTIVITY_VIEWS` 顺序：`collection, history, environment, override, hosts`；`ACTIVITY_LABEL.hosts = "Hosts"`；`workMode("hosts") === "hosts"`；`shouldSaveOnCtrlS("hosts") === true`；`shouldSendOnEnter("hosts") === false`；settings 仍沉底

- [ ] **Step 1: 写失败测试**

更新 `activity.test.ts`：

```ts
expect([...ACTIVITY_VIEWS]).toEqual([
  "collection",
  "history",
  "environment",
  "override",
  "hosts",
]);
expect(ACTIVITY_LABEL.hosts).toBe("Hosts");
```

追加 click hosts 折叠测例（同 override 模式）。

更新 `work-layout.test.ts`：`expect(workMode("hosts")).toBe("hosts")`。

更新 `shortcut.test.ts`：

```ts
expect(shouldSendOnEnter("hosts")).toBe(false);
expect(shouldSaveOnCtrlS("hosts")).toBe(true);
```

`hosts-panel.test.tsx`：

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ActivityBar from "./ActivityBar";
import { hostsRowStates } from "./hosts";

describe("hosts activity", () => {
  it("renders Hosts among top icons", () => {
    const markup = renderToStaticMarkup(
      <ActivityBar view="hosts" panelOpen={true} onClickIcon={vi.fn()} />,
    );
    expect(markup).toContain('aria-label="Hosts"');
    expect(markup).toContain('aria-pressed="true"');
  });

  it("puts the send badge only on activeHosts, not editingHosts", () => {
    expect(hostsRowStates(["lan", "lab"], "lan", "lab")).toEqual([
      { name: "lan", itemClassName: "req-item", showSendBadge: true },
      { name: "lab", itemClassName: "req-item active", showSendBadge: false },
    ]);
  });
});
```

- [ ] **Step 2: 跑测确认失败**

Run: `cd web && npm test -- --run activity.test.ts work-layout.test.ts shortcut.test.ts hosts-panel.test.tsx`

Expected: FAIL。

- [ ] **Step 3: 实现**

`activity.ts`：`LeftView` 加 `"hosts"`；`ACTIVITY_VIEWS` 末尾加 `"hosts"`；`ACTIVITY_LABEL.hosts = "Hosts"`。

`work-layout.ts`：

```ts
export type WorkMode =
  | "settings"
  | "environment"
  | "override"
  | "hosts"
  | "request";

export function workMode(view: LeftView): WorkMode {
  switch (view) {
    case "settings":
      return "settings";
    case "environment":
      return "environment";
    case "override":
      return "override";
    case "hosts":
      return "hosts";
    case "collection":
    case "history":
      return "request";
  }
}
```

`shortcut.ts`：

```ts
export function shouldSaveOnCtrlS(view: LeftView): boolean {
  return (
    view === "collection" ||
    view === "history" ||
    view === "environment" ||
    view === "override" ||
    view === "hosts"
  );
}
```

（`shouldSendOnEnter` 已只允许 collection/history，hosts 自然为 false，测例即可。）

`ActivityBar.tsx`：`ACTIVITY_TITLE.hosts = "Hosts"`；`ACTIVITY_ICON.hosts` 用简洁节点/网络 SVG（避免与 environment 公文包雷同），例如：

```tsx
hosts: (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="7.2" />
    <path d="M4.8 12h14.4M12 4.8c2.2 2.4 2.2 12 0 14.4M12 4.8c-2.2 2.4-2.2 12 0 14.4" />
  </svg>
),
```

- [ ] **Step 4: 跑测确认通过**

Run: `cd web && npm test -- --run activity.test.ts work-layout.test.ts shortcut.test.ts hosts-panel.test.tsx`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add web/src/activity.ts web/src/activity.test.ts web/src/work-layout.ts web/src/work-layout.test.ts web/src/shortcut.ts web/src/shortcut.test.ts web/src/ActivityBar.tsx web/src/hosts-panel.test.tsx
git commit -m "$(cat <<'EOF'
feat: 活动栏增加 Hosts 视图。

EOF
)"
```

---

### Task 8: 顶栏 Hosts 选择器

**Files:**
- Modify: `web/src/TopBar.tsx`
- Modify: `web/src/TopBar.test.tsx`

**Interfaces:**
- Produces: props `hosts: HostsFile[]`、`onHostsChange: (hosts: string) => void`；选项「无」+ 名称；缺失文件时 `name（文件缺失）`

- [ ] **Step 1: 写失败测试**

```tsx
it("shows Hosts selector with 无 and missing file", () => {
  const markup = renderToStaticMarkup(
    <TopBar
      workdir="/tmp/project"
      envs={[]}
      overrides={[]}
      hosts={[]}
      local={{ environment: "", override: "", hosts: "lan" }}
      onEnvChange={vi.fn()}
      onOverrideChange={vi.fn()}
      onHostsChange={vi.fn()}
    />,
  );
  expect(markup).toContain("Hosts");
  expect(markup).toContain("无");
  expect(markup).toContain("lan（文件缺失）");
});
```

更新旧测例：补 `hosts={[]}`、`onHostsChange`、`local.hosts: ""`。

- [ ] **Step 2: 跑测确认失败**

Run: `cd web && npm test -- --run TopBar.test.tsx`

Expected: 类型/断言失败。

- [ ] **Step 3: 实现 TopBar**

```tsx
import type { Environment, HostsFile, LocalConfig, Override } from "./types";

interface Props {
  workdir: string;
  envs: Environment[];
  overrides: Override[];
  hosts: HostsFile[];
  local: LocalConfig | null;
  onEnvChange: (environment: string) => void;
  onOverrideChange: (override: string) => void;
  onHostsChange: (hosts: string) => void;
}

// 在覆盖 <label> 之后：
const activeHosts = local?.hosts ?? "";
const missingHosts =
  activeHosts !== "" &&
  !hosts.some((item) => item.name === activeHosts);

<label className="env-label">
  Hosts
  <select
    value={activeHosts}
    onChange={(e) => onHostsChange(e.target.value)}
  >
    <option value="">无</option>
    {missingHosts && (
      <option value={activeHosts}>
        {activeHosts}（文件缺失）
      </option>
    )}
    {hosts.map((item) => (
      <option key={item.name} value={item.name}>
        {item.name}
      </option>
    ))}
  </select>
</label>
```

- [ ] **Step 4: 跑测确认通过**

Run: `cd web && npm test -- --run TopBar.test.tsx`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add web/src/TopBar.tsx web/src/TopBar.test.tsx
git commit -m "$(cat <<'EOF'
feat: 顶栏增加 Hosts 选择器。

EOF
)"
```

---

### Task 9: Sidebar + App Hosts 面板（CRUD / Ctrl+S / 不发送）

**Files:**
- Modify: `web/src/Sidebar.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/EnvEditor.tsx`

**Interfaces:**
- Consumes: Task 6–8 的 API、校验、TopBar、`workMode === "hosts"`、`shouldSaveOnCtrlS`/`shouldSendOnEnter`
- Produces: Hosts 面板状态机与覆盖同构：`hostsList`、`editingHosts`、`hostsPairs`、dirty/saving/error；Dialog；Ctrl+S；hosts 视图不发送；主区 EnvEditor

- [ ] **Step 1: 写/更新面板测例**

`hosts-panel.test.tsx` 已有行状态测例即可；本任务以 TypeScript 编译为门禁。

- [ ] **Step 2: 确认类型失败**

Run: `cd web && npx tsc --noEmit`

Expected: App/TopBar/Sidebar 缺 props 报错（若尚未改 App）。

- [ ] **Step 3: 实现**

**3a. EnvEditor** — 增加可选列标题：

```tsx
keyHeader?: string;
valueHeader?: string;
// 默认
keyHeader = "键",
valueHeader = "值",
// thead:
<th>{keyHeader}</th>
<th>{valueHeader}</th>
```

**3b. Sidebar** — Props 增加：

```ts
hostsList: HostsFile[];
editingHosts: string | null;
activeHosts: string;
onSelectHosts: (name: string) => void;
onNewHosts: () => void;
onDeleteHosts: (name: string) => void;
hostsBusy?: boolean;
```

在 `view === "override"` 分支之后增加 `view === "hosts"`：

```tsx
if (view === "hosts") {
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        Hosts
        <button
          type="button"
          className="btn-icon"
          title="新建"
          onClick={onNewHosts}
          disabled={hostsBusy}
        >
          ＋
        </button>
      </div>
      <div className="sidebar-body">
        {hostsList.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">还没有 Hosts</p>
            <p className="empty-hint">用标题栏 ＋ 或下方按钮创建</p>
            <button
              type="button"
              className="btn"
              onClick={onNewHosts}
              disabled={hostsBusy}
            >
              新建 Hosts
            </button>
          </div>
        ) : (
          <ul className="req-list">
            {hostsRowStates(
              hostsList.map((item) => item.name),
              activeHosts,
              editingHosts,
            ).map((row) => (
              <li key={row.name}>
                <div className="tree-row">
                  <button
                    type="button"
                    className={row.itemClassName}
                    onClick={() => onSelectHosts(row.name)}
                  >
                    <span className="req-path">{row.name}</span>
                    {row.showSendBadge ? (
                      <span className="env-send-badge">发送</span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    title="删除"
                    disabled={hostsBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteHosts(row.name);
                    }}
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
```

（import `hostsRowStates` 与 `HostsFile`。）

**3c. App.tsx** — 关键状态（紧挨 override 状态）：

```tsx
const [hostsList, setHostsList] = useState<HostsFile[]>([]);
const [editingHosts, setEditingHosts] = useState<string | null>(null);
const [hostsPairs, setHostsPairs] = useState<EnvPair[]>(() => [newEnvPair()]);
const [hostsDirty, setHostsDirty] = useState(false);
const [hostsSaving, setHostsSaving] = useState(false);
const [hostsError, setHostsError] = useState<string | null>(null);
// refs: hostsSavingRef, hostsEpochRef, hostsSavedRef, hostsPairsRef, hostsListRef, editingHostsRef
```

`boot` / `reload`：`Promise.all` 增加 `getHosts()`，`setHostsList`。

```tsx
async function onHostsChange(hosts: string) {
  if (!local || local.hosts === hosts) return;
  const next = { ...local, hosts };
  setLocal(await putLocal(next));
}

const loadHosts = useCallback((h: HostsFile) => {
  hostsEpochRef.current += 1;
  setEditingHosts(h.name);
  setHostsPairs(varsToPairs(h.mappings ?? {}));
  hostsSavedRef.current = varsJSON(h.mappings ?? {});
  setHostsDirty(false);
  setHostsError(null);
}, []);

const onSaveHosts = useCallback(async () => {
  if (hostsSavingRef.current) return;
  const name = editingHostsRef.current;
  if (!name) return;
  if (!isEnvDirty(hostsPairsRef.current, hostsSavedRef.current)) return;
  const mappings = pairsToVars(hostsPairsRef.current);
  const invalid = validateHostMappings(mappings);
  if (invalid) {
    setHostsError(invalid);
    return;
  }
  const epoch = hostsEpochRef.current;
  hostsSavingRef.current = true;
  setHostsSaving(true);
  setHostsError(null);
  try {
    const saved = await putHosts(name, { name, mappings });
    const list = await getHosts();
    setHostsList(list);
    const apply = applyEnvSaveResult({
      savedName: name,
      editingName: editingHostsRef.current,
      epochAtStart: epoch,
      epochNow: hostsEpochRef.current,
      currentPairs: hostsPairsRef.current,
      saved: { name: saved.name, variables: saved.mappings },
    });
    if (apply.action === "reload") {
      setEditingHosts(apply.env.name);
      hostsSavedRef.current = varsJSON(apply.env.variables);
      setHostsDirty(false);
    } else if (apply.action === "keep") {
      hostsSavedRef.current = apply.snapshot;
      setHostsDirty(apply.dirty);
    }
  } catch (err) {
    setHostsError(
      hostsAPIError(err instanceof Error ? err.message : String(err)),
    );
  } finally {
    hostsSavingRef.current = false;
    setHostsSaving(false);
  }
}, []);
```

Dialog：

- `openNewHostsDialog` → `intent: "create-hosts"`，title「新建 Hosts」。
- `create-hosts` 提交：`hostsNameError` → `putHosts(name, { name, mappings: {} })` → 刷新列表 → `loadHosts`。
- `rename-hosts`：校验 → 若 `local.hosts === oldName` 则先 `hostsRenameConfirmDialog` → `renameHosts` → 刷新 list+local → `loadHosts`。
- confirm `subject === "hosts"`：删除走 `deleteHosts`；重命名走 `renameHosts`（与 override confirm 分支并列）。

快捷键 `action === "save"` 分支增加：

```tsx
} else if (leftRef.current.view === "hosts") {
  void onSaveHosts();
}
```

（`shouldSendOnEnter("hosts")` 已为 false，无需额外改 send。）

渲染：

```tsx
) : mode === "hosts" ? (
  <EnvEditor
    name={editingHosts}
    pairs={hostsPairs}
    dirty={hostsDirty}
    saving={hostsSaving}
    error={hostsError}
    emptyTitle="在左侧选择一套 Hosts，或新建"
    keyHeader="主机名"
    valueHeader="IP"
    onPairsChange={(next) => {
      setHostsPairs(next);
      setHostsDirty(isEnvDirty(next, hostsSavedRef.current));
    }}
    onSave={() => void onSaveHosts()}
    onRename={openRenameHostsDialog}
  />
) : (
```

TopBar / Sidebar 传入 `hosts` / `hostsList` / handlers。

- [ ] **Step 4: 跑测确认通过**

Run: `cd web && npm test && npx tsc --noEmit`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add web/src/Sidebar.tsx web/src/App.tsx web/src/EnvEditor.tsx web/src/hosts-panel.test.tsx
git commit -m "$(cat <<'EOF'
feat: Hosts 活动栏面板与保存流程。

EOF
)"
```

---

### Task 10: Request Overview 展示 resolvedIP

**Files:**
- Modify: `web/src/ResultPane.tsx`
- Modify: `web/src/result-pane-ui.test.tsx`

**Interfaces:**
- Produces: `RequestResult` 增加可选 `resolvedIP?: string`；有值时 Overview 显示「拨号 IP {resolvedIP}」；无值不渲染

- [ ] **Step 1: 写失败测试**

```tsx
it("shows resolvedIP on request overview when present", () => {
  const markup = renderToStaticMarkup(
    <RequestResult
      prepared={samplePrepared()}
      requestSize={0}
      resolvedIP="10.0.0.5"
      tab="overview"
      onTabChange={() => {}}
    />,
  );
  expect(markup).toContain("10.0.0.5");
  expect(markup).toContain("拨号 IP");
});

it("hides resolvedIP row when absent", () => {
  const markup = renderToStaticMarkup(
    <RequestResult
      prepared={samplePrepared()}
      requestSize={0}
      tab="overview"
      onTabChange={() => {}}
    />,
  );
  expect(markup).not.toContain("拨号 IP");
});
```

（`samplePrepared` 用测例里已有 prepared 样例；若无则内联最小 `HttpRequest`。）

- [ ] **Step 2: 跑测确认失败**

Run: `cd web && npm test -- --run result-pane-ui.test.tsx`

Expected: FAIL。

- [ ] **Step 3: 实现**

```tsx
export function RequestResult({
  prepared,
  requestSize,
  resolvedIP,
  tab,
  onTabChange,
}: {
  prepared: HttpRequest | null | undefined;
  requestSize: number;
  resolvedIP?: string;
  tab: RequestTab;
  onTabChange: (tab: RequestTab) => void;
}) {
  // overview:
  <div>请求 {sizeLabel(requestSize)}</div>
  {resolvedIP ? <div>拨号 IP {resolvedIP}</div> : null}
```

`ResultPane` 传入：`resolvedIP={result.resolvedIP}`。

- [ ] **Step 4: 跑测确认通过**

Run: `cd web && npm test -- --run result-pane-ui.test.tsx`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add web/src/ResultPane.tsx web/src/result-pane-ui.test.tsx
git commit -m "$(cat <<'EOF'
feat: Overview 展示 hosts 命中拨号 IP。

EOF
)"
```

---

### Task 11: README

**Files:**
- Modify: `README.md`

**Interfaces:** 无代码接口；文档与规格 §10 对齐。

- [ ] **Step 1: 更新文案**

1. 开篇能力：集合/环境可共享处补上 `hosts/`。
2. 「界面」：顶栏增加 Hosts 选择器（含「无」）；活动栏上方增加 Hosts；与环境/覆盖独立；Hosts 视图编辑 mappings，`Ctrl+S` 保存，`Ctrl+Enter` 不发送；Overview 可显示拨号 IP。
3. 「工作区」树增加 `hosts/`；第一次保存 hosts 时创建；`active.yaml` 示例增加 `hosts:`。
4. 新增小节「Hosts」：

```yaml
# hosts/lan.yaml
name: lan
mappings:
  api.example.com: "10.0.0.5"
```

```yaml
# .httptest/local/active.yaml
environment: local
override: dev
hosts: lan
```

说明：精确 hostname 匹配（小写）；不改系统 `/etc/hosts`；Host/SNI 仍用域名；缺失文件降级为「无」。

- [ ] **Step 2: 全量回归**

```bash
go test ./... -count=1
cd web && npm test && npm run build
```

Expected: 全部 PASS / build 成功。

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: README 说明 hosts 目录与顶栏选择器。

EOF
)"
```

---

## Self-Review

**1. Spec coverage**

| 规格条目 | 任务 |
|---------|------|
| `hosts/<name>.yaml` 共享 | Task 2 |
| mappings 校验（小写、禁 :// / :、IP、重复） | Task 2 + Task 6 |
| active.hosts / 无 | Task 1 + Task 5 + Task 8 |
| 删/改名联动 active | Task 3 |
| `/api/hosts*` + local 扩展 | Task 5 |
| execute 服务端加载、缺失降级 | Task 2 `ActiveHostsMappings` + Task 5 |
| Dial 命中 / Host 不变 / 重定向 | Task 4 |
| `resolvedIP` Overview | Task 4 + Task 10 |
| 活动栏 Hosts + 面板 + Ctrl+S / 不发送 | Task 7 + Task 9 |
| 顶栏选择器 | Task 8 |
| README | Task 11 |
| 非目标（通配符、代理、系统 hosts…） | 未实现（正确） |

**2. Placeholder scan:** 无 TBD/TODO；Task 3/9 含完整实现代码；无「类似 Task N」占位。

**3. Type consistency:** `HostsFile` / `Local.Hosts` / `active.hosts` / `localJSON.hosts` / `LocalConfig.hosts` / `writeActive(env, override, hosts)` / `Execute(..., hosts)` / `resolvedIP` 全文一致；Dialog intent `create-hosts`/`rename-hosts`、subject `"hosts"`。

**注：** Task 1 中 `PutLocal` 对 hosts 名的临时 `CleanRel` 校验在 Task 2 改为 `hostsPath`；执行时勿遗漏。
