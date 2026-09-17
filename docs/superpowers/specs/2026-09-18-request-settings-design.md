# httptest 请求级 Settings 设计规格

日期：2026-09-18  
状态：已与用户对齐，待用户审阅本文件后进入实现计划  
前置：`2026-09-01-httptest-design.md`（请求模型、执行器、跟随重定向最多 10 次、系统 CA）、`2026-09-17-export-curl-design.md`、`2026-09-17-import-curl-design.md`。本文件把原 v1「不做」的跟随重定向开关与跳过 TLS，以及可配置最大重定向次数与毫秒超时，收进请求级 `settings`；并调整 curl 导入/导出映射。

## 1. 目的与成功标准

在请求 YAML / 编辑器草稿中支持一组**请求级客户端行为**配置，使调试时可关闭跟随重定向、限制跳数、跳过 TLS 校验，并以毫秒为单位设置超时。

成功标准：

- 请求编辑器页签为 `Query | Headers | Body | 请求设置`；超时与重定向、TLS 开关均在「请求设置」中编辑（UI 超时单位为毫秒）。
- YAML 使用嵌套块 `settings`；字段为 `timeoutMs`、`followRedirects`、`maxRedirects`、`insecureSkipVerify`。
- **破坏性：** 不再支持顶层 `timeout`（含字符串 duration）；也不再支持 `settings.timeout` 字符串。旧文件须改为 `settings.timeoutMs`。
- 省略 `settings` 或个别字段时，行为与今日默认一致：30000ms、跟随、最多 10 次、校验 TLS。
- 执行器按该请求应用 CheckRedirect 与 `InsecureSkipVerify`；Hosts Dial / SNI 语义不变。
- curl 导入映射 `-L`、`--max-redirs`、`-k`/`--insecure`、`--max-time`/`-m`；导出可带出对应 flag。
- README 更新请求文件示例与「v1 明确不做」列表（删除跳过 TLS / 关闭跟随两项）。

非目标（本次不做）：工作区或环境级客户端默认、客户端证书、代理、Cookie jar、改全局 `http.DefaultTransport`、multipart / HTTP/2、认证助手、自动迁移顶层 `timeout` 的工具。

## 2. 约束

| 项 | 决定 |
|---|---|
| 范围 | 仅请求级；未保存草稿也可带 settings 发送 |
| YAML | 嵌套 `settings`；`omitempty`；全默认可不写 `settings` |
| 超时 | `timeoutMs`：`*int64` 毫秒；UI 直接填毫秒；默认 30000 |
| 重定向 | `followRedirects` 默认 true；`maxRedirects` 默认 10，合法范围 1–50 |
| TLS | `insecureSkipVerify` 默认 false；开启仅 UI 短警告，不二次确认 |
| 顶层 timeout | 读盘校验失败，提示改用 `settings.timeoutMs` |
| curl 默认差异 | 无 `-L` 时不写 `followRedirects: false`（省略 = 产品默认跟随，**不**模仿 curl 默认不跟随） |
| 栈 | 现有 Go + React/TS/Vite + 手写 CSS；不新增 npm 包 |
| 语言 | 界面中文；页签「请求设置」以区分活动栏「设置」 |
| README | 实现后更新请求文件、界面、非目标列表 |

## 3. 架构

```
浏览器
  RequestEditor → 请求设置页签编辑 settings
  导入/导出 curl → settings ↔ curl flags
       │
       ▼
server  /api/execute、/api/prepare（request 含 settings）
       │
       ▼
workspace  collections/**/*.yaml 读写 Request.Settings
       │
       ▼
executor  归一化 settings → WithTimeout / CheckRedirect / TLSClientConfig
```

### 3.1 组件边界

| 单元 | 职责 | 依赖 |
|---|---|---|
| `workspace.Request` / `RequestSettings` | 模型、YAML 读写、拒绝顶层 `timeout` | 路径规则 |
| `executor.Prepare` / `Execute` | 展开变量；按 settings 建 Client | workspace、现有 transport/hosts |
| `PrepareResult` | `prepared` 含 settings；`timeoutSeconds` 由 ms 派生供导出 | executor |
| 前端 RequestEditor | 「请求设置」页签；follow 关时禁用 max | types / api |
| `parseCurl` / `formatCurl` | flag ↔ settings | HttpRequest.settings |

## 4. 数据模型与文件

### 4.1 示例

```yaml
name: Login
method: POST
url: "{{baseUrl}}/api/login"
query: {}
headers: {}
body:
  type: json
  content: "{}"
settings:
  timeoutMs: 30000
  followRedirects: true
  maxRedirects: 10
  insecureSkipVerify: false
```

### 4.2 结构（概念）

```go
type RequestSettings struct {
	TimeoutMs            *int64 `json:"timeoutMs,omitempty" yaml:"timeoutMs,omitempty"`
	FollowRedirects      *bool  `json:"followRedirects,omitempty" yaml:"followRedirects,omitempty"`
	MaxRedirects         *int   `json:"maxRedirects,omitempty" yaml:"maxRedirects,omitempty"`
	InsecureSkipVerify   *bool  `json:"insecureSkipVerify,omitempty" yaml:"insecureSkipVerify,omitempty"`
}

type Request struct {
	// ...现有 name/method/url/query/headers/body
	Settings RequestSettings `json:"settings,omitempty" yaml:"settings,omitempty"`
	// 无顶层 Timeout 字段
}
```

指针区分「未写」与显式 `false` / `0`。

### 4.3 归一化默认与校验

| 字段 | 省略时 | 规则 |
|------|--------|------|
| `timeoutMs` | `30000` | 必须为正整数；`≤0` → `invalid` |
| `followRedirects` | `true` | bool |
| `maxRedirects` | `10` | 整数 1–50；仅当有效 `followRedirects==true` 时校验并使用；follow 为 false 时可忽略该字段 |
| `insecureSkipVerify` | `false` | bool |

读盘：先解析为通用 map（或等价检查），若顶层存在键 `timeout`，或 `settings` 为 map 且含键 `timeout`（旧字符串 duration），**失败**并提示改用 `settings.timeoutMs`。不得依赖「结构体无字段则静默忽略」——go-yaml 会丢掉未知字段，必须显式检测。无 `settings` 且无顶层 `timeout` 的旧请求行为不变。

落盘：保存前将等于产品默认的字段收成 nil（`timeoutMs==30000`、`followRedirects==true`、`maxRedirects==10`、`insecureSkipVerify==false`），再 `omitempty` 序列化；全为默认则省略整个 `settings` 键。草稿编辑态可用具体值展示默认，与落盘压缩不冲突。

## 5. UI

- 请求栏页签：`Query | Headers | Body | 请求设置`。
- **请求设置**自上而下（中文标签）：
  1. 超时 (ms) — 数字；空表示默认 30000（可不写回 YAML）。
  2. 跟随重定向 — 开关，默认开。
  3. 最大重定向次数 — 1–50；跟随关闭时禁用（草稿值保留）。
  4. 跳过 TLS 校验 — 开关，默认关；开启旁短警告：「仅用于本机调试，勿对生产证书使用」。
- 应用级设置视图（主题等）不变。
- Save / Send / 历史回放均携带或回填 `settings`。

## 6. 执行器与 API

1. `Prepare`：变量展开；settings 不参与 `{{var}}`，原样进入 `prepared`。
2. 超时：`context.WithTimeout(..., time.Duration(timeoutMs)*time.Millisecond)`。
3. 每次 `Execute` 新建 `http.Client`（与现一致）：
   - `followRedirects == false`：`CheckRedirect` 始终 `http.ErrUseLastResponse`；不追加 redirect hops。
   - `followRedirects == true`：`len(via) > maxRedirects` 时同现「超限停」逻辑（`ErrUseLastResponse` + redirect limit 类信息）；上限取 settings，不再写死 10。
   - `insecureSkipVerify`：在本次 transport 上设 `TLSClientConfig.InsecureSkipVerify`（克隆/包装，不污染全局）。Hosts 自定义 Dial 不变。
4. `POST /api/execute`、`POST /api/prepare` 的 request 含 `settings`；`prepared` 回传 settings。
5. `PrepareResult.timeoutSeconds`：由有效 `timeoutMs/1000` 派生，供导出 curl；可另加 `timeoutMs` 字段，非必须。
6. 历史 jsonl 存完整 request（含 settings）。

## 7. curl 导入 / 导出

### 7.1 导入（相对旧规格破坏性）

| Flag | 行为 |
|------|------|
| `-L` / `--location` | `settings.followRedirects = true`（不再忽略） |
| `--max-redirs <n>` | `settings.maxRedirects = n`；非法或非 1–50 → 整次失败 |
| `-k` / `--insecure` | `settings.insecureSkipVerify = true` |
| `--max-time` / `-m` | `settings.timeoutMs = round(seconds * 1000)`；非法 → 失败 |

未出现的 flag：对应 settings 字段不设（产品默认）。**无 `-L` 时不显式写 `followRedirects: false`。**

应用到草稿时：用解析结果替换 method/url/query/headers/body/settings；保留 `name`。命令无 `--max-time` 时不设 `timeoutMs`（清除草稿原 timeoutMs，发送走默认 30000）。

### 7.2 导出

- 与草稿 / prepare 后的有效 settings 对齐：follow → `-L`；follow 时带 `--max-redirs`；insecure → `-k`；timeout → `--max-time`（秒，由 ms 换算）。
- 导出对话框勾选可控制是否带上各 flag（扩展现有 `CurlOptions`：含 `-k`、`--max-redirs`）。

## 8. 错误处理

| 情况 | 行为 |
|------|------|
| 顶层 `timeout` 或非法 settings 形状 | 读盘/校验失败，明确文案 |
| 发送时 `timeoutMs≤0` 或 max 越界（follow 开） | `errorClass: invalid`，不发送 |
| insecure 开启 | 仅 UI 警告，不阻断 |
| 重定向超限 | 与现有一致（停在最后一跳 + 诊断信息） |

## 9. 测试

- workspace：读写 `settings`；拒绝顶层 `timeout`。
- executor：不跟随停在 3xx；自定义 `maxRedirects`；insecure 对测试自签可通。
- curl：`-L` / `-k` / `--max-redirs` / `-m` 导入；导出含对应 flag。
- 前端：请求设置页签；follow 关时 max 禁用。

## 10. README 与规格连带

- 更新「请求文件」示例为 `settings.timeoutMs` 等。
- 「v1 明确不做」删除：跳过 TLS 校验、关闭跟随重定向。
- 注明跟随次数可配（默认 10，上限 50）。
- 导入 curl 规格中「`-L` 可出现但忽略」「`--max-time` → 顶层 timeout」以本文件为准覆盖。

## 11. 实现顺序建议

1. workspace 模型 + 读写/拒绝顶层 timeout + 测试  
2. executor 超时 ms、CheckRedirect、TLS + 测试  
3. API / PrepareResult / 历史无回归  
4. 前端类型、请求设置页签、normalize/save  
5. curl 导入导出  
6. README  

（详细任务拆分在实现计划中给出。）
