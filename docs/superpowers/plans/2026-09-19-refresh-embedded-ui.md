# Refresh Embedded UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用当前 `web/` 前端重建 Vite 产物并写入 `internal/server/ui/`，使 `go run` / `go build` 嵌入的 UI 显示「请求设置」页签。

**Architecture:** 不改业务源码。Vite 已配置 `build.outDir: "../internal/server/ui"` 与 `emptyOutDir: true`；`internal/server` 通过 `//go:embed ui/*` 加载该目录。执行一次 `npm run build`，校验产物含「请求设置」，提交变更后重启进程即可。

**Tech Stack:** Vite（`web/`）；Go embed（`internal/server/ui/`）。

## Global Constraints

- 规格：`docs/superpowers/specs/2026-09-19-refresh-embedded-ui-design.md`。
- **不改** `web/src` 业务逻辑与布局。
- **不加** embed 防漏检测试或 CI 断言（规格非目标）。
- **不改** Vite 开发工作流；不引入 Makefile。
- 构建命令：`cd web && npm run build`（`tsc --noEmit && vite build`）。
- 仅提交 `internal/server/ui/` 的构建产物变更（勿提交 `.test/hosts/lam.yaml`、`web/tsconfig.tsbuildinfo` 等无关文件）。

---

## File Structure

| 路径 | 职责 |
|------|------|
| `web/` | 前端源码（本计划只读，用于构建） |
| `web/vite.config.ts` | `outDir` → `../internal/server/ui`；`emptyOutDir: true` |
| `internal/server/ui/index.html` | 嵌入入口；引用 hashed assets |
| `internal/server/ui/assets/*` | 构建产物 CSS/JS（hash 文件名会变） |
| `internal/server/embed.go` | `//go:embed ui/*`（不改） |

---

### Task 1: 重建嵌入 UI 并提交

**Files:**
- Modify (via Vite): `internal/server/ui/index.html`
- Modify (via Vite): `internal/server/ui/assets/*`（旧 hash 删除，新 hash 生成）
- Read-only: `web/vite.config.ts`、`web/src/RequestEditor.tsx`

**Interfaces:**
- Consumes: 现有 `npm run build`；`RequestEditor` 中已有「请求设置」文案
- Produces: `internal/server/ui/assets/*.js` 含字面量「请求设置」；`index.html` 引用新 asset hash

- [ ] **Step 1: 确认重建前嵌入产物缺少页签文案**

Run:

```bash
rg -a "请求设置" internal/server/ui/assets/*.js >/dev/null && echo FOUND || echo MISSING
```

Expected: `MISSING`（若已是 `FOUND`，跳到 Step 4 核对 `git status`，无变更则无需再建与提交）。

- [ ] **Step 2: 执行前端构建**

Run:

```bash
cd web && npm run build
```

Expected:
- `tsc --noEmit` 无错
- Vite 输出到 `../internal/server/ui`
- 结束无 error；`internal/server/ui/index.html` 中 `/assets/index-*.js` / `index-*.css` 的 hash 与重建前不同（或至少 assets 目录已刷新）

- [ ] **Step 3: 确认产物含「请求设置」**

Run:

```bash
rg -a "请求设置" internal/server/ui/assets/*.js >/dev/null && echo FOUND || echo MISSING
ls internal/server/ui/assets/
```

Expected: 打印 `FOUND`；`assets/` 下有新的 `index-*.js` 与 `index-*.css`；旧 hash 文件（如 `index-B-QP2CAz.js`）不再存在。

- [ ] **Step 4: 确认 Go embed 冒烟仍通过**

Run:

```bash
go test ./internal/server/ -run TestEmbeddedUIHasIndex -count=1
```

Expected: `PASS`（`ui/index.html` 含 `id="root"`，`ui/assets` 非空）。

- [ ] **Step 5: 提交嵌入产物**

Run:

```bash
git status
git add internal/server/ui/
git commit -m "$(cat <<'EOF'
chore(ui): rebuild embed so request settings tab is visible.

EOF
)"
git status
```

Expected:
- `git status` 显示 `internal/server/ui/` 有变更（html + 新旧 assets）
- commit 成功；工作区无未提交的 embed 变更
- **不要** `git add` `.test/hosts/lam.yaml` 或 `web/tsconfig.tsbuildinfo`

- [ ] **Step 6: 手动验证（实现者本机）**

1. 停掉旧的 `httptest` 进程（若有）。
2. 从仓库根重新启动，例如：`go run ./cmd/httptest .test`
3. 浏览器打开打印的 URL，硬刷新（Ctrl+Shift+R）。
4. 进入集合或历史视图，打开任一请求编辑器。

Expected: 页签为 `Query | Headers | Body | 请求设置`；点击「请求设置」可见超时 (ms)、跟随重定向、最大重定向次数、跳过 TLS 校验；关闭跟随时最大次数禁用。

---

## Spec coverage (self-review)

| 规格项 | Task |
|--------|------|
| `npm run build` 更新 `internal/server/ui/` | Task 1 Step 2 |
| 嵌入 JS 含「请求设置」 | Task 1 Step 3 |
| 提交 embed 变更 | Task 1 Step 5 |
| 重启后页签可见可用 | Task 1 Step 6 |
| 不改 web 源码 / 不加防漏检 / 无 Makefile | Global Constraints + 无对应改动任务 |

无 TBD；无新增测试文件（规格明确非目标）。
