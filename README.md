# Claude Terminal Desktop

一个面向 Windows 的 Claude Code CLI 桌面外壳。应用使用真实 ConPTY 运行现有
`claude` CLI，保留原生终端交互、用户配置、MCP、Skills、Hooks 与权限流程；
桌面层只负责终端呈现、项目与会话导航、窗口生命周期和外观设置。

## 已实现能力

- 在项目目录中启动、继续或恢复现有 Claude Code CLI 会话。
- 首次启动或工作区为空时自动创建并登记“默认工作区”，无需先选择项目。
- 同一项目内多个独立 PTY；切换会话不会销毁或重启后台终端。
- 每个项目在当前运行周期内记住上次选中的可见对话；侧栏聚焦后可用方向键
  切换项目与会话。
- 专注、导航、并行三种预设布局。
- 系统托盘运行；关闭窗口可继续保留 CLI，完全退出前确认活动会话。
- GUI 与终端字体、字号、字重、行高、密度、光标、滚动和主题独立设置。
- 终端默认 Cascadia Mono 16px、400 字重、1.15 行高；旧版完整默认组合会
  自动迁移，用户自定义的字体设置不会被覆盖。
- 终端基础色与 16 色 ANSI 调色板、Unicode 11；当前暂时使用 xterm 默认
  DOM renderer 验证字体，保留 WebGL addon 依赖但不加载。PTY 强制
  `xterm-256color`/`truecolor` 并清除宿主继承的禁色环境变量。
- 复制、粘贴、搜索、resize、高吞吐输出批量写入。
- PowerShell / PowerShell 7 / 自定义 PowerShell 路径与 Profile 开关。
- PowerShell、Claude CLI、应用版本和配置继承状态诊断。
- 本地 JSON 原子保存、损坏文件隔离恢复、单实例和进程树清理。
- Windows Job Object 崩溃保护：主进程被强制终止时，级联结束全部 PTY 与
  Claude CLI 后代；Job Guard 不可用时会在会话提示和诊断页明确告警。

## 环境要求

- Windows 10/11 x64。
- 已单独安装并登录 Claude Code CLI，`claude --version` 在当前环境可用。
- 源码开发需要 Node.js 22.12 或更高版本。

应用不会安装或更新 Claude Code，也不会索取、保存 API Key、Token 或完整对话。

## 快速开始

```powershell
npm install
npm run dev
```

首次进入后：

1. 应用会自动准备“默认工作区”。也可以点击“添加项目”选择已有项目目录。
2. 使用“启动新会话”“继续最近”“恢复历史”启动原生 CLI。
3. 侧栏聚焦时，`←/→` 切换项目，`↑/↓` 切换当前项目的会话；`F6` 将焦点移到
   侧栏。终端聚焦时使用 `Ctrl+Shift+←/→` 和 `Ctrl+Shift+↑/↓` 全局切换。
4. 关闭窗口默认隐藏到托盘；从托盘菜单或设置页可完全退出。
5. 使用 `Ctrl+Shift+N` 新建会话，`Ctrl+F` 搜索终端，`Ctrl+,` 打开设置，
   `Ctrl+B` 切换专注/导航布局。

## 命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动开发模式 |
| `npm run build` | 类型检查并构建 `out/` |
| `npm run typecheck` | 检查 main、preload 和 renderer |
| `npm test` | 运行 Vitest 单元测试 |
| `npm run check:pty` | 用当前 Electron 验证 node-pty / ConPTY |
| `npm run check` | 类型检查、单元测试、ConPTY 检查 |
| `npm run test:e2e` | 构建并运行 Electron 端到端冒烟测试 |
| `npm run test:e2e:crash` | 构建并验证强制终止主进程后无 PTY/CLI 孤儿 |
| `npm run package` | 生成 NSIS 安装包和便携版 |
| `npm run package:dir` | 生成未压缩的 `release/win-unpacked/` |

端到端测试需要可交互的 Windows 桌面和已安装的 Claude Code CLI。测试使用
`test-results/e2e*` 与 `test-results/crash/user-data` 作为隔离数据目录，不会
写入正常用户数据。`test:e2e` 覆盖安全边界、真实 CLI、项目与终端缓冲、双 PTY
切换、进程树清理、托盘和重启持久化；`test:e2e:crash` 会强制结束应用主进程，
验证当前跟踪的单棵 PTY/Claude 进程树被 Job Object 级联清理，并确认重启后
旧会话被标记为已结束。

打包后可针对真实可执行文件复用两类 E2E：

```powershell
$env:CTD_E2E_EXECUTABLE = "release\win-unpacked\Claude Terminal Desktop.exe"
node scripts/e2e-smoke.mjs
node scripts/crash-smoke.mjs
```

## 产物

`npm run package` 生成：

| 产物 | 大小 | SHA-256 |
| --- | ---: | --- |
| `release/Claude Terminal Desktop-0.1.0-x64-setup.exe` | 129,240,300 bytes | `112EBA38A58AE9B12A661BD524CC96E0BB207DA18AFB75A8947A3015907268A2` |
| `release/Claude Terminal Desktop-0.1.0-x64-portable.exe` | 114,447,865 bytes | `6A63EEA2AE18682583A519BAA52DEB74A5EC03704954BE6DF407E332B5B3D0FD` |
| `release/win-unpacked/Claude Terminal Desktop.exe` | 解包目录 | 随 `app.asar` 构建生成 |

旧的过期产物已清理。当前产物未做代码签名，Windows SmartScreen 可能显示未知
发布者提示；本版本只对 `win-unpacked` 产物执行了完整功能与崩溃 E2E，未在实机
安装 NSIS 包或直接启动 portable 包。

## 本地数据

正常运行时数据位于：

```text
%APPDATA%\ClaudeTerminalDesktop\
├── settings.json
├── projects.json
├── sessions.json
├── runtime/       # PTY 启动门控的临时运行文件
└── job-guard/     # Job Object 进程保护的协调文件
```

同目录还包含 Chromium/Electron 的缓存数据。三个 JSON 文件使用临时文件加
rename 的原子写入方式；损坏文件会改名为 `.corrupt-<timestamp>` 后恢复默认值。
`runtime/` 与 `job-guard/` 只保存启动/进程协调状态，不属于用户偏好，也不包含
终端输出或 Claude 对话内容；强制崩溃后可能残留，可在应用退出后安全删除。

默认工作区位置：

- 源码开发模式：`<项目仓库>\default-workspace`
- 打包运行：系统“文档”目录下的
  `Claude Terminal Desktop\Default Workspace`
- 自动化测试：`test-results/e2e*/user-data/default-workspace` 与
  `test-results/crash/user-data/default-workspace`

应用只把这个目录作为 Claude CLI 的启动 cwd；不会自动扫描或索引其中的文件。

应用只保存设置、项目路径和应用内会话元数据，不保存终端日志、完整对话、
凭据或环境变量值。若不需要这些工作区数据，可在应用完全退出后删除整个
`%APPDATA%\ClaudeTerminalDesktop` 目录。

## 安全边界

- Renderer 启用 `sandbox` 与 `contextIsolation`，关闭 `nodeIntegration`。
- Preload 只暴露白名单 IPC API；主进程校验发送窗口、主 frame、文档 URL 和参数。
- 页面来源只接受精确的本地 `index.html` 文件 URL；开发模式额外接受 loopback
  Vite origin。生产包忽略 `ELECTRON_RENDERER_URL`，不会加载远程页面。
- 拒绝权限请求、外部导航和新窗口；生产内容使用严格 CSP，开发 CSP 仅额外允许
  Vite 所需来源。
- Windows Job Object 使用 `KILL_ON_JOB_CLOSE` 级联保护 PTY；PTY 先登记到 Job
  Object，再通过启动门控执行 Claude。正常退出先结束会话并停止守护进程；清理
  失败时应用保持运行并报告错误，不把仍存活的会话伪标为已结束。
- PTY 继承用户现有环境，但不设置、覆盖或迁移 `CLAUDE_CONFIG_DIR`。
- 应用不修改 Claude 用户配置、项目 `.claude` 配置或凭据。
- 自定义 Shell 路径只用于创建 PTY，不拼接来自 renderer 的命令片段。

## 已知限制

- 仅交付 Windows x64；默认以 PowerShell 为主，不支持 CMD、Git Bash 或多 CLI 抽象。
- 依赖用户已有 Claude CLI 与账号或第三方网关环境；未在本项目内验证真实模型请求。
- Claude Code 自身的首次 workspace trust、登录和权限提示仍由 CLI 原生处理。
- 历史恢复调用 `claude -r` 的原生选择器，不解析或枚举内部历史数据库。
- 多会话可同时打开同一项目，但应用不做文件锁；仅提示潜在文件冲突。
- 未自动验证中文 IME、CJK/Emoji 组合输入、高 DPI 和超大输出压力场景。
- 安装包与便携版已生成，但当前只对 `win-unpacked` 产物执行了完整 E2E。
- 每个项目的“上次对话”记忆只保存在当前进程内，重启应用后不恢复；历史对话
  仍通过 CLI 原生的“继续最近 / 恢复历史”入口打开。
- 若默认工作区创建失败（例如“文档”目录不可写），应用会保留空工作区并只向
  主进程日志记录错误，此时需要手动“添加项目”。
- 新建、搜索、设置、布局和项目/会话切换快捷键当前固定，未提供可视化自定义入口。
- 诊断页展示 `claude doctor` 的用途和手动命令，但未提供应用内一键执行按钮。
- 默认加载 PowerShell Profile；若受信 Profile 在 PTY 加入 Job Object 前自行
  启动了持久或分离进程，这些进程不在已验证的崩溃清理路径内。
- 崩溃 E2E 当前只跟踪一个 PTY 根进程及其 Claude 后代；多 PTY 同时崩溃清理
  尚未作为专项测试执行。
- 安装包未签名；当前无自动更新、云同步、远程控制、内置编辑器或 Git 图形界面。
- `npm audit` 的生产依赖为 0 漏洞；开发依赖 `electron-builder` 的打包工具链
  仍有 6 个 moderate 级传递依赖告警，不进入运行时产物。

详细验收范围与结果见 `docs/acceptance.md`。

## 故障排查

- **看不到 CLI**：确认在启动应用的同一用户环境下，`where.exe claude` 与
  `claude --version` 成功；也可打开应用设置中的“诊断”检查路径。
- **CLI 卡在启动阶段**：尝试关闭“加载用户 Profile”，排除阻塞的 PowerShell
  Profile；确认所选 Shell 在诊断中显示可用。
- **终端无法创建**：运行 `npm run check:pty`。应用要求 ConPTY，不会静默退化为
  普通 stdin/stdout pipe。
- **设置异常**：完全退出应用，备份并移除 `settings.json`，重启后会恢复默认值；
  原损坏文件也会被保留为 `.corrupt-<timestamp>`。

