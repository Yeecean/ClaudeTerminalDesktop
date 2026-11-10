# MVP 验收记录

初次验收：2026-11-10（Asia/Shanghai）

安全加固与复验：2026-11-11（Asia/Shanghai）

验收对象：Claude Terminal Desktop 0.1.0 Windows x64 MVP

## 1. 验收环境

| 项目 | 实际值 |
| --- | --- |
| Windows | Windows 11 专业版 10.0.26200 |
| PowerShell | 7.6.9 |
| Node.js | 24.16.0 |
| npm | 11.16.0 |
| Electron | 45.2.3 |
| Claude Code CLI | 2.1.319 |
| 打包工具 | electron-builder 26.18.0 |
| 目标产物 | NSIS、portable、win-unpacked，均为 x64 |

## 2. 已自动执行的验证

| 验证 | 结果 | 说明 |
| --- | --- | --- |
| `npm run typecheck` | 通过 | main/preload 与 web TypeScript 均无错误 |
| `npm test` | 通过 | 3 个测试文件、14 个单元测试 |
| `npm run check:pty` | 通过 | 当前 Electron 中成功创建真实 ConPTY |
| `npm run test:e2e` | 通过 | 源码构建上的完整 Electron 冒烟流程 |
| `npm run test:e2e:crash` | 通过 | 源码构建上强制终止主进程并核验无孤儿 |
| 打包产物 E2E | 通过 | `release/win-unpacked` 可执行文件完整复跑 |
| 打包产物崩溃 E2E | 通过 | 同一可执行文件强制崩溃后无 PTY/Claude 孤儿 |
| `npm run package` | 通过 | NSIS 与 portable 分别生成，不再互相覆盖 |
| `npm audit --omit=dev` | 通过 | 生产依赖 0 漏洞 |
| `npm audit` | 有开发依赖告警 | 6 个 moderate，均来自打包工具链 |

单元测试覆盖页面 URL 信任边界、设置归一化/合并、项目与会话持久化、损坏 JSON
恢复和中断会话修复。端到端测试实际覆盖：

- 添加真实项目目录并启动两个独立 PTY。
- 从 PTY 中启动现有 Claude Code CLI，并由 xterm.js 渲染。
- 并行模式同时显示两个终端。
- 切换会话前后两个 PTY 的 PID 完全不变；切换到另一项目再切回后，原有
  `TerminalWorkspace` 及 xterm 实例所在 host 仍挂载，后台 DOM 探针未被卸载。
  该断言是结构级保活，没有直接核验 xterm 的实际文本缓冲或滚动位置。
- 终端搜索打开与 Escape 关闭。
- GUI 主题与字号实时生效并写入设置。
- Claude CLI 诊断显示版本与路径。
- Job Guard 诊断显示活动；每个新 PTY 根进程成功加入 Windows Job Object。
- 生产构建中注入外部 `ELECTRON_RENDERER_URL` 后页面仍为本地 `file:` URL。
- 页面 CSP 包含 `script-src 'self'`，不含 `unsafe-inline` 脚本或 `unsafe-eval`。
- `window.open()` 未产生新窗口；外部 `location.href` 导航被拦截且页面仍为
  `file:` URL。
- 结束单个会话时 PTY 根进程及其 Claude CLI 后代进程被清理。
- 关闭窗口隐藏到托盘，PTY 继续运行；恢复窗口后会话仍在。自动化直接调用
  `BrowserWindow.show()` 恢复窗口，未点击真实托盘菜单。
- 完全退出时剩余 PTY 根进程与后代进程树被清理。
- 重启后主题和字号保持，旧运行时会话不再错误显示为活动。
- 强制 `SIGKILL` 主进程后，Job Object 关闭触发级联清理；当前跟踪的单棵 PTY
  根进程与 Claude CLI 后代全部退出，重启后会话状态为 `exited`。
- 页面无未捕获 JavaScript 错误。

## 3. 规划书验收矩阵

状态说明：

- **已验证**：有自动化或可重复的实际运行证据。
- **已实现，部分验证**：代码与集成存在，但未覆盖所有手册场景。
- **未执行**：本环境未进行该项真实请求或人工交互验证。

### 3.1 真实功能

| 规划项 | 状态 | 证据或限制 |
| --- | --- | --- |
| 发现并启动现有 Claude Code CLI | 已验证 | 诊断识别 2.1.319；真实 PTY 启动原生 CLI |
| 第三方模型网关请求成功 | 未执行 | 未主动发送模型请求，避免使用用户凭据和产生外部调用 |
| 用户设置、MCP、Skills、Hooks、权限配置正常 | 已实现，部分验证 | 应用继承既有环境与配置，不写入 Claude 配置；未逐项调用外部能力 |
| `/help`、`/model`、`/mcp` 原生命令 | 未执行 | 命令由原生 CLI 全权处理，未逐条自动输入验证 |
| 完整交互式输入输出 | 已实现，部分验证 | 真实 ConPTY + xterm I/O 路径可用；未自动完成整轮 Agent 对话 |
| 创建多个独立会话 | 已验证 | E2E 同时保持 2 个 PTY |
| 切换会话不重启 PTY | 已验证 | 切换前后活动 PTY 的 PID 完全一致 |
| 保留后台终端滚动位置和内存缓冲 | 已验证（结构保活） | 切换到空项目时终端 workspace 仍挂载，仅叠加空态；DOM 探针未被卸载。未逐像素核对 xterm 滚动位置 |
| 结束会话无遗留 Claude 子进程 | 已验证 | 正常结束、完全退出、强制崩溃三条路径均追踪并确认 PTY 根进程与 Claude CLI 后代退出 |
| 历史恢复由 CLI 原生功能完成 | 已实现，部分验证 | 入口分别调用 `claude -c` 与 `claude -r`；未自动操作历史选择器 |
| 关闭窗口到托盘不终止 CLI | 已验证 | 托盘隐藏后仍保留活动 PTY |
| 完全退出提示进程影响 | 已实现，部分验证 | 代码在活动会话时显示确认对话框；E2E 为自动化退出绕过该对话框 |

### 3.2 终端和视觉

| 规划项 | 状态 | 证据或限制 |
| --- | --- | --- |
| 中文 IME 正常 | 未执行 | 未做自动或人工 IME 组合输入验收 |
| CJK、Emoji、组合字符不错位 | 已实现，部分验证 | 加载 Unicode 11 addon；未覆盖全部组合序列 |
| GUI 字体和终端字体独立配置 | 已实现 | 两组设置与持久化字段完全分离 |
| 字体、字号、行高实时生效 | 已验证（GUI 字号） | E2E 验证主题和 GUI 字号；终端设置路径为实时更新 |
| 主题、ANSI 颜色、光标正常 | 已实现，部分验证 | 深浅主题自动化；ANSI/光标未逐项截图验收 |
| resize 后 CLI 正确重绘 | 已实现，部分验证 | FitAddon、ResizeObserver 与 IPC resize 已接入；未做逐尺寸回归 |
| 高 DPI 布局正常 | 未执行 | 当前环境未切换多组缩放比例验收 |
| 大量输出时 UI 不卡顿 | 已实现，部分验证 | PTY 12ms/512KB 批量输出；未执行压力基准 |
| 复制、粘贴、搜索、滚动 | 已实现，部分验证 | 搜索自动化；复制/粘贴/滚动为代码路径与手动检查 |
| 浅色、深色、跟随系统 | 已实现，部分验证 | 深色自动化；浅色与系统跟随共享同一主题解析路径 |

### 3.3 安全和数据

| 规划项 | 状态 | 证据 |
| --- | --- | --- |
| 未设置 `CLAUDE_CONFIG_DIR` | 已验证 | 全仓库无赋值；运行时诊断显示仅为继承状态 |
| 未复制或迁移 Claude 配置 | 已验证 | 应用只读写自身数据目录 |
| 未在应用 JSON 保存凭据 | 已验证 | 数据模型仅含设置、项目路径和会话元数据 |
| 未在日志输出敏感环境变量 | 已验证 | 无环境变量值日志；诊断不返回环境变量值 |
| Renderer 无直接 Node.js 权限 | 已验证 | `sandbox`、`contextIsolation`、`nodeIntegration:false` |
| IPC 经发送方和参数校验 | 已验证（边界单元测试 + 代码审查） | 校验窗口、main frame、文档 URL；参数校验 ID、模式、长度和尺寸。E2E 以可信页面正常调用，未构造恶意 subframe/不可信文档完成运行时负向验证 |
| 未自动修改项目配置 | 已验证 | 无项目配置写路径 |
| 设置文件损坏时恢复默认 | 已验证 | 单元测试覆盖损坏 JSON 隔离与默认恢复 |
| 异常退出后无明显孤儿进程 | 已验证 | 源码与打包版均强制终止主进程，Job Object 关闭后无 PTY/Claude 孤儿 |
| 生产 CSP、导航与新窗口拦截 | 已验证 | 打包版注入远程 URL 后仍加载本地文件；CSP 无 `unsafe-inline`/`unsafe-eval`；外部导航和 `window.open` 被拒绝 |

### 3.4 明确范围差异

| 规划项 | 状态 | 差异说明 |
| --- | --- | --- |
| 快捷键设置 | 部分实现 | `Ctrl+Shift+N`、`Ctrl+F`、`Ctrl+,`、`Ctrl+B` 可用，但当前固定，设置页未提供编辑或持久化入口 |
| 用户主动触发 `claude doctor` | 部分实现 | 诊断页说明用途和手动命令，但未提供应用内一键执行入口 |

## 4. 打包检查

`npm run package` 已实际生成：

| 产物 | 大小 | SHA-256 | 检查结果 |
| --- | ---: | --- | --- |
| `release/Claude Terminal Desktop-0.1.0-x64-setup.exe` | 129,238,802 bytes | `BBB50FD76391DB141BA99F6ECFC7C2EFEFDFFFCD6E93D4B11ADFB3D97CFEFA56` | 未安装执行 |
| `release/Claude Terminal Desktop-0.1.0-x64-portable.exe` | 114,445,752 bytes | `750419DE43FD8708C97B174FD54E2EE4100FB9128522BA6F2C2D0171EED9A69E` | 未直接启动 |
| `release/win-unpacked/Claude Terminal Desktop.exe` | 解包目录 | 随 `app.asar` 构建生成 | 已真实启动并通过完整 E2E 与崩溃 E2E |
| node-pty / ConPTY 原生文件 | - | - | 已 unpack 到 `app.asar.unpacked` 并可运行 |

打包时发现并修复了两类目标共用同一文件名、便携版覆盖安装包的问题。现在两类
产物分别带有 `-setup` 和 `-portable` 后缀。旧的过期产物已清理，当前只保留与
上述清单一致的安装包、便携版及其 blockmap。

## 5. 未验证项与已知限制

- 未发送真实模型请求，未验证第三方模型网关的线上响应。
- 未在应用内逐项验证 `/help`、`/model`、`/mcp`、MCP 工具、Skills、Hooks 和权限审批。
- 未自动验证中文 IME、全部 CJK/Emoji/组合字符、高 DPI 和超大输出压力。
- 未自动操作 Claude Code 首次 workspace trust、登录或 `claude -r` 选择器。
- 未安装 NSIS 包，也未直接启动 portable 包；两者已构建但仅 `win-unpacked` 完整 E2E。
- 未在 Windows 10、真实多组高 DPI 或超大输出压力下执行回归。
- 快捷键固定且不可编辑；`claude doctor` 仅显示手动命令，应用内不能一键触发。
- 崩溃 E2E 只覆盖一棵 PTY/Claude 进程树，未做多会话同时崩溃的专项验证。
- CSP 测试验证策略文本以及导航/弹窗实际拦截，但未注入内联脚本或 `eval` 负向载荷。
- 正常清理失败后的“保留应用并报错”分支只有代码审查，未执行故障注入测试。
- 默认加载 PowerShell Profile；若受信 Profile 在 PTY 入 Job Object 前启动持久
  或分离进程，这些进程不在已验证的崩溃级联清理范围内。
- 同项目多会话只给出文件冲突警告，不提供文件锁或合并能力。
- 未签名；无自动更新、云同步、远程控制、内置编辑器或 Git 图形界面。
- 完整 `npm audit` 仍报告 6 个 moderate 级开发依赖告警，生产依赖审计为 0。

## 6. 产品大阶段复审

初始独立复审发现并推动修复了以下问题：

- 生产包曾可无条件采用 `ELECTRON_RENDERER_URL`，远程页面可获得特权 Preload
  API；IPC 也未校验文档 URL。
- bootstrap 失败时错误页被加载态遮挡，无法恢复。
- 切换到无活动会话的项目会卸载整个终端 workspace，丢失后台终端视口缓冲。
- 正常退出清理失败后可能把仍存活会话标为已结束，并缺少主进程崩溃时的系统级
  进程级联保护。
- 验收记录对导航、CSP、PID 保持等自动化的证据描述强于实际断言。

`ab0ba81` 已针对以上问题完成修复：生产环境只加载本地文件，开发 URL 仅接受
loopback origin；导航与 IPC 使用精确页面信任校验；错误页优先渲染；终端
workspace 在空态下保持挂载；新增 Windows Job Object 守护、PTY 启动门控和
崩溃 E2E；退出清理失败时保留应用并报错。

针对 `ab0ba81` 与文档提交 `c50fd70` 的定向独立复审**通过**，未发现阻断性或
重要性功能缺陷。复审期间实际通过 `npm test`（3 文件、14 项）、`npm run check`、
源码 `test:e2e` 和源码 `test:e2e:crash`，并核对当前 `app.asar` 与源码构建一致。
复审同时指出：缓冲保活是结构级断言、特权 IPC 缺少恶意页面负向载荷、CSP 未做
内联/`eval` 执行测试、崩溃 E2E 只覆盖单棵进程树、清理失败未故障注入，以及
PowerShell Profile 在 Job 分配前启动分离进程的理论边界；这些均已作为证据边界
或已知限制记录，不构成本次 MVP 的阻断项。

受复审约束，本次定向复审未重新运行打包版 E2E；打包版完整 E2E 与崩溃 E2E 的
通过证据来自此前对当前产物的实际执行，不能表述为复审者独立复验。文档-only
变更不触发重新打包，所有代码修复均已在修复阶段重跑受影响的单元测试、源码与
打包 E2E 以及崩溃 E2E。

