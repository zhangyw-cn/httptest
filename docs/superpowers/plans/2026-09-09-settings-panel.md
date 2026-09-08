# 设置面板（主题搬家）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把顶栏主题三档迁入活动栏底部「设置」工作区（分类树「外观」+ 表单），设置视图下隐藏请求/响应 UI。

**Architecture:** `settings` 作为第五个 `LeftView`，不进 `ACTIVITY_VIEWS`；`ActivityBar` 上方渲染四项、底部单独渲染齿轮。`App` 在 `view === "settings"` 时侧栏换 `SettingsSidebar`、主区换 `SettingsPane`，不渲染 UrlBar / RequestEditor / ResponsePane。主题 state 与 `theme.ts` / `httree.theme` 不变，仅控件搬家。

**Tech Stack:** React + TypeScript + Vite + 手写 CSS；Vitest；无新 npm / Go 依赖。

## Global Constraints

- 规格：`docs/superpowers/specs/2026-09-09-settings-panel-design.md`。
- 主题存储键仍为 `httree.theme`，值 `light` \| `dark` \| `system`；逻辑留在 `theme.ts`。
- `ACTIVITY_VIEWS` 只含 collection / history / environment / override；`settings` 由 ActivityBar 底部单独渲染。
- 分类 id：`appearance`（界面「外观」）；分类选中不持久化，默认外观。
- 不改 Go API / workspace；不新增 npm 包；界面中文。
- 本次不做：自定义主题色、字体密度、设置搜索、多分类内容、快捷键打开设置、改存储键。
- 不回头改写历史规格或计划文件（可更新 README）。

## File Structure

| 路径 | 职责 |
|------|------|
| `web/src/activity.ts` | `LeftView` 含 `"settings"`；`ACTIVITY_LABEL`；`ACTIVITY_VIEWS` 不含 settings |
| `web/src/activity.test.ts` | settings 点击 / 收合 / 互切 / `togglePanel` |
| `web/src/ActivityBar.tsx` | 上方四项 + 底部设置齿轮 |
| `web/src/settings.ts` | `SettingsCategory`、分类列表常量 |
| `web/src/SettingsSidebar.tsx` | 分类树（仅外观） |
| `web/src/SettingsPane.tsx` | 外观表单（主题三档）+ 未知分类空状态 |
| `web/src/settings-panel.test.tsx` | ActivityBar 含设置、SettingsPane 主题回调、未知分类 |
| `web/src/App.tsx` | settings 布局分支；`settingsCategory` state；主题 props 改传 SettingsPane |
| `web/src/TopBar.tsx` | 删除主题控件与相关 props |
| `web/src/TopBar.test.tsx` | 去掉 theme props |
| `web/src/override-panel.test.tsx` | 活动栏断言含「设置」 |
| `web/src/styles.css` | 活动栏底部齿轮、设置侧栏/表单样式 |
| `README.md` | 「界面」：主题在设置 → 外观 |

---

### Task 1: `LeftView` 增加 `settings` + activity 测例

**Files:**
- Modify: `web/src/activity.ts`
- Modify: `web/src/activity.test.ts`

**Interfaces:**
- Produces:
  - `export type LeftView = "collection" | "history" | "environment" | "override" | "settings"`
  - `ACTIVITY_VIEWS` 仍为只含前四项的 `readonly LeftView[]`（**不含** `"settings"`）
  - `ACTIVITY_LABEL.settings === "设置"`
- Consumes: 现有 `clickActivityIcon` / `togglePanel` / `isActivityPressed`（签名不变，自然支持新联合成员）

- [ ] **Step 1: 写失败测试**

在 `activity.test.ts` 的 `clickActivityIcon` describe 末尾追加：

```ts
  it("opens settings from collection and collapses it on the next click", () => {
    const opened = clickActivityIcon(openCollection, "settings");
    expect(opened).toEqual({ view: "settings", panelOpen: true });
    expect(clickActivityIcon(opened, "settings")).toEqual({
      view: "settings",
      panelOpen: false,
    });
  });

  it("switches from settings to collection and opens", () => {
    expect(
      clickActivityIcon({ view: "settings", panelOpen: true }, "collection"),
    ).toEqual({ view: "collection", panelOpen: true });
  });
```

在 `togglePanel` describe 末尾追加：

```ts
  it("toggles settings panel without changing view", () => {
    expect(togglePanel({ view: "settings", panelOpen: true })).toEqual({
      view: "settings",
      panelOpen: false,
    });
  });
```

另加一组常量断言（新 describe 或同一文件顶层 describe）：

```ts
import { ACTIVITY_LABEL, ACTIVITY_VIEWS } from "./activity";

describe("ACTIVITY_VIEWS", () => {
  it("lists only the top four icons, not settings", () => {
    expect([...ACTIVITY_VIEWS]).toEqual([
      "collection",
      "history",
      "environment",
      "override",
    ]);
    expect(ACTIVITY_LABEL.settings).toBe("设置");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd web && npm test -- src/activity.test.ts`

Expected: FAIL（`settings` 不是合法 `LeftView`，或 `ACTIVITY_LABEL.settings` 不存在）

- [ ] **Step 3: 最小实现**

修改 `activity.ts`：

```ts
export type LeftView =
  | "collection"
  | "history"
  | "environment"
  | "override"
  | "settings";

export const ACTIVITY_VIEWS: readonly LeftView[] = [
  "collection",
  "history",
  "environment",
  "override",
];

export const ACTIVITY_LABEL: Record<LeftView, string> = {
  collection: "集合",
  history: "历史",
  environment: "环境",
  override: "覆盖",
  settings: "设置",
};
```

其余函数不动。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd web && npm test -- src/activity.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/activity.ts web/src/activity.test.ts
git commit -m "$(cat <<'EOF'
feat: LeftView 增加 settings，活动栏常量不含齿轮。

EOF
)"
```

---

### Task 2: ActivityBar 底部齿轮 + 样式

**Files:**
- Modify: `web/src/ActivityBar.tsx`
- Modify: `web/src/styles.css`
- Modify: `web/src/override-panel.test.tsx`
- Create: `web/src/settings-panel.test.tsx`（本任务先写 ActivityBar 测例；后续任务往同一文件追加）

**Interfaces:**
- Consumes: `ACTIVITY_VIEWS`、`ACTIVITY_LABEL`、`LeftView`、`isActivityPressed`
- Produces: 活动栏 DOM 含五个 `aria-label`（集合/历史/环境/覆盖/设置）；设置按钮在列表之后、带 `activity-btn-settings`（或包在 `.activity-bottom` 内）

- [ ] **Step 1: 写失败测试**

创建 `web/src/settings-panel.test.tsx`：

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ActivityBar from "./ActivityBar";

describe("settings activity bar", () => {
  it("renders settings gear with aria-label 设置", () => {
    const markup = renderToStaticMarkup(
      <ActivityBar
        view="settings"
        panelOpen={true}
        onClickIcon={vi.fn()}
      />,
    );
    expect(markup).toContain('aria-label="设置"');
    expect(markup).toContain('aria-pressed="true"');
    // 设置出现在覆盖之后
    const overrideAt = markup.indexOf('aria-label="覆盖"');
    const settingsAt = markup.indexOf('aria-label="设置"');
    expect(overrideAt).toBeGreaterThan(-1);
    expect(settingsAt).toBeGreaterThan(overrideAt);
  });
});
```

更新 `override-panel.test.tsx` 第一条测例：标题可改为「renders top activity buttons and 设置」，并增加：

```ts
    expect(markup).toContain('aria-label="设置"');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd web && npm test -- src/settings-panel.test.tsx src/override-panel.test.tsx`

Expected: FAIL（无「设置」）

- [ ] **Step 3: 实现 ActivityBar + CSS**

`ActivityBar.tsx`：扩展 `ACTIVITY_TITLE` / `ACTIVITY_ICON`，映射循环仍只用 `ACTIVITY_VIEWS`；底部单独渲染 settings。

```tsx
const ACTIVITY_TITLE: Record<LeftView, string> = {
  collection: "集合 (Ctrl+B)",
  history: "历史",
  environment: "环境",
  override: "覆盖",
  settings: "设置",
};

// ACTIVITY_ICON.settings：简单齿轮 SVG（stroke 路径，与现有图标风格一致）
```

结构示意：

```tsx
<nav className="activity" aria-label="侧栏">
  {ACTIVITY_VIEWS.map((item) => (/* 现有按钮 */))}
  <div className="activity-spacer" aria-hidden="true" />
  <button
    type="button"
    className={
      isActivityPressed(view, panelOpen, "settings")
        ? "activity-btn active"
        : "activity-btn"
    }
    title={ACTIVITY_TITLE.settings}
    aria-label={ACTIVITY_LABEL.settings}
    aria-pressed={isActivityPressed(view, panelOpen, "settings")}
    onClick={() => onClickIcon("settings")}
  >
    {ACTIVITY_ICON.settings}
  </button>
</nav>
```

齿轮 SVG 示例（可微调路径，保持 24 viewBox、stroke currentColor）：

```tsx
settings: (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3.5v2.2M12 18.3v2.2M4.9 6.9l1.6 1.6M17.5 15.5l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 17.1l1.6-1.6M17.5 8.5l1.6-1.6" />
  </svg>
),
```

`styles.css` 在 `.activity` 规则附近追加：

```css
.activity-spacer {
  flex: 1 1 auto;
  min-height: 0;
  pointer-events: none;
}
```

（`.activity` 已是 `flex-direction: column`，spacer 把设置顶到底部。）

- [ ] **Step 4: 运行测试确认通过**

Run: `cd web && npm test -- src/settings-panel.test.tsx src/override-panel.test.tsx src/activity.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/ActivityBar.tsx web/src/styles.css web/src/settings-panel.test.tsx web/src/override-panel.test.tsx
git commit -m "$(cat <<'EOF'
feat: 活动栏底部设置齿轮。

EOF
)"
```

---

### Task 3: SettingsSidebar + SettingsPane

**Files:**
- Create: `web/src/settings.ts`
- Create: `web/src/SettingsSidebar.tsx`
- Create: `web/src/SettingsPane.tsx`
- Modify: `web/src/settings-panel.test.tsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Produces:
  - `export type SettingsCategory = "appearance"`
  - `export const SETTINGS_CATEGORIES: readonly { id: SettingsCategory; label: string }[]`
  - `SettingsSidebar({ category, onSelect }: { category: SettingsCategory; onSelect: (id: SettingsCategory) => void })`
  - `SettingsPane({ category, theme, onThemeChange }: { category: string; theme: ThemePref; onThemeChange: (t: ThemePref) => void })`
    - `category` 用 `string` 以便测未知分类；已知时与 `SettingsCategory` 对齐
- Consumes: `ThemePref` from `./theme`

- [ ] **Step 1: 写失败测试**

在 `settings-panel.test.tsx` 追加：

```tsx
import SettingsPane from "./SettingsPane";
import SettingsSidebar from "./SettingsSidebar";
import { SETTINGS_CATEGORIES } from "./settings";
import type { ThemePref } from "./theme";

describe("settings categories", () => {
  it("exposes only appearance for v1", () => {
    expect(SETTINGS_CATEGORIES.map((c) => c.id)).toEqual(["appearance"]);
    expect(SETTINGS_CATEGORIES[0]?.label).toBe("外观");
  });
});

describe("SettingsSidebar", () => {
  it("marks 外观 as active", () => {
    const markup = renderToStaticMarkup(
      <SettingsSidebar category="appearance" onSelect={vi.fn()} />,
    );
    expect(markup).toContain("外观");
    expect(markup).toContain("active");
  });
});

describe("SettingsPane", () => {
  it("renders theme switch for appearance and calls onThemeChange", () => {
    const calls: ThemePref[] = [];
    const markup = renderToStaticMarkup(
      <SettingsPane
        category="appearance"
        theme="dark"
        onThemeChange={(t) => {
          calls.push(t);
        }}
      />,
    );
    expect(markup).toContain("主题");
    expect(markup).toContain("浅色");
    expect(markup).toContain("深色");
    expect(markup).toContain("系统");
    // SSR 无法点按；用正则确认三个 button 存在
    expect(markup.match(/type="button"/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("shows empty state for unknown category", () => {
    const markup = renderToStaticMarkup(
      <SettingsPane
        category="nope"
        theme="dark"
        onThemeChange={vi.fn()}
      />,
    );
    expect(markup).toContain("未知分类");
    expect(markup).not.toContain('aria-label="主题"');
  });
});
```

说明：`onThemeChange` 的「调用」在 SSR 测例里无法真正触发；保留 props 接线即可。若希望断言回调，可改为导出纯函数 `themeOptions` 或在后续用 fireEvent——**本计划不新增测试库**，SSR 断言文案足够。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd web && npm test -- src/settings-panel.test.tsx`

Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 settings 模块与两个组件**

`settings.ts`：

```ts
export type SettingsCategory = "appearance";

export const SETTINGS_CATEGORIES: readonly {
  id: SettingsCategory;
  label: string;
}[] = [{ id: "appearance", label: "外观" }];
```

`SettingsSidebar.tsx`：复用侧栏结构（`sidebar` / `sidebar-head` / `sidebar-body` / `req-item`），无新建按钮：

```tsx
import { SETTINGS_CATEGORIES, type SettingsCategory } from "./settings";

interface Props {
  category: SettingsCategory;
  onSelect: (id: SettingsCategory) => void;
}

export default function SettingsSidebar({ category, onSelect }: Props) {
  return (
    <aside className="sidebar" aria-label="设置分类">
      <div className="sidebar-head">
        <span>设置</span>
      </div>
      <div className="sidebar-body">
        <ul className="req-list">
          {SETTINGS_CATEGORIES.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={
                  category === item.id ? "req-item active" : "req-item"
                }
                onClick={() => onSelect(item.id)}
              >
                <span className="req-path">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
```

`SettingsPane.tsx`：

```tsx
import type { ThemePref } from "./theme";

interface Props {
  category: string;
  theme: ThemePref;
  onThemeChange: (theme: ThemePref) => void;
}

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "系统" },
];

export default function SettingsPane({
  category,
  theme,
  onThemeChange,
}: Props) {
  if (category !== "appearance") {
    return (
      <div className="settings-pane">
        <div className="empty-state">
          <h2>未知分类</h2>
          <p>请从左侧选择一个设置分类。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-pane">
      <h2 className="settings-title">外观</h2>
      <section className="settings-section">
        <h3 className="settings-label">主题</h3>
        <div className="theme-switch" role="group" aria-label="主题">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={theme === opt.value ? "btn btn-active" : "btn"}
              onClick={() => onThemeChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
```

`styles.css` 追加（数值贴近现有密度）：

```css
.settings-pane {
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 1rem 1.25rem;
  overflow: auto;
  background: var(--bg);
}

.settings-title {
  margin: 0 0 1rem;
  font-size: 1.1rem;
  font-weight: 600;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 28rem;
}

.settings-label {
  margin: 0;
  font-size: 0.85rem;
  color: var(--muted);
  font-weight: 500;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd web && npm test -- src/settings-panel.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/settings.ts web/src/SettingsSidebar.tsx web/src/SettingsPane.tsx web/src/settings-panel.test.tsx web/src/styles.css
git commit -m "$(cat <<'EOF'
feat: 设置分类侧栏与外观主题表单。

EOF
)"
```

---

### Task 4: 接入 App、清空 TopBar 主题

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/TopBar.tsx`
- Modify: `web/src/TopBar.test.tsx`

**Interfaces:**
- Consumes: `SettingsSidebar`、`SettingsPane`、`SettingsCategory`（默认 `"appearance"`）
- Produces: `view === "settings"` 时侧栏/主区切换；TopBar 不再有 `theme` / `onThemeChange`

- [ ] **Step 1: 更新 TopBar 测试（先红）**

`TopBar.test.tsx` 去掉 `theme` / `onThemeChange`：

```tsx
      <TopBar
        workdir="/tmp/project"
        envs={[]}
        overrides={[]}
        local={{ environment: "", override: "dev" }}
        onEnvChange={vi.fn()}
        onOverrideChange={vi.fn()}
      />
```

可选追加：`expect(markup).not.toContain("浅色");`（避免主题档残留）。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd web && npm test -- src/TopBar.test.tsx`

Expected: FAIL（TopBar 仍要求 theme props，或仍渲染主题文案——取决于先改测试还是先改组件；按 TDD 先改测试，TypeScript/vitest 报 props 多余或组件仍要必填）

若项目 `tsc` 在 test 前不跑、仅运行时：先改 `TopBar.tsx` 与测试同一提交内完成亦可，但步骤上仍先删测试中的 props，再改组件使类型对齐。

- [ ] **Step 3: 改 TopBar**

删除 `ThemePref` import、`theme` / `onThemeChange` props、`THEME_OPTIONS`、主题按钮组 JSX。保留 brand、cwd、环境、覆盖。

- [ ] **Step 4: 改 App 布局**

1. Import：`SettingsSidebar`、`SettingsPane`、`type SettingsCategory`。
2. State：`const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>("appearance");`
3. `TopBar`：去掉 `theme={theme}` 与 `onThemeChange={onThemeChange}`。
4. 侧栏：

```tsx
{left.panelOpen &&
  (left.view === "settings" ? (
    <SettingsSidebar
      category={settingsCategory}
      onSelect={setSettingsCategory}
    />
  ) : (
    <Sidebar /* 现有 props 不变 */ />
  ))}
```

5. 主区 `work` 内，在 environment / override 分支之前（或并列）增加 settings：

```tsx
{left.view === "settings" ? (
  <SettingsPane
    category={settingsCategory}
    theme={theme}
    onThemeChange={onThemeChange}
  />
) : left.view === "environment" ? (
  <EnvEditor /* ... */ />
) : left.view === "override" ? (
  <EnvEditor /* ... */ />
) : (
  <>
    <UrlBar /* ... */ />
    <div className="panes">...</div>
  </>
)}
```

保留现有 `onThemeChange` 函数与 `theme` state / `useEffect(applyTheme)`（若有）。**不要**在 settings 视图渲染 UrlBar、RequestEditor、ResponsePane。

- [ ] **Step 5: 运行测试**

Run: `cd web && npm test`

Expected: PASS（全量）

- [ ] **Step 6: Commit**

```bash
git add web/src/App.tsx web/src/TopBar.tsx web/src/TopBar.test.tsx
git commit -m "$(cat <<'EOF'
feat: 设置视图接管主区，顶栏移除主题开关。

EOF
)"
```

---

### Task 5: README + 前端构建产物

**Files:**
- Modify: `README.md`（「界面」一节）
- Modify: `internal/server/ui/*`（由 `npm run build` 生成）

**Interfaces:** 无新 API

- [ ] **Step 1: 更新 README「界面」**

将现有首句中「浅色/深色/系统」从顶栏描述去掉，改为说明主题在设置中。目标表述（可微调行文，须含要点）：

- 顶栏：产品名、工作区路径、环境选择器、覆盖选择器（可选「无」）——**无**主题三档。
- 活动栏：集合、历史、环境、覆盖；**底部设置**。再点当前图标收起树（`Ctrl+B`）。
- 设置视图：左侧分类（外观），中间主题浅色/深色/系统；无 UrlBar / 响应区。
- 集合/历史仍为 Method/URL/Send…；环境/覆盖编辑行为不变。

- [ ] **Step 2: 构建嵌入 UI**

Run: `cd web && npm run build`

Expected: 成功；`internal/server/ui/` 更新。

- [ ] **Step 3: 手工烟测清单（执行者勾选）**

- [ ] 顶栏无主题档；活动栏底有设置
- [ ] 点设置：侧栏「外观」，主区主题三档；无 UrlBar/响应
- [ ] 切换浅色/深色/系统即时生效；刷新后记忆
- [ ] 设置下 `Ctrl+B` 收起分类树，表单铺满；再开恢复
- [ ] 点集合：回到请求 UI

- [ ] **Step 4: Commit**

```bash
git add README.md internal/server/ui
git commit -m "$(cat <<'EOF'
docs: README 说明主题在设置；更新嵌入 UI。

EOF
)"
```

---

## Spec coverage (self-review)

| 规格要点 | 任务 |
|---------|------|
| `settings` LeftView、齿轮沉底、`ACTIVITY_VIEWS` 不含 settings | Task 1–2 |
| 分类树仅外观 + 主题三档表单 | Task 3 |
| 设置下隐藏 UrlBar/编辑器/响应；顶栏去主题 | Task 4 |
| `httree.theme` / `theme.ts` 不变 | Task 3–4（只搬家） |
| `Ctrl+B` 开合分类树 | Task 1（语义）+ Task 4（侧栏条件渲染） |
| 未知分类空状态 | Task 3 |
| activity / TopBar / Settings 测例 | Task 1–4 |
| README + build | Task 5 |
| 非目标（主题色等） | 未列入任务 |

**Placeholder scan:** 无 TBD/TODO；测例与组件代码完整。  
**Type consistency:** `SettingsCategory = "appearance"`；`LeftView` 含 `"settings"`；TopBar 不再含 theme props。
