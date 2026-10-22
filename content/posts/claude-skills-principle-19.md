---
id: 19
title: "Skills 原理"
slug: "claude-skills-principle"
date: "2026-05-30T11:24:01+08:00"
updated: "2026-10-22T16:28:00+08:00"
summary: "把 Claude Skills 的文档和例子翻了一遍，最值得记的是它的渐进式披露：元数据常驻，指令在触发时加载，脚本和参考资料按需读取。再配上 MCP，一个负责“懂什么”，一个负责“能调用什么”。"
cover: "/uploads/2026/09/1789800734-ddc805134f5718b9.jpg"
category: "ai"
tags: ["Agent","claude-skills","mcp","progressive-disclosure","context-engineering"]
isTop: false
draft: false
---
最近把 Claude Skills 的官方文档和几个示例翻了一遍。它想解决的问题很具体：Agent 需要领域知识，但把所有 SOP、模板、脚本都塞进系统提示，上下文很快就满了，而且大部分内容在当前任务里根本用不上。

Claude Skills 的做法是把领域知识打包成一个文件夹，放进 Agent 的沙盒文件系统里，需要的时候再读。

## 一个 Skill 里有什么

每个 Skill 至少有一个 `SKILL.md`，开头是 YAML 元数据，下面是具体指令。旁边可以放脚本、模板、参考文档。拆开看就是三样东西：

- **元数据**：名称、描述、标签。作用是让 Agent 知道“这个 Skill 是干什么的、什么时候该用”。
- **指令**：操作流程、SOP、边界条件。告诉 Agent 具体怎么做。
- **资源**：脚本、模板、API 文档。真正执行时才会用到。

一个 PDF 处理的 Skill 大概长这样：

```text
pdf-skill/
├── SKILL.md        # 元数据 + 核心指令
├── FORMS.md        # 表单填写的高级说明
├── REFERENCE.md    # API 参考
└── scripts/
    └── fill_form.py
```

## 渐进式披露

这是 Skills 最核心的机制。它不把整个文件夹一次性读进上下文，而是分三层加载。

第一层是元数据。Agent 启动时只加载所有 Skill 的名称和描述，大概一百个 Token。用户说“帮我从这份 PDF 里提表格”，Agent 根据描述匹配到 `pdf-processing`。

第二层是核心指令。匹配上之后，Agent 用 Bash 读 `SKILL.md` 的主体，拿到具体流程和基础 SOP。

第三层是资源和代码。执行过程中需要填表单，才去读 `FORMS.md`；需要批量处理，才运行 `fill_form.py`。脚本代码本身不进上下文，只把执行结果带回来。

这样做的收益很直接：一个复杂 Skill 的上下文占用可以从几千 Token 压到百级，而且 Agent 当前看到的只有当前任务需要的那部分。

![Claude Skills 渐进式披露时序图](/uploads/imports/assets/claude-skills-principle/claude-skills-progressive-disclosure.png)

## Skills 和 MCP 不是一回事

这两个东西经常被放在一起说，但分工很清楚。

Skills 管的是“Agent 懂什么”。它把领域里的流程、规则、模板、脚本组织起来，让 Agent 按一套确定的方法做事。MCP 管的是“Agent 能调用什么”。它把外部 API、数据库、服务接进来，让 Agent 能真正查数据、发请求、操作系统。

一个偏知识，一个偏工具。Skills 告诉 Agent 怎么做，MCP 给它做事的工具。两个都有，才算一个能落地的 Agent。

![Agent + Skills + Computer 架构图](/uploads/imports/assets/claude-skills-principle/claude-skills-overview.png)

## 官方实现和第三方适配

Anthropic 的方案就是文件系统：把 Skill 文件夹放进沙盒 VM，`SKILL.md` 里写元数据和指令，Claude 网页端、API、Claude Code 都能直接用。

非 Claude 的 Agent 也有办法。开源项目 `openskills` 把 Skill 指令写进 `AGENTS.md` 之类的项目文件，通过 `openskills read <skill-name>` 用 Bash 读出来，再注入上下文。思路和 Claude 一样，只是换了一个加载入口。

## 一个导购助手的例子

假设要做一个主动询问、收集参数、匹配商品、给出推荐的导购 Agent。比较自然的拆法是按流程阶段拆成三个 Skill：

- `01-parameter-collection`：问清商品类型、预算、关键参数，附一套询问话术。
- `02-product-matching`：按预算、参数、销量排序，脚本负责匹配，结果回传。
- `03-recommendation`：根据匹配结果组织推荐话术，突出参数和售后。

这样做的好处是改一处不影响其他部分。想调整匹配规则，只动 `02`；想加售后咨询，再加一个 `04`，不用重构整个 Agent。

## 我记下来的几点

- **描述比名字重要。** `description` 决定模型什么时候会加载这个 Skill。写“处理 PDF 文件，提取文本和表格、填表单、合并多个 PDF”，比写“帮助处理 PDF”有用得多。
- **能写成脚本的，就别写进正文。** 脚本执行结果才进上下文，代码本身不进，既省 Token，也少一类注入风险。
- **按流程阶段拆 Skill。** 一个 Skill 管一段流程，比做一个大而全的“万能助手”更容易维护。
- **先判断缺的是知识还是工具。** 缺 SOP 就做 Skill，缺外部数据就接 MCP，不要用一个东西硬套另一个场景。

参考：

- <https://github.com/anthropics/skills>
- <https://github.com/obra/superpowers/tree/main/skills>
- <https://mp.weixin.qq.com/s/bwFGcomH6BfkBzhFMiiH1g>
