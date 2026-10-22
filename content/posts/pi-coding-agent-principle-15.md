---
id: 15
title: "Pi Coding Agent 入门"
slug: "pi-coding-agent-principle"
date: "2026-08-21T11:24:08+08:00"
updated: "2026-09-19T15:23:20.771+08:00"
summary: "我为什么存这个：Pi 是我正在做的 AgentCraft 项目底层的 agent runtime（锁死 0.84.3），这篇教程把它的设计哲学、架构分层、四种运行模式、扩展机制讲得很系统，正好补齐我对上游工具的理解。而且它和我上一份 Cla…"
cover: "/uploads/2026/09/1789799239-40230689d984f12a.jpg"
category: "ai"
tags: ["agentcraft","pi-agent","agent-harness","agent-loop","rpc","extension","skill-progressive-disclosure","terminal-agent"]
isTop: false
draft: false
---
## 原始内容

> 我为什么存这个：Pi 是我正在做的 AgentCraft 项目底层的 agent runtime（锁死 0.84.3），这篇教程把它的设计哲学、架构分层、四种运行模式、扩展机制讲得很系统，正好补齐我对上游工具的理解。而且它和我上一份 Claude Skills 原理资料是同一套思想（渐进式披露、原语而非功能），可以串起来看。

### 一、核心定位

Pi 是运行在终端里的 AI 编码 Agent，类似 Claude Code、OpenAI Codex CLI。

**官方理念**："There are many agent harnesses but this one is yours"（Agent 工具很多，但这个是你自己的）。

工作方式：给 Pi 一句话，它就能在项目目录里读文件、写文件、跑命令，循环调用大模型直到完成任务。

**核心理念**：用最小的内核加极强的可扩展性，让你把工具改造成适合自己的样子，而不是反过来去适应工具。

Pi 不是一个单独的程序，而是一套由**四个 npm 包**组成的工具链。普通用户只需安装最上层的 `@earendil-works/pi-coding-agent`。

**适合人群**：偏好终端工作流的开发者；想深度定制甚至让 Agent 改写自己工具的用户；需要同时接入多家大模型的人；想把 Agent 能力嵌入自己程序的开发者（SDK 或 RPC 模式）。

> 安全前提：Pi 默认以用户权限运行，**没有内置沙箱**。

### 二、核心设计哲学：原语而非功能（Primitives, Not Features）

**故意不内置的功能**：

| 不内置的功能 | Pi 的替代方案 |
|---|---|
| MCP 协议集成 | 把工具写成带 README 的 CLI，或装一个 MCP 扩展 |
| 子 Agent（subagents） | 用 tmux 开多个会话，或自己写扩展 |
| 权限确认弹窗 | 放进容器里跑，或自己写确认流程扩展 |
| 计划模式（plan mode） | 把计划写到文件里，或写扩展 |
| 内置待办事项 | 用一个 TODO.md 文件，或装扩展 |
| 后台 bash | 用 tmux 获得完整可观测性 |

**为什么这样做**：这些功能在不同团队里需求差异巨大，强行内置会让工具臃肿且难以贴合实际工作流。做法是保留一个干净的最小内核，把所有「功能」都变成可安装、可编写、可分享的扩展、技能、提示模板和主题。甚至可以直接让 Pi 帮你把这些功能写出来，写完用 `/reload` 重载，立刻就能用。

> Adapt Pi to your workflows, not the other way around（让 Pi 适应你的工作流，而不是你适应 Pi）。

### 三、架构：四个核心包（自下而上）

| 包名 | 作用 | 何时会单独用到 |
|---|---|---|
| `@earendil-works/pi-coding-agent` | 交互式编码 Agent CLI，用户直接安装使用的入口 | 绝大多数情况只需这个 |
| `@earendil-works/pi-agent-core` | Agent 运行时，负责工具调用循环和状态管理 | 想自己搭一个非编码类的 Agent 时 |
| `@earendil-works/pi-ai` | 统一的多厂商 LLM API（OpenAI、Anthropic、Google 等） | 只想用一个统一接口调多家模型时 |
| `@earendil-works/pi-tui` | 终端 UI 库，支持差分渲染 | 想写自己的终端应用时 |

**分层关系**：`pi-tui` / `pi-ai` → `pi-agent-core` → `pi-coding-agent`，上层依赖下层。日常用的 `pi` 命令只是最上层包的入口。

**四种运行模式**：

| 模式 | 说明 | 典型场景 |
|---|---|---|
| Interactive | 完整的终端 UI 体验 | 日常编码、对话式开发 |
| Print / JSON | `pi -p "提问"` 一次性输出；`--mode json` 输出事件流 | 脚本自动化、管道处理 |
| RPC | 通过 stdin/stdout 的 JSON 协议通信 | 非 Node 程序集成 |
| SDK | 作为库嵌入到你的应用里 | 在自家产品里集成 Agent 能力 |

> **RPC 模式是 AgentCraft 的对接面** —— 详见下方「与 AgentCraft 的挂钩」。

### 四、Agent 工作原理：turn 循环

每发一条消息，Pi 就启动一个 **agent 循环**。核心是 turn 循环：

```
模型 → 可能调用工具 → Pi 执行工具 → 结果塞回上下文 → 模型继续
  ↑                                                        │
  └──────────── 直到模型不再调用工具，给出最终回复 ←────────┘
```

理解这个循环，就理解了 Pi 的工作方式。

### 五、四个内置工具

Pi 默认只给模型四个工具：

| 工具 | 作用 | 是否默认启用 |
|---|---|---|
| `read` | 读取文件内容 | 是 |
| `write` | 创建或覆盖文件 | 是 |
| `edit` | 对文件做局部补丁修改 | 是 |
| `bash` | 运行 shell 命令 | 是 |
| `grep` | 搜索文件内容 | 否（需通过工具选项开启） |
| `find` | 按条件查找文件 | 否（需通过工具选项开启） |
| `ls` | 列出目录内容 | 否（需通过工具选项开启） |

控制可用工具：

```bash
pi --tools read,grep,find,ls -p "审查这段代码"     # 只读模式
pi --exclude-tools ask_question                  # 禁用某个工具
pi --no-builtin-tools -e ./my-extension.ts       # 只保留扩展提供的工具
pi --no-tools -p "解释一下这个概念"                 # 完全禁用工具，纯对话
```

> Pi 在当前工作目录里运行，能修改文件，建议配合 git 使用。

### 六、项目指令：AGENTS.md

AGENTS.md 是 Pi 的项目指令文件，作用类似 Claude Code 的 CLAUDE.md —— 而且 Pi **同时支持这两种文件名**。

```markdown
# 项目指令

- 改完代码后运行 `npm run check`。
- 不要在本地跑生产环境的数据库迁移。
- 回答尽量简洁。
```

**加载顺序**（优先级从低到高）：

| 位置 | 作用范围 |
|---|---|
| `~/.pi/agent/AGENTS.md` | 全局 |
| 父目录的 `AGENTS.md` | 项目级（逐层向上查找） |
| 当前目录的 `AGENTS.md` | 项目级（优先级最高） |

**更彻底地控制系统提示**：

- `.pi/SYSTEM.md` 会**替换**默认系统提示
- `.pi/APPEND_SYSTEM.md` 则是**追加**（全局对应 `~/.pi/agent/` 下同名文件）

改完要 `/reload` 重载或重启 Pi 才生效。

### 七、扩展 Extensions（可扩展性核心）

扩展是一个 **TypeScript 模块**，能订阅生命周期事件、注册自定义工具、添加命令和快捷键。通过 **jiti** 加载，所以直接写 TypeScript 即可，**无需编译**。

**位置**：`~/.pi/agent/extensions/*.ts`（全局）或 `.pi/extensions/*.ts`（项目级）。

**最小扩展示例**：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  // 1. 监听 session_start：会话启动时弹通知
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("扩展已加载！", "info");
  });

  // 2. 监听 tool_call：拦截危险的 bash 命令
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
      const ok = await ctx.ui.confirm("危险操作！", "允许执行 rm -rf 吗？");
      if (!ok) return { block: true, reason: "被用户阻止" };
    }
  });

  // 3. 注册自定义工具，模型可以调用它
  pi.registerTool({
    name: "greet",
    label: "打招呼",
    description: "按名字向某人打招呼",
    parameters: Type.Object({ name: Type.String({ description: "要打招呼的名字" }) }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return { content: [{ type: "text", text: `你好，${params.name}！` }], details: {} };
    },
  });

  // 4. 注册斜杠命令 /hello
  pi.registerCommand("hello", {
    description: "打个招呼",
    handler: async (args, ctx) => { ctx.ui.notify(`你好 ${args || "world"}！`, "info"); },
  });
}
```

临时加载测试：`pi -e ./my-extension.ts`

**扩展能力清单**：

| 能力 | 对应方法 | 典型用途 |
|---|---|---|
| 注册自定义工具 | `pi.registerTool()` | 让模型调用你的业务接口 |
| 注册命令 | `pi.registerCommand()` | 添加自己的斜杠命令 |
| 注册快捷键 | `pi.registerShortcut()` | 绑定自定义快捷键 |
| 拦截工具调用 | `tool_call` 事件 | 权限确认、命令改写 |
| 修改上下文 | `context` 事件 | 过滤历史、注入 RAG 内容 |
| 注入消息 | `pi.sendMessage()` | 动态补充上下文 |
| 注册供应商 | `pi.registerProvider()` | 接入私有模型网关 |
| 自定义 UI | `ctx.ui` 系列 | 对话框、状态栏、组件 |

> Pi 仓库里有 50 多个示例扩展，涵盖子 Agent、计划模式、权限门、SSH 执行、沙箱等。

### 八、技能 Skills（渐进式披露）

技能和扩展的区别：**技能主要是给模型看的指令和脚本，按需加载**。Pi 实现了 Agent Skills 标准，所以也能直接用 Claude Code、OpenAI Codex 等工具的技能。

**渐进式披露原则**：启动时 Pi 只把每个技能的名字和描述放进系统提示；当任务匹配时，模型才用 `read` 工具加载完整的技能说明。这样既能装很多技能，又不会一开始就把上下文撑满。

**位置**：`~/.pi/agent/skills/`、`~/.agents/skills/`（全局，跨工具共享）、`.pi/skills/`、`.agents/skills/`（项目级）。

**结构**：

```text
my-skill/
├── SKILL.md              # 必需：前置信息 + 指令
├── scripts/              # 辅助脚本
│   └── process.sh
├── references/           # 按需加载的详细文档
│   └── api-reference.md
└── assets/
    └── template.json
```

**SKILL.md 前置信息最重要的两个字段**：

| 字段 | 是否必填 | 说明 |
|---|---|---|
| `name` | 必填 | 最多 64 字符，只能用小写字母、数字、连字符 |
| `description` | 必填 | 最多 1024 字符，决定模型何时加载这个技能，要写得具体 |

> `description` 写得好不好，直接决定模型会不会在正确时机用上这个技能。写「处理 PDF 文件，提取文本和表格、填表单、合并多个 PDF」远好过写「帮助处理 PDF」。

手动调用：`/skill:brave-search`、`/skill:pdf-tools extract`

### 九、配置与凭证

Pi 本身不包含大模型，需要提供至少一个 Provider 的访问凭证。

**方式一：订阅登录**（复用 Claude Pro/Max、ChatGPT Plus/Pro、GitHub Copilot 订阅）。启动后 `/login`。

**方式二：API Key**（最灵活）：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

支持 15 家以上供应商（Anthropic、OpenAI、Google Gemini、DeepSeek、Groq、Mistral、xAI、OpenRouter、Hugging Face、Azure、Bedrock、Vertex、Cloudflare 等）。

**凭证解析优先级**：

| 优先级 | 来源 |
|---|---|
| 1（最高） | 命令行 `--api-key` 参数 |
| 2 | `auth.json` 里的条目（API Key 或 OAuth 令牌） |
| 3 | 环境变量 |
| 4 | `models.json` 里自定义供应商的 Key |

`auth.json` 创建时权限 0600，Key 字段支持三种高级写法：`"!命令"`（执行命令取 stdout）、`"$变量名"`（取环境变量）、纯字面量。

### 十、会话管理：树形历史

Pi 的会话不是一条直线，而是**一棵树**。在任意历史节点分叉都不丢失原分支，所有分支存在同一个会话文件里。

会话自动保存到 `~/.pi/agent/sessions/`，按工作目录归类。用 `/tree` 打开会话树视图，`/fork` 从更早的用户消息分叉，`/clone` 复制当前分支。

上下文接近上限时 Pi 会自动压缩；也可手动 `/compact 重点保留最近的改动和错误处理`。

### 十一、包管理与斜杠命令（节选）

```bash
pi install npm:@foo/pi-tools          # 从 npm 安装包
pi install git:github.com/badlogic/pi-doom   # 从 git 安装
pi update --all                       # 更新 Pi 和所有包
pi config                             # 启用或禁用包里的各项资源
```

常用斜杠命令：`/login` `/logout` `/model` `/settings` `/resume` `/new` `/session` `/tree` `/fork` `/clone` `/compact` `/export` `/share` `/reload` `/trust` `/hotkeys`。

### 十二、安全须知

**没有内置沙箱**：Pi 以启动它的用户身份运行，拥有该用户的全部权限。扩展是 TypeScript 模块，权限和 Pi 进程一样。这是有意为之 —— 一个不完整的进程内沙箱会让人误以为是安全边界，实际却仍依赖宿主的 shell、文件系统和凭证。

> **真正的隔离必须来自操作系统或容器/虚拟化边界，而不是 Pi 内部。**

**项目信任**（三级别）：`ask`（默认，交互式询问）/ `always`（始终信任，`-a`）/ `never`（从不信任，`-na`）。决策保存在 `~/.pi/agent/trust.json`。项目信任只是「输入加载守卫」，**不能**让不可信的代码或提示注入变安全。

**无人值守任务的官方建议**：把 Pi 放进容器/VM/远程沙箱；只挂载必要工作区；不要挂载宿主 `~/.pi/agent`（含凭证）；只传最少必要的 API Key；限制网络；结果复制回可信系统前先审查 diff。

> 注意：宿主工作区若以读写方式挂载进容器，容器内的写入仍会改到宿主文件。

### 技术栈汇总

- **语言**：TypeScript（扩展无需编译，通过 jiti 加载）
- **运行时**：Node.js
- **UI**：自研终端 UI 库（差分渲染）
- **包管理**：npm / pnpm / bun，支持从 npm 和 git 安装 Pi 包
- **参数校验**：typebox
- **LLM 集成**：统一多厂商 API（15+ 供应商）
- **集成协议**：Print/JSON、RPC（stdin/stdout JSON）、SDK
- **会话存储**：树形结构，`~/.pi/agent/sessions/`
- **配置目录**：`~/.pi/agent/`（auth.json、models.json、trust.json、AGENTS.md、extensions、skills 等）

### 官方资源

- GitHub：https://github.com/earendil-works/pi
- 官网：https://pi.dev/
- 文档：https://pi.dev/docs/latest

## 摘要

Pi 是一个**「最小内核 + 极致可扩展」**的终端 AI 编码 Agent。它的核心设计哲学是「原语而非功能」（Primitives, Not Features）—— 故意不内置 MCP、子 Agent、权限弹窗、计划模式、内置 todo、后台 bash，而是把这些都留给扩展、技能、提示模板和主题去实现，甚至可以让 Pi 自己把功能写出来再 `/reload` 即用。架构上是四层 npm 包（tui/ai → agent-core → coding-agent），提供交互式、Print/JSON、RPC、SDK 四种运行模式。工作原理是标准的 agent turn 循环（模型 → 工具 → 结果回填 → 模型，直到不再调工具）。可扩展性靠两套机制：**扩展**（TypeScript 模块，jiti 免编译加载，可注册工具/命令/快捷键、拦截 tool_call、改上下文）和**技能**（Agent Skills 标准，渐进式披露按需加载，与 Claude Code/Codex 技能互通）。安全性上明确表态**不内置沙箱**，隔离必须由 OS 或容器提供。
