# 刷新嵌入 UI（请求设置页签可见）设计规格

日期：2026-09-19  
状态：已与用户对齐（方案 A），待用户审阅本文件后进入实现计划  
前置：`2026-09-18-request-settings-design.md`（请求编辑器第四页签「请求设置」已在 `web/src` 实现）。

## 1. 目的与成功标准

`go run` / `go build` 启动的单二进制界面中，请求编辑器页签应显示并可用「请求设置」。

成功标准：

- `cd web && npm run build` 更新 `internal/server/ui/`。
- 嵌入产物（`internal/server/ui/assets/*.js`）含文案「请求设置」。
- 重启 httptest 后，集合/历史视图下请求栏页签为 `Query | Headers | Body | 请求设置`；页签内可编辑超时 (ms)、跟随重定向、最大重定向次数、跳过 TLS 校验。

非目标：不改 `web/src` 业务逻辑与布局；不加 embed 防漏检或 CI 断言；不改 Vite 开发工作流；不引入 Makefile。

## 2. 问题与根因

请求级 settings 的前端源码已合并，但 `internal/server/ui/` 仍为更早的 Vite 产物。Go 通过 `//go:embed ui/*` 嵌入该目录，因此运行中的 UI 只有 `Query | Headers | Body`，看不到「请求设置」。

这不是半屏宽度裁切，也不是用户找错活动栏「设置」。

## 3. 做法

1. 在仓库根依赖现有约定：`web/vite.config.ts` 的 `build.outDir` 为 `../internal/server/ui`，`emptyOutDir: true`。
2. 执行 `cd web && npm run build`。
3. 确认新 hashed 资源写入 `internal/server/ui/`，旧 hash 文件被清空；产物中含「请求设置」。
4. 将更新后的 `internal/server/ui/` 纳入版本控制（若相对 HEAD 有变更）。
5. 重启正在运行的 httptest（需重新 `go run` / 重新构建二进制）并硬刷新浏览器。

## 4. 验证

| 步骤 | 期望 |
|------|------|
| 搜索嵌入 JS | 匹配「请求设置」 |
| 打开集合视图请求编辑器 | 四个页签均可见 |
| 点击「请求设置」 | 四个控件可用；跟随关闭时最大次数禁用 |

## 5. 实现顺序

1. `cd web && npm run build`  
2. 抽查嵌入产物  
3. 提交 `internal/server/ui/`（若有 diff）  
4. 手动重启并目视确认  

（详细命令与检查点在实现计划中给出。）
