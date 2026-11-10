# Claude Terminal Desktop

一个面向 Windows 的 Claude Code CLI 桌面外壳。应用使用真实 ConPTY 运行现有
`claude` CLI，保留原生终端交互、用户配置、MCP、Skills、Hooks 与权限流程；
桌面层只负责终端呈现、项目与会话导航、窗口生命周期和外观设置。

## 已实现能力

- 在项目目录中启动、继续或恢复现有 Claude Code CLI 会话。
- 同一项目内多个独立 PTY；切换会话不会销毁或重启后台终端。
- 专注、导航、并行三种预设布局。
- 系统托盘运行；关闭窗口可继续保留 CLI，完全退出前确认活动会话。
- GUI 与终端字体、字号、字重、行高、密度、光标、滚动和主题独立设置。
- 终端基础色与 16 色 ANSI 调色板、Unicode 11、WebGL 自动回退。
- 复制、粘贴、搜索、resize、高吞吐输出批量写入。
- PowerShell / PowerShell 7 / 自定义 PowerShell 路径与 Profile 开关。
- PowerShell、Claude CLI、应用版本和配置继承状态诊断。
- 本地 JSON 原子保存、损坏文件隔离恢复、单实例和进程树清理。

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

1. 点击“添加项目目录”选择工作目录。
2. 使用“新会话”“继续最近”“恢复历史”启动原生 CLI。
3. 关闭窗口默认隐藏到托盘；从托盘菜单或设置页可完全退出。
4. 使用 `Ctrl+Shift+N` 新建会话，`Ctrl+F` 搜索终端，`Ctrl+,` 打开设置，
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
| `npm run package` | 生成 NSIS 安装包和便携版 |
| `npm run package:dir` | 生成未压缩的 `release/win-unpacked/` |

端到端测试需要可交互的 Windows 桌面和已安装的 Claude Code CLI。测试使用
`test-results/e2e/user-data` 作为隔离数据目录，不会写入正常用户数据。

打包后可针对真实可执行文件复用同一套 E2E：

```powershell
$env:CTD_E2E_EXECUTABLE = "release\win-unpacked\Claude Terminal Desktop.exe"
node scripts/e2e-smoke.mjs
```

## 产物

`npm run package` 生成：

- `release/Claude Terminal Desktop-0.1.0-x64-setup.exe`
- `release/Claude Terminal Desktop-0.1.0-x64-portable.exe`
- `release/win-unpacked/Claude Terminal Desktop.exe`

当前产物未做代码签名，Windows SmartScreen 可能显示未知发布者提示。

## 本地数据

正常运行时数据位于：

```text
%APPDATA%\ClaudeTerminalDesktop\
├── settings.json
├── projects.json
└── sessions.json
```

同目录还包含 Chromium/Electron 的缓存数据。三个 JSON 文件使用临时文件加
rename 的原子写入方式；损坏文件会改名为 `.corrupt-<timestamp>` 后恢复默认值。

应用只保存设置、项目路径和应用内会话元数据，不保存终端日志、完整对话、
凭据或环境变量值。若不需要这些工作区数据，可在应用完全退出后删除整个
`%APPDATA%\ClaudeTerminalDesktop` 目录。

## 安全边界

- Renderer 启用 `sandbox` 与 `contextIsolation`，关闭 `nodeIntegration`。
- Preload 只暴露白名单 IPC API；主进程校验发送窗口、主 frame 和参数。
- 拒绝权限请求、外部导航、新窗口和任意页面加载。
- 生产内容使用动态严格 CSP，开发 CSP 仅额外允许 Vite 所需来源。
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

