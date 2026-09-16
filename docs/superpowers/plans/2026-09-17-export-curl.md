# 导出 curl Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 UrlBar Send 旁提供「导出 curl」：经 `POST /api/prepare` 得到与 Send 一致的展开请求，对话框用功能勾选 + 只读预览生成并复制 curl。

**Architecture:** Go 侧新增 `PrepareResult`（Prepare + Hosts resolve 候选 + timeoutSeconds，不发网、不写历史）；前端纯函数 `formatCurl` 按勾选拼命令；`ExportCurlDialog` 展示功能与预览；`App` 编排失败写结果区、成功开对话框。

**Tech Stack:** Go 1.22；React + TypeScript + Vite + 手写 CSS；Vitest；无新 npm 依赖。

## Global Constraints

- 规格：`docs/superpowers/specs/2026-09-17-export-curl-design.md`
- 数据源：当前草稿 + 顶栏环境/覆盖/Hosts；展开与 Send 的 `prepared` 同形
- 缺变量等业务失败：不弹窗，结果区同 Send；prepare 不写 history、不登记 cancel
- 对话框：功能勾选（Hosts 解析 / 跟随重定向 / 限制超时，默认全开）+ 只读 curl 预览 + 复制
- 无命中 Hosts 时「使用当前 Hosts 解析」禁用；界面中文；不新增 npm 包
- 改前端后 `cd web && npm run build` 更新 `internal/server/ui/` embed

## File Structure

| 路径 | 职责 |
|------|------|
| `internal/executor/prepare_result.go` | `ResolveSpec`、`PrepareResult`、`BuildPrepareResult`、`LookupResolve`、`EffectiveTimeoutSeconds` |
| `internal/executor/prepare_result_test.go` | resolve / timeout / missing vars / invalid |
| `internal/server/prepare.go` | `handlePrepare` |
| `internal/server/server.go` | 注册 `POST /api/prepare` |
| `internal/server/prepare_test.go` | API：缺变量、成功 resolve、无 history、非法 timeout |
| `web/src/types.ts` | `ResolveSpec`、`PrepareResponse` |
| `web/src/api.ts` | `prepare(request)` |
| `web/src/curl.ts` | `CurlOptions`、`defaultCurlOptions`、`shellSingleQuote`、`formatCurl` |
| `web/src/curl.test.ts` | formatCurl 测例 |
| `web/src/UrlBar.tsx` | Send split + 下拉「导出 curl」 |
| `web/src/UrlBar.test.tsx` | 下拉触发回调；sending 禁用 |
| `web/src/ExportCurlDialog.tsx` | 勾选 + 预览 + 复制 |
| `web/src/ExportCurlDialog.test.tsx` | 勾选切换更新预览 |
| `web/src/App.tsx` | `onExportCurl` 编排 |
| `web/src/work-layout.test.tsx` | UrlBar 新 props |
| `web/src/styles.css` | split / 导出对话框样式 |
| `README.md` | 界面节补一句 |

---

### Task 1: executor BuildPrepareResult

**Files:**
- Create: `internal/executor/prepare_result.go`
- Create: `internal/executor/prepare_result_test.go`

**Interfaces:**
- Produces:
  - `type ResolveSpec struct { Host, Port, IP string }` JSON `host`/`port`/`ip`
  - `type PrepareResult struct { Prepared workspace.Request; Resolve *ResolveSpec; TimeoutSeconds float64; ErrorClass ErrorClass; ErrorMessage string; MissingVars []string }`
  - `func LookupResolve(rawURL string, mappings map[string]string) *ResolveSpec`
  - `func EffectiveTimeoutSeconds(timeout string) (float64, error)` — 空→30；非法→error
  - `func BuildPrepareResult(req workspace.Request, vars, mappings map[string]string) PrepareResult`
- Consumes: 已有 `Prepare`、`mapDialAddress` 同源规则（hostname 小写精确匹配；IP 字面量不命中；默认 port http=80 https=443）

- [ ] **Step 1: 写失败测试**

```go
package executor

import (
	"testing"

	"github.com/zhangyw-cn/httptest/internal/workspace"
)

func TestLookupResolveHit(t *testing.T) {
	r := LookupResolve("https://API.Example.com/v1", map[string]string{"api.example.com": "10.0.0.5"})
	if r == nil || r.Host != "api.example.com" || r.Port != "443" || r.IP != "10.0.0.5" {
		t.Fatalf("%+v", r)
	}
}

func TestLookupResolveMiss(t *testing.T) {
	if LookupResolve("http://other.com/", map[string]string{"api.com": "1.1.1.1"}) != nil {
		t.Fatal("expected nil")
	}
}

func TestEffectiveTimeoutSeconds(t *testing.T) {
	s, err := EffectiveTimeoutSeconds("")
	if err != nil || s != 30 {
		t.Fatalf("%v %v", s, err)
	}
	s, err = EffectiveTimeoutSeconds("500ms")
	if err != nil || s != 0.5 {
		t.Fatalf("%v %v", s, err)
	}
	if _, err := EffectiveTimeoutSeconds("nope"); err == nil {
		t.Fatal("expected error")
	}
}

func TestBuildPrepareResultMissingVars(t *testing.T) {
	res := BuildPrepareResult(workspace.Request{
		Method: "GET",
		URL:    "{{base}}/x",
	}, nil, nil)
	if res.ErrorClass != ClassInvalid || len(res.MissingVars) == 0 {
		t.Fatalf("%+v", res)
	}
}

func TestBuildPrepareResultOK(t *testing.T) {
	res := BuildPrepareResult(workspace.Request{
		Method: "GET",
		URL:    "http://api.local/ping",
	}, nil, map[string]string{"api.local": "127.0.0.1"})
	if res.ErrorClass != "" || res.Prepared.URL != "http://api.local/ping" {
		t.Fatalf("%+v", res)
	}
	if res.Resolve == nil || res.Resolve.IP != "127.0.0.1" || res.Resolve.Port != "80" {
		t.Fatalf("resolve=%+v", res.Resolve)
	}
	if res.TimeoutSeconds != 30 {
		t.Fatalf("timeout=%v", res.TimeoutSeconds)
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `go test ./internal/executor/ -run 'LookupResolve|EffectiveTimeout|BuildPrepareResult' -count=1`  
Expected: FAIL（undefined）

- [ ] **Step 3: 最小实现**

`prepare_result.go`：

```go
package executor

import (
	"net"
	"net/url"
	"strings"
	"time"

	"github.com/zhangyw-cn/httptest/internal/workspace"
)

type ResolveSpec struct {
	Host string `json:"host"`
	Port string `json:"port"`
	IP   string `json:"ip"`
}

type PrepareResult struct {
	Prepared       workspace.Request `json:"prepared"`
	Resolve        *ResolveSpec      `json:"resolve,omitempty"`
	TimeoutSeconds float64           `json:"timeoutSeconds,omitempty"`
	ErrorClass     ErrorClass        `json:"errorClass"`
	ErrorMessage   string            `json:"errorMessage"`
	MissingVars    []string          `json:"missingVars,omitempty"`
}

func EffectiveTimeoutSeconds(timeout string) (float64, error) {
	if strings.TrimSpace(timeout) == "" {
		return 30, nil
	}
	d, err := time.ParseDuration(timeout)
	if err != nil {
		return 0, err
	}
	return d.Seconds(), nil
}

func LookupResolve(rawURL string, mappings map[string]string) *ResolveSpec {
	if len(mappings) == 0 {
		return nil
	}
	u, err := url.Parse(rawURL)
	if err != nil || u.Hostname() == "" {
		return nil
	}
	host := u.Hostname()
	if net.ParseIP(host) != nil {
		return nil
	}
	key := strings.ToLower(host)
	ip, ok := mappings[key]
	if !ok {
		return nil
	}
	port := u.Port()
	if port == "" {
		if u.Scheme == "https" {
			port = "443"
		} else {
			port = "80"
		}
	}
	return &ResolveSpec{Host: key, Port: port, IP: ip}
}

func BuildPrepareResult(req workspace.Request, vars, mappings map[string]string) PrepareResult {
	prepared, missing, err := Prepare(req, vars)
	out := PrepareResult{Prepared: prepared}
	if err != nil {
		out.ErrorClass = ClassInvalid
		out.ErrorMessage = err.Error()
		return out
	}
	if len(missing) > 0 {
		out.ErrorClass = ClassInvalid
		out.MissingVars = missing
		return out
	}
	sec, terr := EffectiveTimeoutSeconds(prepared.Timeout)
	if terr != nil {
		out.ErrorClass = ClassInvalid
		out.ErrorMessage = terr.Error()
		return out
	}
	out.TimeoutSeconds = sec
	out.Resolve = LookupResolve(prepared.URL, mappings)
	return out
}
```

注意：`mappings` 的 key 在 workspace 侧已小写；`LookupResolve` 用 `strings.ToLower(host)` 查找。

- [ ] **Step 4: 运行确认通过**

Run: `go test ./internal/executor/ -run 'LookupResolve|EffectiveTimeout|BuildPrepareResult' -count=1`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/executor/prepare_result.go internal/executor/prepare_result_test.go
git commit -m "$(cat <<'EOF'
feat(executor): BuildPrepareResult for curl export.

EOF
)"
```

---

### Task 2: POST /api/prepare

**Files:**
- Create: `internal/server/prepare.go`
- Create: `internal/server/prepare_test.go`
- Modify: `internal/server/server.go`（在 `POST /api/execute` 旁注册路由）

**Interfaces:**
- Consumes: `executor.BuildPrepareResult`；`ws.ResolvedVars`；`ws.ActiveHostsMappings`；覆盖缺失时与 `handleExecute` 相同返回 `ErrorClass=invalid`
- Produces: `POST /api/prepare` → JSON `PrepareResult`；不写 history

- [ ] **Step 1: 写失败测试**

```go
package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/zhangyw-cn/httptest/internal/executor"
	"github.com/zhangyw-cn/httptest/internal/workspace"
)

func TestPrepareMissingVars(t *testing.T) {
	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)
	payload, _ := json.Marshal(map[string]any{
		"request": workspace.Request{Method: "GET", URL: "{{base}}/x"},
	})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/prepare", payload))
	if rr.Code != 200 {
		t.Fatalf("%d %s", rr.Code, rr.Body.Bytes())
	}
	var res executor.PrepareResult
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if res.ErrorClass != executor.ClassInvalid || len(res.MissingVars) == 0 {
		t.Fatalf("%+v", res)
	}
}

func TestPrepareResolveNoHistory(t *testing.T) {
	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutHosts(workspace.HostsFile{
		Name:     "lan",
		Type:     workspace.HostsTypeMap,
		Mappings: map[string]string{"api.local": "10.0.0.9"},
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutLocal(workspace.Local{Hosts: "lan"}); err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)
	payload, _ := json.Marshal(map[string]any{
		"request": workspace.Request{Method: "GET", URL: "http://api.local/p"},
	})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/prepare", payload))
	if rr.Code != 200 {
		t.Fatalf("%d %s", rr.Code, rr.Body.Bytes())
	}
	var res executor.PrepareResult
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if res.ErrorClass != "" || res.Resolve == nil || res.Resolve.IP != "10.0.0.9" {
		t.Fatalf("%+v", res)
	}
	entries, err := ws.ListHistory(10)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 0 {
		t.Fatalf("history should stay empty, got %d", len(entries))
	}
}

func TestPrepareInvalidTimeout(t *testing.T) {
	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)
	payload, _ := json.Marshal(map[string]any{
		"request": workspace.Request{Method: "GET", URL: "http://h/", Timeout: "bogus"},
	})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/prepare", payload))
	var res executor.PrepareResult
	_ = json.Unmarshal(rr.Body.Bytes(), &res)
	if res.ErrorClass != executor.ClassInvalid {
		t.Fatalf("%+v", res)
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `go test ./internal/server/ -run Prepare -count=1`  
Expected: FAIL（404 或未注册）

- [ ] **Step 3: 实现 handler 与路由**

`prepare.go`：

```go
package server

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/zhangyw-cn/httptest/internal/executor"
	"github.com/zhangyw-cn/httptest/internal/workspace"
)

func (s *server) handlePrepare(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Request workspace.Request `json:"request"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	vars, err := s.ws.ResolvedVars()
	if err != nil {
		if errors.Is(err, workspace.ErrOverrideNotFound) {
			writeJSON(w, http.StatusOK, executor.PrepareResult{
				ErrorClass:   executor.ClassInvalid,
				ErrorMessage: err.Error(),
				Prepared:     body.Request,
			})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	mappings, err := s.ws.ActiveHostsMappings()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, executor.BuildPrepareResult(body.Request, vars, mappings))
}
```

在 `server.go` 的 `New` 中增加：

```go
mux.HandleFunc("POST /api/prepare", s.handlePrepare)
```

- [ ] **Step 4: 运行确认通过**

Run: `go test ./internal/server/ -run Prepare -count=1`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/server/prepare.go internal/server/prepare_test.go internal/server/server.go
git commit -m "$(cat <<'EOF'
feat(server): add POST /api/prepare for curl export.

EOF
)"
```

---

### Task 3: formatCurl 纯函数

**Files:**
- Create: `web/src/curl.ts`
- Create: `web/src/curl.test.ts`

**Interfaces:**
- Produces:
  - `export interface CurlOptions { useResolve: boolean; followRedirects: boolean; maxTime: boolean }`
  - `export function defaultCurlOptions(): CurlOptions` → 全 `true`
  - `export function shellSingleQuote(s: string): string`
  - `export function formatCurl(input: { prepared: HttpRequest; resolve?: ResolveSpec | null; timeoutSeconds: number; options: CurlOptions }): string`
- Consumes: Task 4 前可先在 `curl.ts` 内联最小 `ResolveSpec` 类型，或先做 Task 4 的 types；推荐本任务在 `curl.ts` 定义本地 `export interface CurlResolve { host: string; port: string; ip: string }`，Task 4 再与 `types.ts` 对齐为同一形状（或直接 import 即将加入的 types——若并行困难，本任务自含 `CurlResolve`，Task 4 用同形 `ResolveSpec`）。

**约定（必须写进实现）：**
- 续行：` \\\n`（反斜杠+换行）
- query 合并进 URL（`URL` + `searchParams`）
- 无用户 CT 时 json→`application/json`，form→`application/x-www-form-urlencoded`
- 无用户 UA → `httptest/0.1`
- GET/HEAD 无 `--data-raw`
- form：`URLSearchParams` encode 后 `--data-raw`
- `useResolve && resolve` → `--resolve host:port:ip`
- `followRedirects` → `-L`
- `maxTime` → `--max-time <n>`（整数不写小数点；否则必要小数）

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "vitest";
import { formatCurl, shellSingleQuote, defaultCurlOptions } from "./curl";
import type { HttpRequest } from "./types";

function base(partial: Partial<HttpRequest> = {}): HttpRequest {
  return {
    name: "",
    method: "GET",
    url: "http://example.com/a",
    query: {},
    headers: {},
    body: { type: "none" },
    ...partial,
  };
}

describe("shellSingleQuote", () => {
  it("escapes single quotes", () => {
    expect(shellSingleQuote("a'b")).toBe("'a'\\''b'");
  });
});

describe("formatCurl", () => {
  it("builds GET with defaults", () => {
    const s = formatCurl({
      prepared: base(),
      timeoutSeconds: 30,
      options: defaultCurlOptions(),
    });
    expect(s).toContain("curl");
    expect(s).toContain("-L");
    expect(s).toContain("--max-time 30");
    expect(s).toContain("-X GET");
    expect(s).toContain("'http://example.com/a'");
    expect(s).toContain("User-Agent: httptest/0.1");
  });

  it("merges query and posts json", () => {
    const s = formatCurl({
      prepared: base({
        method: "POST",
        query: { q: "1" },
        body: { type: "json", content: `{"a":1}` },
      }),
      timeoutSeconds: 30,
      options: { useResolve: false, followRedirects: false, maxTime: false },
    });
    expect(s).not.toContain("-L");
    expect(s).not.toContain("--max-time");
    expect(s).toContain("q=1");
    expect(s).toContain("Content-Type: application/json");
    expect(s).toContain("--data-raw");
    expect(s).toContain(`'{"a":1}'`);
  });

  it("adds --resolve when enabled", () => {
    const s = formatCurl({
      prepared: base({ url: "http://api.local/" }),
      resolve: { host: "api.local", port: "80", ip: "10.0.0.1" },
      timeoutSeconds: 30,
      options: { ...defaultCurlOptions(), followRedirects: false, maxTime: false },
    });
    expect(s).toContain("--resolve 'api.local:80:10.0.0.1'");
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd web && npm test -- src/curl.test.ts`  
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 `curl.ts`**

实现须覆盖：header 大小写不敏感检测 Content-Type / User-Agent；`body.type === "form"` 且 content 为对象时 encode；headers 键排序可选（为测例稳定可按键名 sort）。

`formatCurl` 伪结构：

```ts
export function formatCurl(...): string {
  const parts: string[] = ["curl"];
  if (options.followRedirects) parts.push("-L");
  if (options.maxTime) parts.push(`--max-time ${formatSeconds(timeoutSeconds)}`);
  if (options.useResolve && resolve) {
    parts.push(`--resolve ${shellSingleQuote(`${resolve.host}:${resolve.port}:${resolve.ip}`)}`);
  }
  parts.push(`-X ${prepared.method}`);
  parts.push(shellSingleQuote(urlWithQuery(prepared)));
  // headers including defaults...
  // body...
  return parts.join(" \\\n  ");
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd web && npm test -- src/curl.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/curl.ts web/src/curl.test.ts
git commit -m "$(cat <<'EOF'
feat(web): formatCurl for export preview.

EOF
)"
```

---

### Task 4: types + api.prepare

**Files:**
- Modify: `web/src/types.ts`
- Modify: `web/src/api.ts`

**Interfaces:**
- Produces:
  - `export interface ResolveSpec { host: string; port: string; ip: string }`
  - `export interface PrepareResponse { prepared: HttpRequest; resolve?: ResolveSpec; timeoutSeconds?: number; errorClass: ErrorClass | ""; errorMessage: string; missingVars?: string[] }`
  - `export async function prepare(request: HttpRequest): Promise<PrepareResponse>`
- 若 Task 3 用了本地 resolve 类型，将 `curl.ts` 改为从 `types` import `ResolveSpec`

- [ ] **Step 1: 扩展 types**

在 `types.ts` 的 `Result` 附近加入：

```ts
export interface ResolveSpec {
  host: string;
  port: string;
  ip: string;
}

export interface PrepareResponse {
  prepared: HttpRequest;
  resolve?: ResolveSpec;
  timeoutSeconds?: number;
  errorClass: ErrorClass | "";
  errorMessage: string;
  missingVars?: string[];
}
```

- [ ] **Step 2: 实现 api.prepare**

```ts
export async function prepare(request: HttpRequest): Promise<PrepareResponse> {
  const res = await fetch("/api/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request }),
  });
  return parseJSON<PrepareResponse>(res);
}
```

- [ ] **Step 3: 对齐 curl.ts import（若需要）并跑测**

Run: `cd web && npm test -- src/curl.test.ts`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add web/src/types.ts web/src/api.ts web/src/curl.ts
git commit -m "$(cat <<'EOF'
feat(web): prepare API client and ResolveSpec types.

EOF
)"
```

---

### Task 5: UrlBar Send split + 导出入口

**Files:**
- Modify: `web/src/UrlBar.tsx`
- Create: `web/src/UrlBar.test.tsx`
- Modify: `web/src/work-layout.test.tsx`（补 `onExportCurl={vi.fn()}`）
- Modify: `web/src/styles.css`（`.send-split` 等）

**Interfaces:**
- Consumes: 无
- Produces: `UrlBar` props 增加 `onExportCurl: () => void`；sending 时禁用下拉与菜单项

- [ ] **Step 1: 写失败测试**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import UrlBar from "./UrlBar";
import { defaultDraft } from "./request";

describe("UrlBar export curl", () => {
  it("renders export menu control", () => {
    const markup = renderToStaticMarkup(
      <UrlBar
        draft={defaultDraft()}
        dirty={false}
        sending={false}
        saving={false}
        onChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
        onSave={vi.fn()}
        onExportCurl={vi.fn()}
      />,
    );
    expect(markup).toContain("导出 curl");
  });

  it("disables export while sending", () => {
    const markup = renderToStaticMarkup(
      <UrlBar
        draft={defaultDraft()}
        dirty={false}
        sending={true}
        saving={false}
        onChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
        onSave={vi.fn()}
        onExportCurl={vi.fn()}
      />,
    );
    expect(markup).toMatch(/导出 curl[\s\S]*disabled|disabled[\s\S]*导出 curl/);
  });
});
```

（若用 `<details>`/`<button>` 结构，按实际 DOM 调整断言；关键：出现「导出 curl」，sending 时触发控件 disabled。）

- [ ] **Step 2: 运行确认失败**

Run: `cd web && npm test -- src/UrlBar.test.ts`  
Expected: FAIL（缺 prop / 无文案）

- [ ] **Step 3: 实现 split UI**

在 Send 与 Stop 之间插入 split 组：

```tsx
<div className="send-split">
  <button type="button" className="btn btn-primary" onClick={onSend} disabled={sending}>
    Send
  </button>
  <details className="send-menu">
    <summary className="btn btn-primary send-menu-toggle" disabled={sending} aria-label="Send 菜单">
      ▾
    </summary>
    <div className="send-menu-panel" role="menu">
      <button type="button" role="menuitem" disabled={sending} onClick={onExportCurl}>
        导出 curl
      </button>
    </div>
  </details>
</div>
```

注意：原生 `<summary>` 无 `disabled`；sending 时用 `pointer-events`/`aria-disabled` 或改为 button+状态菜单。推荐：toggle 为 `<button type="button">`，用 React state `menuOpen` 控制面板，sending 时 `disabled`。

CSS：`.send-split { display: inline-flex; }`；主按钮右圆角收掉、菜单钮左圆角收掉，视觉连成一组。

更新所有 `UrlBar` 调用点（`App.tsx` 可先传 `onExportCurl={() => {}}`，Task 6 接真逻辑；`work-layout.test.tsx` 必补 prop）。

- [ ] **Step 4: 运行确认通过**

Run: `cd web && npm test -- src/UrlBar.test.ts src/work-layout.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/UrlBar.tsx web/src/UrlBar.test.tsx web/src/work-layout.test.tsx web/src/styles.css web/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(web): Send split menu with export curl entry.

EOF
)"
```

---

### Task 6: ExportCurlDialog

**Files:**
- Create: `web/src/ExportCurlDialog.tsx`
- Create: `web/src/ExportCurlDialog.test.tsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes: `formatCurl`、`defaultCurlOptions`、`HttpRequest`、`ResolveSpec`
- Produces:
  ```ts
  export default function ExportCurlDialog(props: {
    prepared: HttpRequest;
    resolve?: ResolveSpec;
    timeoutSeconds: number;
    onClose: () => void;
  }): JSX.Element
  ```

- [ ] **Step 1: 写失败测试**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ExportCurlDialog from "./ExportCurlDialog";

describe("ExportCurlDialog", () => {
  it("shows feature toggles and curl preview", () => {
    const markup = renderToStaticMarkup(
      <ExportCurlDialog
        prepared={{
          name: "",
          method: "GET",
          url: "http://example.com/",
          query: {},
          headers: {},
          body: { type: "none" },
        }}
        timeoutSeconds={30}
        onClose={vi.fn()}
      />,
    );
    expect(markup).toContain("导出 curl");
    expect(markup).toContain("使用当前 Hosts 解析");
    expect(markup).toContain("跟随重定向");
    expect(markup).toContain("限制超时");
    expect(markup).toContain("curl");
    expect(markup).toContain("复制到剪贴板");
  });

  it("disables hosts toggle without resolve", () => {
    const markup = renderToStaticMarkup(
      <ExportCurlDialog
        prepared={{
          name: "",
          method: "GET",
          url: "http://example.com/",
          query: {},
          headers: {},
          body: { type: "none" },
        }}
        timeoutSeconds={30}
        onClose={vi.fn()}
      />,
    );
    expect(markup).toContain("当前 Hosts 未命中此主机");
  });
});
```

勾选切换更新预览：SSR 无法点选；另写纯函数测例已在 Task 3 覆盖。若需交互测，可用 vitest + 手动调用内部 `formatCurl` 断言即可，本对话框测静态结构。

- [ ] **Step 2: 运行确认失败**

Run: `cd web && npm test -- src/ExportCurlDialog.test.tsx`  
Expected: FAIL

- [ ] **Step 3: 实现对话框**

- 复用 `.dialog-backdrop` / `.dialog` 样式
- state：`options = defaultCurlOptions()`；无 `resolve` 时 `useResolve` 强制视为 false 且 checkbox disabled
- `preview = formatCurl({ prepared, resolve, timeoutSeconds, options: { ...options, useResolve: options.useResolve && !!resolve } })`
- 复制：`navigator.clipboard.writeText(preview)`；成功设 `copied` 短暂后 `onClose()`；catch 显示「复制失败」
- 无 clipboard API 时同样提示失败

- [ ] **Step 4: 运行确认通过**

Run: `cd web && npm test -- src/ExportCurlDialog.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/ExportCurlDialog.tsx web/src/ExportCurlDialog.test.tsx web/src/styles.css
git commit -m "$(cat <<'EOF'
feat(web): ExportCurlDialog with options and preview.

EOF
)"
```

---

### Task 7: App 编排 + README + embed

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `README.md`（「界面」段 Send 句旁补：Send 旁可导出 curl）
- Run: `cd web && npm run build`（更新 embed）

**Interfaces:**
- Consumes: `prepare`、`ExportCurlDialog`、`UrlBar.onExportCurl`
- Produces: 业务失败 → `setResult`（映射为 `Result` 形状）；成功 → 打开对话框 state

- [ ] **Step 1: 在 App 增加 state 与 handler**

```ts
const [exportCurl, setExportCurl] = useState<{
  prepared: HttpRequest;
  resolve?: ResolveSpec;
  timeoutSeconds: number;
} | null>(null);

const onExportCurl = useCallback(async () => {
  setError(null);
  try {
    const res = await prepare(draftRef.current);
    if (res.errorClass) {
      setResult({
        status: 0,
        statusText: "",
        headers: {},
        body: "",
        truncated: false,
        requestDump: "",
        responseDump: "",
        requestSize: 0,
        responseSize: 0,
        redirects: [],
        timings: { dnsMs: 0, connectMs: 0, tlsMs: 0, firstByteMs: 0, totalMs: 0 },
        errorClass: res.errorClass,
        errorMessage: res.errorMessage ?? "",
        missingVars: res.missingVars,
        prepared: res.prepared,
      });
      return;
    }
    setExportCurl({
      prepared: res.prepared,
      resolve: res.resolve,
      timeoutSeconds: res.timeoutSeconds ?? 30,
    });
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err));
  }
}, []);
```

UrlBar：`onExportCurl={() => void onExportCurl()}`  
对话框：`exportCurl && <ExportCurlDialog ... onClose={() => setExportCurl(null)} />`

- [ ] **Step 2: 更新 README**

在「界面」段提到 Send 的句子中追加：Send 右侧菜单可「导出 curl」（功能选项 + 预览 + 复制到剪贴板）。

- [ ] **Step 3: 全量测试**

Run:
```bash
go test ./... -count=1
cd web && npm test
cd web && npm run build
```
Expected: 全部 PASS；`internal/server/ui/` 更新

- [ ] **Step 4: Commit**

```bash
git add web/src/App.tsx README.md internal/server/ui web/src/styles.css
git commit -m "$(cat <<'EOF'
feat: wire export curl UI and refresh embedded assets.

EOF
)"
```

---

## Self-Review（对照规格）

| 规格项 | 任务 |
|--------|------|
| Send 旁下拉导出 curl | Task 5 |
| prepare 展开 / 缺变量拒绝对话框 | Task 1–2、7 |
| 功能勾选 + 预览 + 复制 | Task 3、6 |
| Hosts `--resolve` 默认可关、无命中禁用 | Task 1、6 |
| `-L` / `--max-time` 勾选 | Task 3、6 |
| 不发网不写历史 | Task 2 测例 |
| README | Task 7 |
| 无其它导出格式 / 不编辑预览 | 未安排（YAGNI） |
