# Hosts 双类型 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Hosts 增加必填 `type`（`map` | `hosts`）：`map` 保留键值 `mappings`；`hosts` 用 `content` 存经典 hosts 原文（注释+别名），UI 按类型切换编辑器；列表遇非法文件失败，发送选用非法文件仍降级为「无」。

**Architecture:** 在 `workspace` 增加纯函数解析 `content`→map，并扩展 `HostsFile`；`ListHosts` 改为遇非法即报错；`PutHosts` 强制 type 且禁止改类型；`ActiveHostsMappings` 按 type 归一。API JSON 形状扩展字段；前端新建选类型，`map` 用 EnvEditor，`hosts` 用文本框。`executor` 不改。

**Tech Stack:** Go 1.22；React + TypeScript + Vite + 手写 CSS；Vitest；`gopkg.in/yaml.v3`（已有）。

## Global Constraints

- 规格：`docs/superpowers/specs/2026-09-15-hosts-dual-type-design.md`（前置 Dial 语义见 `2026-09-12-hosts-resolution-design.md`）。
- 路径仍为 `hosts/<name>.yaml`；`type` 必填且大小写敏感，仅 `map` | `hosts`；创建后不可改类型。
- 无 `type` 的旧文件不兼容：列表失败；须手工补 `type: map`。
- `map`：非空 `content` → 拒绝；`hosts`：非空 `mappings` → 拒绝。
- `hosts` content：空行/`#` 注释忽略；`IP hostname [alias...]`；别名与主名均精确匹配（小写）；重复名拒绝；保存原样保留注释。
- `ListHosts` / `GET /api/hosts`：任一非法文件 → error / HTTP 500（message 含文件名）。
- `ActiveHostsMappings`：缺失/损坏/非法 type/非法正文 → nil（降级「无」），不挡 execute。
- 界面中文；不新增 npm 包；不改 executor Dial；不读写系统 `/etc/hosts`。
- 不回头改写历史规格或计划文件（可更新 README 与测试夹具）。

## File Structure

| 路径 | 职责 |
|------|------|
| `internal/workspace/hosts_parse.go` | `ParseHostsContent(content string) (map[string]string, error)` |
| `internal/workspace/hosts_parse_test.go` | 注释、别名、重复、非法 IP/主机名 |
| `internal/workspace/hosts.go` | `HostsFile` 增 `Type`/`Content`；校验 type；List 严格；Put 禁改类型；Active 按 type |
| `internal/workspace/hosts_test.go` | 更新旧测例；补 type/列表失败/改类型/hosts 原样 |
| `internal/server/handlers.go` | `writeHostsErr` 映射新错误 |
| `internal/server/handlers_test.go` / `execute_test.go` | PUT 带 type；列表非法 500；改类型 400；非法 active 降级 |
| `web/src/types.ts` | `HostsType`、`HostsFile.type`/`content` |
| `web/src/hosts.ts` / `hosts.test.ts` | 解析校验 content；API 文案；新建默认 payload |
| `web/src/Dialog.tsx` | create-hosts 类型单选；`onSubmit` 传 type |
| `web/src/HostsContentEditor.tsx` | hosts 类型文本编辑器（名称、类型标签、textarea、保存/改名） |
| `web/src/App.tsx` | 双编辑器状态、保存、新建带 type、列表错误展示 |
| `web/src/hosts-panel.test.tsx` 等 | 按需更新 |
| `README.md` | 双类型示例与破坏性说明 |
| `.test/hosts/*.yaml` | 夹具补 `type: map`（若被测到） |

---

### Task 1: ParseHostsContent 纯函数

**Files:**
- Create: `internal/workspace/hosts_parse.go`
- Create: `internal/workspace/hosts_parse_test.go`

**Interfaces:**
- Produces: `func ParseHostsContent(content string) (map[string]string, error)`
- 错误用 `fmt.Errorf("%w: ...", ErrInvalidHostsMapping)`（复用已有 sentinel）
- Consumes: `net.ParseIP`、已有 `ErrInvalidHostsMapping`

- [ ] **Step 1: 写失败测试**

```go
package workspace

import (
	"errors"
	"testing"
)

func TestParseHostsContentAliasesAndComments(t *testing.T) {
	m, err := ParseHostsContent(`
# gateway
10.0.0.5 api.example.com api
10.0.0.8 pay.example.com # trailing comment
`)
	if err != nil {
		t.Fatal(err)
	}
	if m["api.example.com"] != "10.0.0.5" || m["api"] != "10.0.0.5" {
		t.Fatalf("%v", m)
	}
	if m["pay.example.com"] != "10.0.0.8" {
		t.Fatalf("%v", m)
	}
}

func TestParseHostsContentDuplicateRejected(t *testing.T) {
	_, err := ParseHostsContent("1.1.1.1 a.com\n2.2.2.2 A.COM")
	if !errors.Is(err, ErrInvalidHostsMapping) {
		t.Fatalf("got %v", err)
	}
}

func TestParseHostsContentEmptyOK(t *testing.T) {
	m, err := ParseHostsContent("\n# only comment\n")
	if err != nil || len(m) != 0 {
		t.Fatalf("%v %v", m, err)
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `go test ./internal/workspace/ -run ParseHostsContent -count=1`  
Expected: FAIL（`ParseHostsContent` undefined）

- [ ] **Step 3: 实现解析**

```go
package workspace

import (
	"fmt"
	"net"
	"strings"
)

// ParseHostsContent parses classic hosts text into hostname→IP (aliases expanded).
func ParseHostsContent(content string) (map[string]string, error) {
	out := map[string]string{}
	for _, raw := range strings.Split(content, "\n") {
		line := raw
		if i := strings.IndexByte(line, '#'); i >= 0 {
			line = line[:i]
		}
		fields := strings.Fields(line)
		if len(fields) == 0 {
			continue
		}
		if len(fields) < 2 {
			return nil, fmt.Errorf("%w: need IP and hostname", ErrInvalidHostsMapping)
		}
		ip := fields[0]
		if net.ParseIP(ip) == nil {
			return nil, fmt.Errorf("%w: bad ip %q", ErrInvalidHostsMapping, ip)
		}
		for _, name := range fields[1:] {
			h := strings.ToLower(strings.TrimSpace(name))
			if h == "" {
				return nil, fmt.Errorf("%w: empty host", ErrInvalidHostsMapping)
			}
			if strings.Contains(h, "://") || strings.ContainsAny(h, "/:") {
				return nil, fmt.Errorf("%w: bad host %q", ErrInvalidHostsMapping, name)
			}
			if _, dup := out[h]; dup {
				return nil, fmt.Errorf("%w: duplicate host %q", ErrInvalidHostsMapping, h)
			}
			out[h] = ip
		}
	}
	return out, nil
}
```

- [ ] **Step 4: 运行确认通过**

Run: `go test ./internal/workspace/ -run ParseHostsContent -count=1`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/workspace/hosts_parse.go internal/workspace/hosts_parse_test.go
git commit -m "$(cat <<'EOF'
feat: 解析经典 hosts 文本为 hostname→IP（含别名）。

EOF
)"
```

---

### Task 2: HostsFile 双类型 + List/Put/Active

**Files:**
- Modify: `internal/workspace/hosts.go`
- Modify: `internal/workspace/hosts_test.go`

**Interfaces:**
- Produces:
  - `const HostsTypeMap = "map"`；`const HostsTypeHosts = "hosts"`
  - `type HostsFile struct { Name string; Type string; Mappings map[string]string; Content string }`（json/yaml：`name`/`type`/`mappings`/`content`）
  - `var ErrInvalidHostsType = errors.New("invalid hosts type")`
  - `var ErrHostsTypeImmutable = errors.New("hosts type immutable")`
  - `PutHosts`：校验 type；已存在则 type 必须一致；按 type 校验交叉字段与正文；落盘时未用字段写空
  - `ListHosts`：非法文件返回 `fmt.Errorf("hosts %q: %w", name, err)`，不再 skip
  - `ActiveHostsMappings`：非法/缺失 → `(nil, nil)`；`hosts` 类型调用 `ParseHostsContent`
- Consumes: `ParseHostsContent`、`normalizeAndValidateMappings`

- [ ] **Step 1: 改写/追加失败测试**

将现有 `PutHosts`/`ListHosts` 测例全部带上 `Type: HostsTypeMap`。  
把 `TestListHostsSkipsInvalidMappings` **改名并改断言**为失败：

```go
func TestListHostsRejectsInvalidFile(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutHosts(HostsFile{Name: "ok", Type: HostsTypeMap, Mappings: map[string]string{"a.com": "1.1.1.1"}}); err != nil {
		t.Fatal(err)
	}
	root := filepath.Join(ws.Workdir(), "hosts")
	// missing type
	if err := os.WriteFile(filepath.Join(root, "bad.yaml"), []byte("name: bad\nmappings:\n  a.com: \"1.1.1.1\"\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	_, err = ws.ListHosts()
	if err == nil {
		t.Fatal("expected list error")
	}
}

func TestPutHostsRequiresTypeAndRejectsChange(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutHosts(HostsFile{Name: "lan", Mappings: map[string]string{}}); err == nil {
		t.Fatal("expected missing type error")
	}
	if _, err := ws.PutHosts(HostsFile{Name: "lan", Type: HostsTypeMap, Mappings: map[string]string{}}); err != nil {
		t.Fatal(err)
	}
	_, err = ws.PutHosts(HostsFile{Name: "lan", Type: HostsTypeHosts, Content: ""})
	if !errors.Is(err, ErrHostsTypeImmutable) {
		t.Fatalf("got %v", err)
	}
}

func TestPutHostsContentRoundTrip(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	raw := "# c\n10.0.0.5 api.example.com api\n"
	saved, err := ws.PutHosts(HostsFile{Name: "lan", Type: HostsTypeHosts, Content: raw})
	if err != nil {
		t.Fatal(err)
	}
	if saved.Content != raw {
		t.Fatalf("%q", saved.Content)
	}
	list, err := ws.ListHosts()
	if err != nil || len(list) != 1 || list[0].Content != raw {
		t.Fatalf("%+v %v", list, err)
	}
	if _, err := ws.PutLocal(Local{Hosts: "lan"}); err != nil {
		t.Fatal(err)
	}
	m, err := ws.ActiveHostsMappings()
	if err != nil {
		t.Fatal(err)
	}
	if m["api"] != "10.0.0.5" || m["api.example.com"] != "10.0.0.5" {
		t.Fatalf("%v", m)
	}
}

func TestActiveHostsMappingsInvalidTypeDegrades(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	root := filepath.Join(ws.Workdir(), "hosts")
	if err := os.MkdirAll(root, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "lan.yaml"), []byte("name: lan\nmappings: {}\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutLocal(Local{Hosts: "lan"}); err != nil {
		t.Fatal(err)
	}
	m, err := ws.ActiveHostsMappings()
	if err != nil || m != nil {
		t.Fatalf("%v %v", m, err)
	}
}
```

同时更新文件中所有 `PutHosts(HostsFile{...})` 调用，补 `Type: HostsTypeMap`。交叉字段测例：

```go
func TestPutHostsRejectsCrossFields(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	_, err = ws.PutHosts(HostsFile{
		Name: "lan", Type: HostsTypeMap,
		Mappings: map[string]string{"a.com": "1.1.1.1"},
		Content:  "should not",
	})
	if !errors.Is(err, ErrInvalidHostsMapping) && !errors.Is(err, ErrInvalidHostsType) {
		// prefer wrapping ErrInvalidHostsMapping with message about content
		if err == nil {
			t.Fatal("expected error")
		}
	}
}
```

交叉字段建议统一：`fmt.Errorf("%w: unexpected content", ErrInvalidHostsMapping)` / `unexpected mappings`。

- [ ] **Step 2: 运行确认失败**

Run: `go test ./internal/workspace/ -run 'Hosts|ActiveHosts' -count=1`  
Expected: 既有测例因缺 Type 失败，或新测例 FAIL

- [ ] **Step 3: 实现 hosts.go 变更**

核心形状（实现时按此对齐，保留 Rename/Delete 逻辑，读写 Type/Content）：

```go
const (
	HostsTypeMap   = "map"
	HostsTypeHosts = "hosts"
)

var (
	ErrInvalidHostsType    = errors.New("invalid hosts type")
	ErrHostsTypeImmutable  = errors.New("hosts type immutable")
)

type HostsFile struct {
	Name     string            `json:"name" yaml:"name"`
	Type     string            `json:"type" yaml:"type"`
	Mappings map[string]string `json:"mappings" yaml:"mappings"`
	Content  string            `json:"content" yaml:"content"`
}

func validateHostsType(t string) error {
	if t != HostsTypeMap && t != HostsTypeHosts {
		return fmt.Errorf("%w: %q", ErrInvalidHostsType, t)
	}
	return nil
}

func normalizeHostsFile(h HostsFile) (HostsFile, error) {
	if err := validateHostsType(h.Type); err != nil {
		return HostsFile{}, err
	}
	if h.Mappings == nil {
		h.Mappings = map[string]string{}
	}
	switch h.Type {
	case HostsTypeMap:
		if strings.TrimSpace(h.Content) != "" {
			return HostsFile{}, fmt.Errorf("%w: unexpected content", ErrInvalidHostsMapping)
		}
		m, err := normalizeAndValidateMappings(h.Mappings)
		if err != nil {
			return HostsFile{}, err
		}
		h.Mappings = m
		h.Content = ""
	case HostsTypeHosts:
		if len(h.Mappings) > 0 {
			return HostsFile{}, fmt.Errorf("%w: unexpected mappings", ErrInvalidHostsMapping)
		}
		if _, err := ParseHostsContent(h.Content); err != nil {
			return HostsFile{}, err
		}
		h.Mappings = map[string]string{}
	}
	return h, nil
}
```

`PutHosts`：若目标文件已存在则先读出旧 `Type`，与请求 `Type` 比较，不一致 → `ErrHostsTypeImmutable`；再 `normalizeHostsFile` 后 marshal 写入。  
`ListHosts`：每个 `*.yaml` 必须成功 `normalizeHostsFile`（先 unmarshal，再设 `Name` 为文件名），失败则 `return nil, fmt.Errorf("hosts %q: %w", name, err)`。损坏 YAML 同样失败。  
`loadHostsFile(path)` 辅助：供 Active/Put 存在性检查复用。  
`ActiveHostsMappings`：读文件 → normalize 失败则 `(nil,nil)`；成功则若 `map` 返回 mappings，若 `hosts` 返回 `ParseHostsContent(content)`。

Rename 读出后写回时保留 `Type`/`Content`/`Mappings`，仅改 `name`（继续用 `rewriteNameYAML` 或等价）。

- [ ] **Step 4: 运行确认通过**

Run: `go test ./internal/workspace/ -count=1`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/workspace/hosts.go internal/workspace/hosts_test.go
git commit -m "$(cat <<'EOF'
feat: Hosts 必填 type（map/hosts），列表遇非法失败。

EOF
)"
```

---

### Task 3: API 错误映射与测例

**Files:**
- Modify: `internal/server/handlers.go`（`writeHostsErr`）
- Modify: `internal/server/handlers_test.go`
- Modify: `internal/server/execute_test.go`

**Interfaces:**
- Produces: `ErrInvalidHostsType` / `ErrHostsTypeImmutable` / `ErrInvalidHostsMapping` → HTTP 400；列表非法 → 已有 500 路径
- Consumes: workspace 新 sentinel

- [ ] **Step 1: 更新/追加 API 测试**

所有 put body 增加 `"type":"map"`（或 hosts）。追加：

```go
func TestHostsListInvalidType500(t *testing.T) {
	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)
	putOK := []byte(`{"name":"ok","type":"map","mappings":{"a.com":"1.1.1.1"}}`)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/hosts/ok", putOK))
	if rr.Code != http.StatusOK {
		t.Fatal(rr.Code)
	}
	bad := filepath.Join(ws.Workdir(), "hosts", "bad.yaml")
	if err := os.WriteFile(bad, []byte("name: bad\nmappings: {}\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodGet, "/api/hosts", nil))
	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("got %d %s", rr.Code, rr.Body.Bytes())
	}
}

func TestHostsPutChangeType400(t *testing.T) {
	h := newTestHandler(t)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/hosts/lan", []byte(`{"name":"lan","type":"map","mappings":{}}`)))
	if rr.Code != http.StatusOK {
		t.Fatal(rr.Code)
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/hosts/lan", []byte(`{"name":"lan","type":"hosts","content":""}`)))
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("got %d", rr.Code)
	}
}

func TestHostsPutHostsTypeOK(t *testing.T) {
	h := newTestHandler(t)
	body := []byte(`{"name":"lan","type":"hosts","content":"10.0.0.5 api.example.com api\n"}`)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/hosts/lan", body))
	if rr.Code != http.StatusOK {
		t.Fatalf("%d %s", rr.Code, rr.Body.Bytes())
	}
}
```

更新 `TestExecuteUsesActiveHosts`、`TestHostsCRUDAndLocal`、`TestHostsPutInvalidMapping`、`TestHostsRenameConflict` 等 put body，一律含 `"type":"map"`（或 hosts）。  
追加：workdir 写入无 `type` 的 `hosts/lan.yaml`，`PUT /api/local` 设 `hosts: lan`，再 execute 期望仍成功（降级为系统 DNS，不 5xx）。

- [ ] **Step 2: 运行确认失败**

Run: `go test ./internal/server/ -run Hosts -count=1`  
Expected: 旧 put 缺 type → 400；新测例部分 FAIL

- [ ] **Step 3: 改 writeHostsErr**

```go
func writeHostsErr(w http.ResponseWriter, err error) {
	if errors.Is(err, workspace.ErrHostsExists) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
		return
	}
	if errors.Is(err, workspace.ErrSameHostsName) ||
		errors.Is(err, workspace.ErrInvalidHostsMapping) ||
		errors.Is(err, workspace.ErrInvalidHostsType) ||
		errors.Is(err, workspace.ErrHostsTypeImmutable) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writePathErr(w, err)
}
```

handlers 本身无需改 JSON 字段名（依赖 `HostsFile` 的 json tag）。确保 `handleListHosts` 在 err != nil 时已是 500。

- [ ] **Step 4: 全量服务端测试**

Run: `go test ./internal/server/ ./internal/workspace/ ./internal/executor/ -count=1`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/server/handlers.go internal/server/handlers_test.go internal/server/execute_test.go
git commit -m "$(cat <<'EOF'
feat: Hosts API 支持 type，非法列表返回 500。

EOF
)"
```

---

### Task 4: 前端类型与 hosts 文本校验

**Files:**
- Modify: `web/src/types.ts`
- Modify: `web/src/hosts.ts`
- Modify: `web/src/hosts.test.ts`

**Interfaces:**
- Produces:
  - `export type HostsType = "map" | "hosts"`
  - `HostsFile`: `{ name; type: HostsType; mappings: Record<string,string>; content: string }`
  - `parseHostsContent(content: string): { ok: true; mappings } | { ok: false; error: string }`
  - `validateHostsFile(h: Pick<HostsFile,"type"|"mappings"|"content">): string | null`
  - `hostsAPIError`：识别 `invalid hosts type` / `hosts type immutable` / 列表类错误文案

- [ ] **Step 1: 写失败测试（hosts.test.ts）**

```ts
import { describe, expect, it } from "vitest";
import { parseHostsContent, validateHostsFile } from "./hosts";

describe("parseHostsContent", () => {
  it("expands aliases and strips comments", () => {
    const r = parseHostsContent("10.0.0.5 api.example.com api # x\n");
    expect(r).toEqual({
      ok: true,
      mappings: { "api.example.com": "10.0.0.5", api: "10.0.0.5" },
    });
  });

  it("rejects duplicates case-insensitively", () => {
    const r = parseHostsContent("1.1.1.1 a.com\n2.2.2.2 A.COM");
    expect(r.ok).toBe(false);
  });
});

describe("validateHostsFile", () => {
  it("rejects cross fields", () => {
    expect(
      validateHostsFile({
        type: "map",
        mappings: { "a.com": "1.1.1.1" },
        content: "nope",
      }),
    ).toBeTruthy();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd web && npx vitest run src/hosts.test.ts`  
Expected: FAIL（符号不存在或旧 HostsFile）

- [ ] **Step 3: 实现 types + hosts.ts**

`types.ts`：

```ts
export type HostsType = "map" | "hosts";

export interface HostsFile {
  name: string;
  type: HostsType;
  mappings: Record<string, string>;
  content: string;
}
```

`hosts.ts` 增加与 Go 同规则的 `parseHostsContent`；`validateHostsFile` 分支调用 `hostPairsToMappings` 或 `parseHostsContent`；扩展 `hostsAPIError`：

```ts
if (lower.includes("hosts type immutable")) return "不能更改 Hosts 类型";
if (lower.includes("invalid hosts type")) return "Hosts 类型非法";
```

列表失败时 App 会直接展示 `err.message`（可含 `500: hosts "bad": ...`），本任务至少保证 `hostsAPIError` 不吞掉原 message（未知错误返回原串或精简）。

- [ ] **Step 4: 运行确认通过**

Run: `cd web && npx vitest run src/hosts.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/types.ts web/src/hosts.ts web/src/hosts.test.ts
git commit -m "$(cat <<'EOF'
feat: 前端 Hosts 类型与 hosts 文本校验。

EOF
)"
```

---

### Task 5: Dialog 选类型 + App 双编辑器

**Files:**
- Modify: `web/src/Dialog.tsx`
- Create: `web/src/HostsContentEditor.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/hosts-panel.test.tsx` / `TopBar.test.tsx` 等若因类型编译失败则补最小 `type`/`content`
- Modify: 相关 CSS（`web/src` 现有 stylesheet，例如 `styles.css` / `index.css`）为 textarea 增加 `.hosts-content` 等宽样式

**Interfaces:**
- Produces:
  - Dialog `create-hosts`：名称输入 + 类型单选（默认 `map`）；`onSubmit(path, { hostsType })`
  - `HostsContentEditor`：展示 name、只读类型标签、`textarea`、dirty/saving/error、保存与改名按钮（对齐 EnvEditor 能力子集）
  - App：`editingHostsType`、`hostsContent` 状态；按 type 渲染 EnvEditor 或 HostsContentEditor；`loadHosts`/`onSaveHosts`/`create-hosts` 带 type；`getHosts` 失败时 `setHostsError`/`setHostsList([])` 并展示错误，不假装空成功

- [ ] **Step 1: 扩展 Dialog**

`DialogMode` path 的 `onSubmit` 改为：

```ts
onSubmit: (path?: string, opts?: { hostsType?: HostsType }) => void | Promise<void>;
```

当 `intent === "create-hosts"` 时渲染：

```tsx
<fieldset className="hosts-type-pick">
  <legend>类型</legend>
  <label><input type="radio" name="hostsType" value="map" checked={hostsType==="map"} onChange={() => setHostsType("map")} /> map（键值）</label>
  <label><input type="radio" name="hostsType" value="hosts" checked={hostsType==="hosts"} onChange={() => setHostsType("hosts")} /> hosts（文本）</label>
</fieldset>
```

submit path 时：`await onSubmit(p, { hostsType })`。

- [ ] **Step 2: HostsContentEditor**

新建组件，props 大致：

```ts
type Props = {
  name: string | null;
  hostsType: "hosts";
  content: string;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  emptyTitle: string;
  onContentChange: (v: string) => void;
  onSave: () => void;
  onRename: () => void;
};
```

无 name 时显示 emptyTitle；有 name 时顶栏显示名称、`hosts` 标签、改名、保存；主体 `<textarea className="hosts-content" value={content} onChange=... />`。

- [ ] **Step 3: 接线 App.tsx**

- 状态：`hostsContent`、`editingHostsType: HostsType | null`；`hostsSavedRef` 对 map 仍用 `varsJSON(mappings)`，对 hosts 用 content 字符串快照。
- `loadHosts(h)`：设 type；map → pairs；hosts → content。
- `onSaveHosts`：若 type===`map` 走 `hostPairsToMappings` + `putHosts({type:"map",mappings,content:""})`；若 `hosts` 则 `parseHostsContent` 校验后 `putHosts({type:"hosts",content,mappings:{}})`。
- `create-hosts`：`putHosts(p, { name:p, type: hostsType, mappings:{}, content:"" })` 然后 `loadHosts`。
- `reload`/`Promise.all getHosts`：catch 列表错误，设置可见错误（例如顶栏下或 Hosts 面板 `hostsError`），`setHostsList([])`。
- 渲染：`mode==="hosts"` 且 `editingHostsType==="hosts"` → `HostsContentEditor`，否则现有 `EnvEditor`（并在 EnvEditor 旁或标题区加只读「map」提示——可用 EnvEditor 上方一小段或 `emptyTitle` 旁自定义；最小做法：在 Hosts 面板外包一层显示 `类型：map`）。

- [ ] **Step 4: 前端测试与构建**

Run:

```bash
cd web && npx vitest run
cd web && npm run build
```

Expected: PASS；修编译错误（测试里的 HostsFile mock 补 `type`/`content`）。

- [ ] **Step 5: Commit**

```bash
git add web/src/Dialog.tsx web/src/HostsContentEditor.tsx web/src/App.tsx web/src/*.css web/src/*.test.* web/src/*.test.tsx
git commit -m "$(cat <<'EOF'
feat: Hosts 新建选类型，hosts 文本编辑器。

EOF
)"
```

---

### Task 6: README、夹具、嵌入构建

**Files:**
- Modify: `README.md` Hosts 节
- Modify: `.test/hosts/测试环境.yaml`（若保留）补 `type: map`
- Run: `cd web && npm run build` 后 `go build`（嵌入 UI）

- [ ] **Step 1: 更新 README Hosts 节**

替换/扩展为双类型说明，示例：

```yaml
# hosts/lan.yaml — map
name: lan
type: map
mappings:
  api.example.com: "10.0.0.5"
```

```yaml
# hosts/lab.yaml — hosts 文本
name: lab
type: hosts
content: |
  10.0.0.5 api.example.com api
  # comment
```

写明：破坏性变更——必须有 `type`；旧文件请补 `type: map`；新建可选类型；`hosts` 类型在 UI 中编辑原文。

界面句：新建 Hosts 时选择 `map` 或 `hosts`。

- [ ] **Step 2: 夹具**

`.test/hosts/测试环境.yaml`：

```yaml
name: 测试环境
type: map
mappings: {}
```

- [ ] **Step 3: 全量验证**

```bash
cd web && npm run build
go test ./...
go build -o httptest ./cmd/httptest
```

Expected: 全绿；二进制构建成功。

- [ ] **Step 4: Commit**

```bash
git add README.md .test/hosts/测试环境.yaml internal/server/ui/ web/src/ web/dist/ 2>/dev/null || true
# 仅 add 实际变更：README、夹具、embed 产出目录（以 git status 为准）
git add -u README.md
git add .test/hosts/测试环境.yaml
git add internal/server/ui/
git commit -m "$(cat <<'EOF'
docs: README 说明 Hosts 双类型；更新嵌入 UI 与夹具。

EOF
)"
```

---

## Plan Self-Review

| 规格要求 | 任务 |
|---------|------|
| `type` 必填 map/hosts | Task 2 |
| 列表非法失败 | Task 2–3 |
| 禁止改类型 | Task 2–3 |
| map mappings + 交叉字段 | Task 2、4 |
| hosts content 原样 + 别名 | Task 1–2、4–5 |
| Active 降级 | Task 2–3 |
| 新建 Dialog 选类型 | Task 5 |
| 双编辑器 UI | Task 5 |
| README / 夹具 | Task 6 |
| executor 不改 | 无任务（刻意） |

无 TBD；类型名 `HostsTypeMap`/`HostsTypeHosts`、`ParseHostsContent`、`ErrHostsTypeImmutable` 前后一致。
