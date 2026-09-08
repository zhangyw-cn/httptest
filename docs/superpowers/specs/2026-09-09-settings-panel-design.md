# httree 设置面板设计规格

日期：2026-09-09  
状态：已与用户对齐，待用户审阅本文件后进入实现计划  
前置规格：`2026-09-03-ui-ux-design.md`（壳层、活动栏、主题存储）、`2026-09-04-ui-polish-design.md`（控件态、主题档样式）。本文件不取代它们，只把主题入口迁入设置工作区。

## 1. 目的与成功标准

把主题偏好从顶栏挪进「设置」工作区，顶栏只保留工作相关控件（cwd、环境、覆盖）。分类树为以后外观项留结构，第一版只做主题三档搬家。

成功标准：

- 活动栏底部有「设置」齿轮；进入后左侧为分类树（仅「外观」），中间为设置表单（主题：浅色 / 深色 / 系统）。
- 设置视图下隐藏 UrlBar、请求编辑器、响应区；顶栏主题三档控件移除。
- 主题读写、默认深色、`system` 解析、失败静默回退——行为与现有 `theme.ts` / `localStorage`（键 `httree.theme`）一致，不改存储键与语义。
- `Ctrl+B` 在设置下仍只开合分类树侧栏；收起后表单铺满剩余宽度。

非目标（本次不做）：自定义主题色 / CSS token、字体与密度、设置搜索、多分类实质内容、设置项同步到服务端或 git、快捷键打开设置、改主题存储键、新 npm 依赖。

## 2. 约束

| 项 | 决定 |
|---|---|
| 方案 | `settings` 作为第五个 `LeftView`；图标沉底，与上方四项视觉分隔 |
| 主题存储 | 仍为 `localStorage` 键 `httree.theme`，值 `light` \| `dark` \| `system`；逻辑留在 `theme.ts` |
| 后端 | 不改 Go API、workspace、`.httree` |
| 栈 | 现有 React + TypeScript + Vite + 手写 CSS；不新增 npm 包 |
| 语言 | 界面中文 |
| README | 实现后更新「界面」一节：主题入口改为设置 → 外观 |

## 3. 架构

仍是单进程前端壳层切换，不引入路由库。

```
活动栏
  上：collection | history | environment | override
  下：settings（齿轮）
       │
       ▼ view === "settings"
  侧栏（panelOpen）：SettingsSidebar 分类树
  主区：SettingsPane 表单（隐藏 UrlBar / 编辑器 / 响应）

       ▼ view !== "settings"
  现有 Sidebar + UrlBar + 编辑器 + 响应
```

主题状态仍在 `App`：`readStoredTheme` → state → `applyTheme` / `writeStoredTheme`。`SettingsPane` 通过 props 改主题，与今日顶栏路径相同，仅控件搬家。

### 3.1 活动栏与 `LeftView`

- `LeftView` 增加 `"settings"`。
- `ACTIVITY_VIEWS` 只含上方四项（collection / history / environment / override）；`settings` 不进入该数组，由 `ActivityBar` 在底部单独渲染齿轮（`margin-top: auto` 或 flex 分隔），避免与上方图标挤在一起。
- `clickActivityIcon` / `isActivityPressed` / `togglePanel` 对 `settings` 与其它视图相同：再点当前图标只切换 `panelOpen`；点另一图标切换视图并打开侧栏。
- 文案：`aria-label` 与可见标题为「设置」；`title` 为「设置」。

### 3.2 布局切换

| `left.view` | 侧栏（`panelOpen` 时） | 主区 |
|---|---|---|
| collection / history / environment / override | 现有 `Sidebar` | 现有 UrlBar + 编辑器 + 响应 |
| `settings` | 设置分类树（宽约 220px，与现侧栏同宽） | 设置表单整页；**不渲染** UrlBar、RequestEditor、ResponsePane |

设置下 `panelOpen === false`：不显示分类树，设置表单占满活动栏右侧全部宽度。点其它活动图标后主区恢复请求 UI。

### 3.3 顶栏

- 删除主题三档按钮组；保留 brand、cwd、环境、覆盖。
- `TopBar` 不再接收 `theme` / `onThemeChange`。

### 3.4 组件边界

| 单元 | 职责 | 依赖 |
|---|---|---|
| `SettingsSidebar` | 分类列表；第一版仅「外观」 | 当前分类 id、`onSelect` |
| `SettingsPane` | 当前分类表单；外观含主题三档（复用 `.theme-switch` / `.btn`） | `theme`、`onThemeChange`、当前分类 |
| `activity` | `LeftView` / 点击与按下态 | 无主题逻辑 |
| `theme.ts` | 解析、存储、`applyTheme` | 不变 |

分类 id 用稳定英文字符串 `appearance`，界面显示「外观」。分类选中为组件内 state，刷新回默认「外观」，不持久化。未知分类：简单空状态（标题 + 一句说明），不抛错。

## 4. 数据流

```
启动
  readStoredTheme() → App theme state → applyTheme()

设置 → 外观 → 改主题
  onThemeChange(pref)
    → setTheme + writeStoredTheme + applyTheme
```

不新增 HTTP API。不写 workspace 文件。

## 5. 错误与边界

| 情况 | 行为 |
|---|---|
| `localStorage` 读失败或非法值 | 回退 `dark`，不弹错 |
| `localStorage` 写失败 | 仅本次会话有效，不弹错 |
| 设置视图下 `Ctrl+Enter` / `Ctrl+S` | 无请求编辑器，不发送、不保存；不新增设置专用快捷键 |
| 对话框打开时 | 现有规则：全局快捷键不生效 |

## 6. 测试与验收

- `activity`：`settings` 纳入类型与点击 / 再点收合 / 与其它视图互切（扩展现有测例）。
- 主题：现有 `theme.test.ts` 保持通过；可选为 `SettingsPane` 增加触发 `onThemeChange` 的轻量测例。
- `TopBar`：去掉主题 props 后更新 `TopBar.test.tsx`。
- 手工：设置整页无 UrlBar/响应；顶栏无主题档；浅色 / 深色 / 系统切换与刷新记忆；设置下 `Ctrl+B` 开合分类树。

实现后：`cd web && npm run build` 更新嵌入 UI；README「界面」写明主题在设置 → 外观。

## 7. 与既有规格的关系

- `2026-09-03-ui-ux-design.md` 中「顶栏主题三选一」由本规格取代为「设置 → 外观」；存储键与三档语义不变。
- `2026-09-04-ui-polish-design.md` 主题档选中态（`--selected`）继续用于设置内主题按钮。
- 环境 / 覆盖 / 密钥相关规格不因本功能修改。
