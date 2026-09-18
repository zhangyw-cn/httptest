# Request-level Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为每个请求增加嵌套 `settings`（`timeoutMs`、`followRedirects`、`maxRedirects`、`insecureSkipVerify`），UI「请求设置」页签可编辑，执行器与 curl 导入/导出按该配置生效；移除顶层 `timeout`。

**Architecture:** `workspace.RequestSettings` 落盘/校验；`executor` 归一化后驱动 `WithTimeout`、`CheckRedirect`、`TLSClientConfig.InsecureSkipVerify`；前端 `HttpRequest.settings` + RequestEditor 第四页签；curl flag ↔ settings。`PrepareResult.timeoutSeconds` 由 ms 派生，保持导出兼容。

**Tech Stack:** Go 1.22；React + TypeScript + Vite + 手写 CSS；Vitest；`gopkg.in/yaml.v3`（已有）。

## Global Constraints

- 规格：`docs/superpowers/specs/2026-09-18-request-settings-design.md`。
- 嵌套 `settings`；**禁止**顶层 `timeout` 与 `settings.timeout`（字符串）；须显式 map 探测，不能靠结构体丢字段。
- 默认：`timeoutMs=30000`、`followRedirects=true`、`maxRedirects=10`、`insecureSkipVerify=false`。
- `maxRedirects` 合法范围 1–50（仅 follow 为 true 时校验/使用）。
- 保存前将等于默认的字段收成 nil，全默认则省略 `settings`。
- UI 页签文案「请求设置」；超时输入单位毫秒；界面中文。
- curl：无 `-L` 时**不**写 `followRedirects: false`（省略 = 产品默认跟随）。
- 不新增 npm 包；不改 Hosts Dial/SNI 语义；不引入工作区级客户端默认。
- 实现后更新 README；导入 curl 旧规格中「忽略 `-L` / 顶层 timeout」以本实现为准。

## File Structure

| 路径 | 职责 |
|------|------|
| `internal/workspace/request.go` | `RequestSettings`；去掉顶层 `Timeout`；decode 拒旧字段；`CompactSettings`；Put/Get |
| `internal/workspace/request_test.go` | settings 读写、拒顶层 timeout、compact |
| `internal/executor/settings.go` | `EffectiveSettings` 归一化与校验 |
| `internal/executor/settings_test.go` | 默认与越界 |
| `internal/executor/execute.go` | ms 超时、CheckRedirect、insecure transport |
| `internal/executor/execute_test.go` / `diag_test.go` | 重定向/超时/insecure |
| `internal/executor/prepare.go` | Prepare 拷贝 Settings |
| `internal/executor/prepare_result.go` | `EffectiveTimeoutSeconds` 改基于 settings |
| `internal/executor/prepare_result_test.go` / `internal/server/prepare_test.go` | 更新断言 |
| `web/src/types.ts` | `RequestSettings`；去掉 `timeout?: string` |
| `web/src/request.ts` / `request.test.ts` | normalize settings |
| `web/src/RequestEditor.tsx` | 「请求设置」页签 |
| `web/src/curl.ts` / `curl.test.ts` | flag ↔ settings；扩展 `CurlOptions` |
| `web/src/ExportCurlDialog.tsx` (+test) | `-k` / `--max-redirs` 勾选；文案 ms |
| `README.md` | 请求文件示例、非目标列表 |

---

### Task 1: workspace RequestSettings 与破坏性校验

**Files:**
- Modify: `internal/workspace/request.go`
- Modify: `internal/workspace/request_test.go`

**Interfaces:**
- Produces:
  ```go
  type RequestSettings struct {
  	TimeoutMs          *int64 `json:"timeoutMs,omitempty" yaml:"timeoutMs,omitempty"`
  	FollowRedirects    *bool  `json:"followRedirects,omitempty" yaml:"followRedirects,omitempty"`
  	MaxRedirects       *int   `json:"maxRedirects,omitempty" yaml:"maxRedirects,omitempty"`
  	InsecureSkipVerify *bool  `json:"insecureSkipVerify,omitempty" yaml:"insecureSkipVerify,omitempty"`
  }
  // Request 含 Settings RequestSettings；无 Timeout 字段
  func CompactSettings(s RequestSettings) RequestSettings
  func decodeRequestYAML(data []byte) (Request, error) // 内部：先 map 探测再 Unmarshal
  ```
- Consumes: 现有 `PutRequest` / `GetRequest` / `normalizeMethod`

- [ ] **Step 1: 写失败测试**

在 `request_test.go` 将 `Timeout: "30s"` 改为非默认 settings，并新增：

```go
func TestGetRequestRejectsTopLevelTimeout(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(ws.Workdir(), "collections", "old.yaml")
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	content := "name: Old\nmethod: GET\nurl: http://example.com\ntimeout: 30s\n"
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	_, err = ws.GetRequest("old")
	if err == nil || !strings.Contains(err.Error(), "settings.timeoutMs") {
		t.Fatalf("got %v", err)
	}
}

func TestPutRequestCompactsDefaultSettings(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	ms := int64(30000)
	follow := true
	max := 10
	insecure := false
	req := Request{
		Name:   "Def",
		Method: "GET",
		URL:    "http://example.com",
		Settings: RequestSettings{
			TimeoutMs: &ms, FollowRedirects: &follow,
			MaxRedirects: &max, InsecureSkipVerify: &insecure,
		},
	}
	if err := ws.PutRequest("def", req); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(filepath.Join(ws.Workdir(), "collections", "def.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "settings:") {
		t.Fatalf("expected no settings block, got %s", raw)
	}
}

func TestPutGetRequestSettingsRoundTrip(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	ms := int64(5000)
	follow := false
	req := Request{
		Name:   "S",
		Method: "GET",
		URL:    "http://example.com",
		Settings: RequestSettings{TimeoutMs: &ms, FollowRedirects: &follow},
	}
	if err := ws.PutRequest("s", req); err != nil {
		t.Fatal(err)
	}
	got, err := ws.GetRequest("s")
	if err != nil {
		t.Fatal(err)
	}
	if got.Settings.TimeoutMs == nil || *got.Settings.TimeoutMs != 5000 {
		t.Fatalf("%+v", got.Settings)
	}
	if got.Settings.FollowRedirects == nil || *got.Settings.FollowRedirects {
		t.Fatalf("%+v", got.Settings)
	}
}
```

同步改 `TestPutGetDeleteRequest`：删掉 `Timeout: "30s"`（或改为非默认 `timeoutMs`）。

- [ ] **Step 2: 运行确认失败**

Run: `go test ./internal/workspace/ -run 'RejectsTopLevel|CompactsDefault|SettingsRoundTrip|PutGetDelete' -count=1`  
Expected: FAIL（缺 `RequestSettings` / 仍接受顶层 timeout）

- [ ] **Step 3: 实现模型与 decode**

在 `request.go`：

```go
type RequestSettings struct {
	TimeoutMs          *int64 `json:"timeoutMs,omitempty" yaml:"timeoutMs,omitempty"`
	FollowRedirects    *bool  `json:"followRedirects,omitempty" yaml:"followRedirects,omitempty"`
	MaxRedirects       *int   `json:"maxRedirects,omitempty" yaml:"maxRedirects,omitempty"`
	InsecureSkipVerify *bool  `json:"insecureSkipVerify,omitempty" yaml:"insecureSkipVerify,omitempty"`
}

type Request struct {
	Name     string            `json:"name" yaml:"name"`
	Method   string            `json:"method" yaml:"method"`
	URL      string            `json:"url" yaml:"url"`
	Query    map[string]string `json:"query" yaml:"query"`
	Headers  map[string]string `json:"headers" yaml:"headers"`
	Body     Body              `json:"body" yaml:"body"`
	Settings RequestSettings   `json:"settings,omitempty" yaml:"settings,omitempty"`
}

func CompactSettings(s RequestSettings) RequestSettings {
	out := RequestSettings{}
	if s.TimeoutMs != nil && *s.TimeoutMs != 30000 {
		out.TimeoutMs = s.TimeoutMs
	}
	if s.FollowRedirects != nil && !*s.FollowRedirects {
		out.FollowRedirects = s.FollowRedirects
	}
	if s.MaxRedirects != nil && *s.MaxRedirects != 10 {
		out.MaxRedirects = s.MaxRedirects
	}
	if s.InsecureSkipVerify != nil && *s.InsecureSkipVerify {
		out.InsecureSkipVerify = s.InsecureSkipVerify
	}
	return out
}

func rejectLegacyTimeoutKeys(data []byte) error {
	var probe map[string]interface{}
	if err := yaml.Unmarshal(data, &probe); err != nil {
		return err
	}
	if _, ok := probe["timeout"]; ok {
		return fmt.Errorf("top-level timeout is no longer supported; use settings.timeoutMs")
	}
	if raw, ok := probe["settings"]; ok && raw != nil {
		m, ok := raw.(map[string]interface{})
		if !ok {
			return fmt.Errorf("settings must be a mapping")
		}
		if _, ok := m["timeout"]; ok {
			return fmt.Errorf("settings.timeout is no longer supported; use settings.timeoutMs")
		}
	}
	return nil
}
```

`PutRequest`：marshal 前 `req.Settings = CompactSettings(req.Settings)`。  
`GetRequest`：读文件后先 `rejectLegacyTimeoutKeys(data)`，再 `yaml.Unmarshal` 到 `Request`。

- [ ] **Step 4: 运行确认通过**

Run: `go test ./internal/workspace/ -run 'RejectsTopLevel|CompactsDefault|SettingsRoundTrip|PutGetDelete' -count=1`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/workspace/request.go internal/workspace/request_test.go
git commit -m "$(cat <<'EOF'
feat(workspace): nest request settings and reject top-level timeout.

EOF
)"
```

---

### Task 2: executor 归一化 + Execute 行为

**Files:**
- Create: `internal/executor/settings.go`
- Create: `internal/executor/settings_test.go`
- Modify: `internal/executor/execute.go`
- Modify: `internal/executor/execute_test.go`、`internal/executor/diag_test.go`

**Interfaces:**
- Produces:
  ```go
  type Effective struct {
  	TimeoutMs          int64
  	FollowRedirects    bool
  	MaxRedirects       int
  	InsecureSkipVerify bool
  }
  func EffectiveSettings(s workspace.RequestSettings) (Effective, error)
  // newExecuteTransport(..., insecure bool)
  ```
- Consumes: `workspace.RequestSettings`；现有 `Execute` / `CheckRedirect` / `newExecuteTransport`

- [ ] **Step 1: 写失败测试**

`settings_test.go`：

```go
package executor

import (
	"testing"

	"github.com/zhangyw-cn/httptest/internal/workspace"
)

func TestEffectiveSettingsDefaults(t *testing.T) {
	e, err := EffectiveSettings(workspace.RequestSettings{})
	if err != nil {
		t.Fatal(err)
	}
	if e.TimeoutMs != 30000 || !e.FollowRedirects || e.MaxRedirects != 10 || e.InsecureSkipVerify {
		t.Fatalf("%+v", e)
	}
}

func TestEffectiveSettingsRejectsBadTimeoutAndMax(t *testing.T) {
	zero := int64(0)
	if _, err := EffectiveSettings(workspace.RequestSettings{TimeoutMs: &zero}); err == nil {
		t.Fatal("expected error")
	}
	follow := true
	bad := 0
	if _, err := EffectiveSettings(workspace.RequestSettings{FollowRedirects: &follow, MaxRedirects: &bad}); err == nil {
		t.Fatal("expected error")
	}
}
```

在 `diag_test.go` 把 `Timeout: "50ms"` 改为：

```go
ms := int64(50)
res := Execute(context.Background(), workspace.Request{
	Method: "GET", URL: srv.URL,
	Settings: workspace.RequestSettings{TimeoutMs: &ms},
}, nil, nil)
```

新增不跟随测试（可放 `execute_test.go`）：

```go
func TestExecuteNoFollowRedirects(t *testing.T) {
	n := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n++
		http.Redirect(w, r, "/next", http.StatusFound)
	}))
	defer srv.Close()
	follow := false
	res := Execute(context.Background(), workspace.Request{
		Method: "GET", URL: srv.URL,
		Settings: workspace.RequestSettings{FollowRedirects: &follow},
	}, nil, nil)
	if res.Status != http.StatusFound {
		t.Fatalf("status=%d", res.Status)
	}
	if n != 1 {
		t.Fatalf("hits=%d", n)
	}
	if len(res.Redirects) != 0 {
		t.Fatalf("redirects=%v", res.Redirects)
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `go test ./internal/executor/ -run 'EffectiveSettings|NoFollow|TimeoutClass' -count=1`  
Expected: FAIL

- [ ] **Step 3: 实现 settings + Execute 接线**

`settings.go`：

```go
package executor

import (
	"fmt"

	"github.com/zhangyw-cn/httptest/internal/workspace"
)

type Effective struct {
	TimeoutMs          int64
	FollowRedirects    bool
	MaxRedirects       int
	InsecureSkipVerify bool
}

func EffectiveSettings(s workspace.RequestSettings) (Effective, error) {
	e := Effective{
		TimeoutMs: 30000, FollowRedirects: true, MaxRedirects: 10,
	}
	if s.TimeoutMs != nil {
		if *s.TimeoutMs <= 0 {
			return Effective{}, fmt.Errorf("timeoutMs must be positive")
		}
		e.TimeoutMs = *s.TimeoutMs
	}
	if s.FollowRedirects != nil {
		e.FollowRedirects = *s.FollowRedirects
	}
	if s.MaxRedirects != nil {
		e.MaxRedirects = *s.MaxRedirects
	}
	if s.InsecureSkipVerify != nil {
		e.InsecureSkipVerify = *s.InsecureSkipVerify
	}
	if e.FollowRedirects && (e.MaxRedirects < 1 || e.MaxRedirects > 50) {
		return Effective{}, fmt.Errorf("maxRedirects must be between 1 and 50")
	}
	return e, nil
}
```

`execute.go` 要点：

```go
eff, serr := EffectiveSettings(prepared.Settings)
if serr != nil {
	res.ErrorClass = ClassInvalid
	res.ErrorMessage = serr.Error()
	return res
}
ctx, cancel := context.WithTimeout(ctx, time.Duration(eff.TimeoutMs)*time.Millisecond)
// ...
client := &http.Client{
	Transport: newExecuteTransport(hosts, &lastResolved, eff.InsecureSkipVerify),
	CheckRedirect: func(r *http.Request, via []*http.Request) error {
		if !eff.FollowRedirects {
			return http.ErrUseLastResponse
		}
		if len(via) > eff.MaxRedirects {
			redirectLimit = true
			return http.ErrUseLastResponse
		}
		// 现有 hop 记录逻辑不变
		return nil
	},
}
// redirectLimit 文案：
res.ErrorMessage = fmt.Sprintf("redirect limit reached (%d)", eff.MaxRedirects)
```

`newExecuteTransport`：Clone 后若 `insecure`，设置 `TLSClientConfig`（Clone 或新建）`InsecureSkipVerify = true`。

- [ ] **Step 4: 运行确认通过**

Run: `go test ./internal/executor/ -count=1`  
Expected: PASS（一并修所有仍引用 `Request.Timeout` 的测试）

- [ ] **Step 5: Commit**

```bash
git add internal/executor/
git commit -m "$(cat <<'EOF'
feat(executor): apply per-request timeout, redirects, and insecure TLS.

EOF
)"
```

---

### Task 3: Prepare 拷贝 Settings + PrepareResult 超时派生

**Files:**
- Modify: `internal/executor/prepare.go`
- Modify: `internal/executor/prepare_result.go`
- Modify: `internal/executor/prepare_result_test.go`
- Modify: `internal/server/prepare_test.go`

**Interfaces:**
- Produces: `Prepare` 输出含 `Settings`；`EffectiveTimeoutSeconds` 改为从 `RequestSettings` 取 ms → seconds；`BuildPrepareResult` 在 settings 非法时 `invalid`
- Consumes: `EffectiveSettings`

- [ ] **Step 1: 写/改失败测试**

```go
func TestEffectiveTimeoutSecondsFromSettings(t *testing.T) {
	s, err := EffectiveTimeoutSeconds(workspace.RequestSettings{})
	if err != nil || s != 30 {
		t.Fatalf("%v %v", s, err)
	}
	ms := int64(500)
	s, err = EffectiveTimeoutSeconds(workspace.RequestSettings{TimeoutMs: &ms})
	if err != nil || s != 0.5 {
		t.Fatalf("%v %v", s, err)
	}
}
```

删除旧的字符串 duration 测例。`TestPrepareInvalidTimeout`：用 `TimeoutMs: ptr(-1)` 或 `0`。

- [ ] **Step 2: 运行确认失败**

Run: `go test ./internal/executor/ ./internal/server/ -run 'EffectiveTimeout|PrepareInvalid|BuildPrepare' -count=1`  
Expected: FAIL

- [ ] **Step 3: 实现**

`prepare.go`：`out.Settings = req.Settings`（不展开变量）。

`prepare_result.go`：

```go
func EffectiveTimeoutSeconds(s workspace.RequestSettings) (float64, error) {
	eff, err := EffectiveSettings(s)
	if err != nil {
		return 0, err
	}
	return float64(eff.TimeoutMs) / 1000.0, nil
}
// BuildPrepareResult: sec, terr := EffectiveTimeoutSeconds(prepared.Settings)
```

- [ ] **Step 4: 运行确认通过**

Run: `go test ./internal/executor/ ./internal/server/ -count=1`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/executor/prepare.go internal/executor/prepare_result.go internal/executor/prepare_result_test.go internal/server/prepare_test.go
git commit -m "$(cat <<'EOF'
feat(executor): derive prepare timeoutSeconds from settings.timeoutMs.

EOF
)"
```

---

### Task 4: 前端类型与 normalizeRequest

**Files:**
- Modify: `web/src/types.ts`
- Modify: `web/src/request.ts`
- Modify: `web/src/request.test.ts`（若无则创建）

**Interfaces:**
- Produces:
  ```ts
  export interface RequestSettings {
    timeoutMs?: number;
    followRedirects?: boolean;
    maxRedirects?: number;
    insecureSkipVerify?: boolean;
  }
  // HttpRequest.settings?: RequestSettings; 无 timeout?: string
  export function compactSettings(s: RequestSettings | undefined): RequestSettings | undefined
  ```
- Consumes: 现有 `normalizeRequest` / `defaultDraft`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "vitest";
import { compactSettings, normalizeRequest } from "./request";

describe("normalizeRequest settings", () => {
  it("copies settings and drops legacy timeout", () => {
    const n = normalizeRequest({
      name: "a",
      method: "GET",
      url: "http://h",
      query: {},
      headers: {},
      body: { type: "none" },
      settings: { timeoutMs: 1000, followRedirects: false },
      // @ts-expect-error legacy
      timeout: "30s",
    } as never);
    expect(n.settings).toEqual({ timeoutMs: 1000, followRedirects: false });
    expect((n as { timeout?: string }).timeout).toBeUndefined();
  });
});

describe("compactSettings", () => {
  it("omits product defaults", () => {
    expect(
      compactSettings({
        timeoutMs: 30000,
        followRedirects: true,
        maxRedirects: 10,
        insecureSkipVerify: false,
      }),
    ).toBeUndefined();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd web && npm test -- --run src/request.test.ts`  
Expected: FAIL

- [ ] **Step 3: 实现**

`types.ts`：用 `settings?: RequestSettings` 替换 `timeout?: string`。

`request.ts`：

```ts
export function compactSettings(
  s: RequestSettings | undefined,
): RequestSettings | undefined {
  if (!s) return undefined;
  const out: RequestSettings = {};
  if (s.timeoutMs !== undefined && s.timeoutMs !== 30000) out.timeoutMs = s.timeoutMs;
  if (s.followRedirects === false) out.followRedirects = false;
  if (s.maxRedirects !== undefined && s.maxRedirects !== 10) out.maxRedirects = s.maxRedirects;
  if (s.insecureSkipVerify === true) out.insecureSkipVerify = true;
  return Object.keys(out).length ? out : undefined;
}

export function normalizeRequest(r: HttpRequest): HttpRequest {
  const next: HttpRequest = {
    name: r.name ?? "",
    method: r.method || "GET",
    url: r.url ?? "",
    query: r.query ?? {},
    headers: r.headers ?? {},
    body: r.body ?? { type: "none" },
  };
  const settings = compactSettings(r.settings);
  if (settings) next.settings = settings;
  return next;
}
```

全仓 `web/` 去掉对 `timeout` 字符串字段的引用（本 Task 能改的纯函数先改；App/curl 留给后续 Task，若类型报错可临时 `as any` **禁止**——应在本 Task 或 Task 5/6 一并修到编译通过）。

- [ ] **Step 4: 运行确认通过**

Run: `cd web && npm test -- --run src/request.test.ts`  
Expected: PASS  
另：`cd web && npx tsc -b --pretty false` 若因 curl/App 未改而失败，本 Task 至少保证 `request.ts` 测过；Task 6 前必须全绿。

- [ ] **Step 5: Commit**

```bash
git add web/src/types.ts web/src/request.ts web/src/request.test.ts
git commit -m "$(cat <<'EOF'
feat(web): model request settings and compact defaults.

EOF
)"
```

---

### Task 5: RequestEditor「请求设置」页签

**Files:**
- Modify: `web/src/RequestEditor.tsx`
- Create 或 Modify: `web/src/RequestEditor.test.tsx`（若项目已有编辑器测则跟现有模式）
- Modify: `web/src/styles` / 相关 CSS（若需 `.settings-pane` 间距，跟现有 `env-label` 风格即可）

**Interfaces:**
- Consumes: `HttpRequest.settings`、`compactSettings`（编辑态展示有效值，onChange 写回时可 compact 或保留显式值；**推荐**：控件显示有效默认，onChange 写入完整草稿 settings，Save 路径再 `normalizeRequest`→`compactSettings`）
- Produces: 页签 `settings`；跟随关时禁用最大次数

- [ ] **Step 1: 写失败测试（组件）**

若用 Vitest + Testing Library（与 `ExportCurlDialog.test.tsx` 同）：

```tsx
it("shows 请求设置 tab and disables max when follow off", () => {
  const onChange = vi.fn();
  render(
    <RequestEditor
      draft={{
        ...defaultDraft(),
        settings: { followRedirects: false, maxRedirects: 5 },
      }}
      onChange={onChange}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "请求设置" }));
  const max = screen.getByLabelText("最大重定向次数") as HTMLInputElement;
  expect(max.disabled).toBe(true);
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd web && npm test -- --run src/RequestEditor.test.tsx`  
Expected: FAIL

- [ ] **Step 3: 实现 UI**

扩展 `tab` 类型为 `"query" | "headers" | "body" | "settings"`。增加第四按钮「请求设置」。

面板字段（中文 label + `htmlFor`/`aria`）：

- 超时 (ms)：`type="number"`；空字符串 → `onChange` 时删掉 `timeoutMs`
- 跟随重定向：checkbox
- 最大重定向次数：`number` min=1 max=50；`disabled={!follow}`
- 跳过 TLS 校验：checkbox；勾选时旁注警告文案

有效值读取辅助：

```ts
function effectiveFollow(s?: RequestSettings): boolean {
  return s?.followRedirects !== false;
}
function effectiveTimeoutMs(s?: RequestSettings): number {
  return s?.timeoutMs ?? 30000;
}
function effectiveMax(s?: RequestSettings): number {
  return s?.maxRedirects ?? 10;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd web && npm test -- --run src/RequestEditor.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/RequestEditor.tsx web/src/RequestEditor.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add request settings editor tab.

EOF
)"
```

---

### Task 6: curl 导入/导出对齐 settings

**Files:**
- Modify: `web/src/curl.ts`
- Modify: `web/src/curl.test.ts`
- Modify: `web/src/ExportCurlDialog.tsx`
- Modify: `web/src/ExportCurlDialog.test.tsx`
- Modify: `web/src/App.tsx`（若仍传旧 timeout 字段）

**Interfaces:**
- Produces: `CurlOptions` 增加 `insecure`、`maxRedirects`（bool，是否带 `--max-redirs`）；`parseCurl` 写入 `settings`；`formatCurl` 读 `prepared.settings` + options
- Consumes: `RequestSettings`、`timeoutSeconds`（仍由 prepare 派生）

- [ ] **Step 1: 写失败测试**

```ts
it("maps -L -k --max-redirs and -m into settings", () => {
  const r = parseCurl(
    `curl -L -k --max-redirs 3 -m 1.5 https://example.com`,
  );
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.request.settings).toEqual({
    followRedirects: true,
    insecureSkipVerify: true,
    maxRedirects: 3,
    timeoutMs: 1500,
  });
});

it("does not set followRedirects false when -L absent", () => {
  const r = parseCurl(`curl https://example.com`);
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.request.settings?.followRedirects).toBeUndefined();
});
```

更新所有 `timeout: "…"` / `request.timeout` 断言为 `settings.timeoutMs`。  
`formatCurl`：当 options 打开时输出 `-k`、`--max-redirs N`。

从 `IGNORE_NO_ARG` **移除** `-L` / `--location`（改为映射）。新增处理 `-k`、`--insecure`、`--max-redirs`。

- [ ] **Step 2: 运行确认失败**

Run: `cd web && npm test -- --run src/curl.test.ts`  
Expected: FAIL

- [ ] **Step 3: 实现 parse/format + 对话框**

`parseCurl` 局部变量改为累积 `Partial<RequestSettings>`；`--max-time` → `timeoutMs = Math.round(n * 1000)`；`--max-redirs` 解析整数且 ∈[1,50] 否则 fail。

`applyParsedCurl`：替换 `settings`（无则不设 / 清除旧 settings 中由 curl 覆盖的语义——规格：整体替换 settings 为解析结果；无相关 flag 则 `settings` 可为 undefined）。

`defaultCurlOptions`：

```ts
return {
  useResolve: true,
  followRedirects: true,
  maxRedirects: true,
  maxTime: true,
  insecure: false,
};
```

导出对话框增加「跳过 TLS 校验」「限制最大重定向」勾选；提示文案改为默认 30000ms。

`formatCurl`：若 `options.followRedirects` → `-L`；若 follow 且 `options.maxRedirects` → `--max-redirs ${prepared.settings?.maxRedirects ?? 10}`；若 `options.insecure` → `-k`。

- [ ] **Step 4: 运行确认通过**

Run: `cd web && npm test -- --run`  
Expected: PASS  
Run: `cd web && npx tsc -b --pretty false`  
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add web/src/curl.ts web/src/curl.test.ts web/src/ExportCurlDialog.tsx web/src/ExportCurlDialog.test.tsx web/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(web): map curl -L/-k/--max-redirs/--max-time to request settings.

EOF
)"
```

---

### Task 7: README + 全量回归

**Files:**
- Modify: `README.md`
- 必要时：仍引用旧 `Timeout` 的 Go/前端测例夹具

- [ ] **Step 1: 更新 README**

「请求文件」示例改为：

```yaml
settings:
  timeoutMs: 30000   # 可选，默认 30000
  followRedirects: true
  maxRedirects: 10
  insecureSkipVerify: false
```

说明破坏性：顶层 `timeout` 不再支持。  
「v1 明确不做」删除跳过 TLS、关闭跟随重定向；注明跟随可关、次数默认 10 上限 50。  
界面节：请求栏含「请求设置」。

- [ ] **Step 2: 全量测试**

```bash
go test ./... -count=1
cd web && npm test -- --run
cd web && npm run build
```

Expected: 全部 PASS / build OK

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: document request-level settings and breaking timeout change.

EOF
)"
```

---

## Spec coverage (self-review)

| 规格项 | Task |
|--------|------|
| `settings` 四字段 + 默认 | 1, 2 |
| 拒顶层/`settings.timeout` | 1 |
| Compact 落盘 | 1, 4 |
| UI 请求设置 + ms + 警告 | 5 |
| Execute 超时/重定向/insecure | 2 |
| Prepare/timeoutSeconds | 3 |
| curl 导入导出 | 6 |
| README / 非目标 | 7 |
| maxRedirects 1–50 | 2, 6 |
| 无 `-L` 不写 false | 6 |

无 TBD；类型名 `RequestSettings` / `timeoutMs` / `EffectiveSettings` 前后一致。
