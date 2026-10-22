---
id: 15
title: "Pi Coding Agent 入门"
slug: "pi-coding-agent-principle"
date: "2026-08-21T11:24:08+08:00"
updated: "2026-10-22T16:33:00+08:00"
summary: "Pi 是 AgentCraft 底层的 agent runtime。它没有把 MCP、子 Agent、计划模式这些功能全塞进内核，而是留了一套扩展和技能机制，让使用者自己拼。这篇整理它的架构、运行方式和几个关键设计。"
cover: "/uploads/2026/09/1789799239-40230689d984f12a.jpg"
category: "ai"
tags: ["agentcraft","pi-agent","agent-harness","agent-loop","rpc","extension"]
isTop: false
draft: false
---
AgentCraft 底层的 agent runtime 用的是 Pi，版本锁死在 `0.84.3`。我一开始只是把它当“另一个终端里的编码 Agent”，读完之后才发现，它和 Claude Code、Codex CLI 最大的不同，不是功能更多，而是刻意少做了很多东西。

官方那句 slogan 很直白：There are many agent harnesses but this one is yours。工具很多，但这个是你自己的。

## 最小内核，其他都交给扩展

Pi 的工作方式不复杂：给它一句话，它在项目目录里读文件、写文件、跑命令，循环调用模型，直到任务完成。

它故意不内置一些常见的 Agent 功能：MCP 集成、子 Agent、权限确认弹窗、计划模式、内置待办、后台 bash。对应的替代方案也很直接：工具写成带 README 的 CLI，或者装一个 MCP 扩展；子 Agent 用 tmux 开多个会话，或者自己写扩展；权限确认放进容器里跑，或者写一个确认流程；计划写到文件里；待办用一个 `TODO.md`；后台任务交给 tmux。

这套取舍的原因是，这些功能在不同团队里的需求差异太大，硬塞进内核只会让工具变臃肿。Pi 选择保留一个干净的内核，把功能变成可安装、可编写、可分享的扩展、技能、提示模板和主题。甚至可以让 Pi 自己把某个功能写出来，`/reload` 之后立刻就能用。

## 四个包和四种运行方式

Pi 不是单个程序，而是一套 npm 包：

- `pi-coding-agent`：最上层的交互式 CLI，普通用户装这个。
- `pi-agent-core`：Agent 运行时，负责工具调用循环和状态管理。想自己搭非编码类 Agent 时用。
- `pi-ai`：统一的多厂商模型接口。
- `pi-tui`：终端 UI 库，带差分渲染。

依赖关系是 `pi-tui` / `pi-ai` → `pi-agent-core` → `pi-coding-agent`。日常敲的 `pi` 命令只是最上层的入口。

运行方式有四种：交互式终端 UI；`pi -p "问题"` 的一次性输出，或者 `--mode json` 的事件流；通过 stdin/stdout 走 JSON 协议的 RPC；以及作为库嵌入自己应用的 SDK。AgentCraft 用的就是 RPC 模式。

## 一轮对话是怎么走的

每发一条消息，Pi 启动一个 agent 循环：

```text
模型 → 可能调用工具 → Pi 执行工具 → 结果塞回上下文 → 模型继续
  ↑                                                        │
  └──────────── 直到模型不再调用工具，给出最终回复 ←────────┘
```

理解这个循环，基本就理解了 Pi 的工作方式。它默认只给模型四个工具：`read`、`write`、`edit`、`bash`。`grep`、`find`、`ls` 默认不开，可以通过 `--tools` 打开；也可以只读模式运行，或者干脆禁用全部工具，只做纯对话。

```bash
pi --tools read,grep,find,ls -p "审查这段代码"
pi --no-tools -p "解释一下这个概念"
```

Pi 在当前工作目录里运行，能改文件，所以最好配合 git 用。

## 项目指令和扩展

项目指令放在 `AGENTS.md` 里，Claude Code 的 `CLAUDE.md` 也认。加载顺序是全局的 `~/.pi/agent/AGENTS.md`、逐层向上的父目录、当前目录，越靠近当前目录优先级越高。想换掉整个系统提示，用 `.pi/SYSTEM.md`；只想追加，用 `.pi/APPEND_SYSTEM.md`。改完要 `/reload` 或重启。

扩展是一个 TypeScript 模块，放在 `~/.pi/agent/extensions/*.ts` 或 `.pi/extensions/*.ts`。它通过 jiti 加载，不用编译。可以监听生命周期事件、注册工具、加命令和快捷键。比如拦截 `rm -rf`：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
      const ok = await ctx.ui.confirm("危险操作", "允许执行 rm -rf 吗？");
      if (!ok) return { block: true, reason: "被用户阻止" };
    }
  });
}
```

临时测试用 `pi -e ./my-extension.ts`。Pi 仓库里有几十个示例扩展，子 Agent、计划模式、权限门、SSH 执行、沙箱都能找到。

## 技能：按需加载的领域知识

技能和扩展不一样。扩展是给 Pi 加能力的代码，技能主要是给模型看的指令和脚本，按需加载。

它实现的是 Agent Skills 标准，所以 Claude Code、Codex 的技能也能直接拿来用。启动时 Pi 只把每个技能的名字和描述放进系统提示，任务匹配了，模型才用 `read` 去读完整的 `SKILL.md`。这样装很多技能也不会一开始就把上下文撑满。

技能可以放在 `~/.pi/agent/skills/`、`~/.agents/skills/`、`.pi/skills/` 或 `.agents/skills/`。结构一般是这样：

```text
my-skill/
├── SKILL.md
├── scripts/
│   └── process.sh
├── references/
│   └── api-reference.md
└── assets/
    └── template.json
```

`SKILL.md` 里最关键的是 `name` 和 `description`。`description` 决定模型什么时候会加载这个技能，写得越具体越好。“处理 PDF 文件，提取文本和表格、填表单、合并多个 PDF”就比“帮助处理 PDF”有用。

手动调用可以写 `/skill:brave-search` 或 `/skill:pdf-tools extract`。

## 配置、会话和安全

Pi 自己不带模型，需要至少一个 Provider 的凭证。可以 `/login` 复用 Claude Pro/Max、ChatGPT Plus/Pro、GitHub Copilot 订阅，也可以直接用 API Key：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

它支持十几家供应商，凭证解析优先级是命令行 `--api-key`、`auth.json`、环境变量、`models.json` 里的自定义 Key。

会话不是一条直线，而是一棵树。任意历史节点都能分叉，分支都存在同一个会话文件里，放在 `~/.pi/agent/sessions/`。`/tree` 看树，`/fork` 从更早的消息分叉，`/clone` 复制当前分支，上下文快满时可以 `/compact`。

安全上，Pi 说得很清楚：**没有内置沙箱**。它以启动它的用户身份运行，扩展也有同样的权限。项目信任分 `ask`、`always`、`never` 三档，但它只是加载守卫，不能让不可信代码变安全。真正要隔离，得靠容器、VM 或远程沙箱。跑无人值守任务时，只挂必要的工作区，不要把宿主 `~/.pi/agent` 挂进去，API Key 也给最小的。

## 最后

Pi 最值得学的不是某个 API，而是它的取舍：内核只保留原语，功能交给扩展和技能；协议和边界写清楚，剩下的让使用者自己拼。

这对 AgentCraft 的影响很直接。我们不重写 agent loop，只把 Pi 当一个 RPC 进程驱动，容器、数据库、SSE、安全策略都留在控制面。边界清楚之后，很多实现问题会自己消失。

参考：

- <https://github.com/earendil-works/pi>
- <https://pi.dev/>
- <https://pi.dev/docs/latest>
