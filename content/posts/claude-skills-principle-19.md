---
id: 19
title: "Skills 原理"
slug: "claude-skills-principle"
date: "2026-05-30T11:24:01+08:00"
updated: "2026-09-19T15:22:45.624+08:00"
summary: "我为什么存这个：今天读的专业资料，系统讲解 Claude Skills 的实现原理，正好对应我自己这套知识库的「渐进式披露」设计，需要把它的机制和 MCP 的分工吃透。 Claude Skills 是 Anthropic 推出的模块化能力扩…"
cover: "/uploads/2026/09/1789800734-ddc805134f5718b9.jpg"
category: "ai"
tags: ["Agent","claude-skills","mcp","progressive-disclosure","context-engineering","skill-authoring","sop"]
isTop: false
draft: false
---
## 原始内容

> 我为什么存这个：今天读的专业资料，系统讲解 Claude Skills 的实现原理，正好对应我自己这套知识库的「渐进式披露」设计，需要把它的机制和 MCP 的分工吃透。

Claude Skills 是 Anthropic 推出的模块化能力扩展方案，核心是通过「文件系统封装 + 渐进式披露」，为 Agent 注入标准化的领域 SOP（流程化知识），解决传统 Agent「领域知识零散、上下文占用过高、能力复用难」的痛点，已成为工业级 Agent 的核心标配能力。

### 一、核心定义

Claude Skills 是运行在 Claude 沙盒虚拟机（VM）中的**模块化知识包**，每个 Skill 封装「元数据 + 指令 + 资源」三要素，本质是向 Agent 注入「确定性领域知识」的标准化方案 —— 无需修改 Agent 核心逻辑，即可让其快速具备专业能力（如 PDF 处理、表单填写、商品导购）。

Anthropic 官方定义：Agent Skills are modular capabilities that extend Claude's functionality. Each Skill packages instructions, metadata, and optional resources (scripts, templates) that Claude uses automatically when relevant.

#### 1. 三大核心组成要素

| 组成要素 | 核心内容 | 作用 | 示例（PDF 处理 Skill） |
| --- | --- | --- | --- |
| 元数据 | Skill 名称、描述、标签 | 帮助 Agent 快速识别「该 Skill 适配什么场景」 | `name: pdf-processing`；`description: 提取PDF文本/表格、合并文档` |
| 指令 | 具体操作流程、SOP、使用规范 | 告知 Agent「如何执行该技能」 | 用 `pdfplumber` 提取文本的步骤、表单填写指南 |
| 资源 | 可选辅助文件（脚本、模板、参考文档） | 提供工具支持，避免重复编码 | `fill_form.py` 脚本、`FORMS.md` 高级指南 |

#### 2. 物理结构：文件夹化组织

每个 Skill 对应一个独立文件夹，支持嵌套子 Skill，形成层级化知识体系：

```text
pdf-skill/
├── SKILL.md        # 元数据（YAML头）+ 核心指令
├── FORMS.md        # 扩展指令（表单填写高级指南）
├── REFERENCE.md    # API参考文档
└── scripts/        # 资源文件夹
    └── fill_form.py  # 可执行脚本（表单填写工具）
```

### 二、核心机制：渐进式披露（Progressive Disclosure）

关键创新是「按需加载知识」，而非一次性塞入上下文，极大降低 Token 消耗，同时保证 Agent 聚焦当前任务。分三层加载：

1. **第一层：元数据（始终加载）**
   - 时机：Agent 启动时自动加载所有 Skill 的元数据
   - 内容：仅名称、描述、标签，约 100 Token
   - 作用：快速匹配场景（用户提「PDF 提取」，自动关联 `pdf-processing`）

2. **第二层：核心指令（触发时加载）**
   - 时机：判断场景匹配后，通过 Bash 工具读取 `SKILL.md` 主体
   - 内容：具体操作流程、基础 SOP
   - 作用：掌握该 Skill 的核心执行逻辑，不占用冗余上下文

3. **第三层：资源与代码（按需加载）**
   - 时机：执行过程中需要高级功能时
   - 内容：读取扩展文档（`FORMS.md`）或执行脚本（`fill_form.py`）
   - 关键优势：**脚本代码永不进入上下文**，仅返回执行结果，避免 Token 浪费

核心价值：通过分层加载，把一个复杂 Skill 的 Token 占用从「数千」压缩至「百级」，同时保证 Agent 仅获取当前所需知识。

![Claude Skills 渐进式披露时序图](/uploads/imports/assets/claude-skills-principle/claude-skills-progressive-disclosure.png)

### 三、与 MCP 的关系

两者不是竞争关系，而是工业级 Agent 的「左膀右臂」：

| 对比维度 | Claude Skills | MCP（Model Context Protocol） |
| --- | --- | --- |
| 核心定位 | 内部领域知识包（SOP、流程、专业规则） | 外部工具连接标准（API、服务、数据库） |
| 作用范围 | 解决「Agent 懂什么」（知识注入） | 解决「Agent 能调用什么」（工具扩展） |
| 运行环境 | Claude 沙盒 VM（文件系统） | 跨平台通用协议（支持多 AI / 多工具） |
| 典型场景 | PDF 处理、商品导购 SOP、表单填写规则 | 调用 Jira、Stripe、商品数据库 API |

协同逻辑：Skills 提供「做事的方法」，MCP 提供「做事的工具」，二者结合实现「有知识 + 有工具」的完整 Agent 能力。

![Agent + Skills + Computer 架构图](/uploads/imports/assets/claude-skills-principle/claude-skills-overview.png)

### 四、实现方式：官方方案 + 第三方适配

#### 1. 官方方案（Anthropic 开源）

基于文件系统的文件夹结构，通过 `SKILL.md` 封装三要素，支持 Claude 网页端、API、Claude Code 直接使用：

```yaml
---
name: pdf-processing
description: 提取PDF文件中的文本和表格，填写表单，合并文档。当处理PDF文件或用户提及PDF、表单或文档提取时使用。
tags: [pdf, document, text-extraction]
---

# PDF处理技能

## 快速入门
使用 `pdfplumber` 提取PDF文本……

## 高级功能
如需填写表单，参阅 [FORMS.md](FORMS.md)；
如需执行批量处理，运行 scripts/fill_form.py 脚本。
```

#### 2. 第三方适配（支持非 Claude Agent）

开源项目 `openskills` 提供通用实现，无需依赖 Claude 沙盒，支持 Qwen Code、Codex 等 Agent：

- 将 Skills 写入 `AGENTS.md`，通过 Bash 命令 `openskills read [skill-name]` 调用
- 示例调用逻辑（Python）：

```python
def call_skill(skill_name: str) -> str:
    # 通过 Bash 读取 Skill 指令
    result = subprocess.run(
        ["openskills", "read", skill_name],
        capture_output=True,
        text=True
    )
    return result.stdout  # 返回 Skill 核心指令，注入 Agent 上下文
```

### 五、落地实践：主动式智能导购 AI 助手

结合 Multi-Agent 架构与 Claude Skills，构建「主动询问→参数收集→商品匹配→精准推荐」的智能导购助手。

#### 1. Skill 设计（模块化拆分）

```text
shopping-assistant-skills/
├── 01-parameter-collection/  # 参数收集Skill
│   ├── SKILL.md   # 元数据 + 询问SOP（商品类型、预算、参数）
│   └── templates/ # 询问话术模板
├── 02-product-matching/      # 商品匹配Skill
│   ├── SKILL.md   # 元数据 + 匹配规则（预算优先→参数匹配→销量排序）
│   └── scripts/   # 匹配算法脚本 match_products.py
└── 03-recommendation/        # 推荐话术Skill
    └── SKILL.md   # 元数据 + 推荐SOP（突出参数匹配点、售后保障）
```

#### 2. 核心工作流程

1. **场景匹配**：加载所有 Skill 元数据，匹配「商品导购」场景
2. **参数收集**：触发 `parameter-collection`，按模板主动收集需求
3. **商品匹配**：触发 `product-matching`，通过 MCP 调用商品数据库 API，执行 `match_products.py`（脚本不进上下文，只返回结果）
4. **精准推荐**：触发 `recommendation`，生成个性化推荐话术，完成闭环

#### 3. 核心优势（对比传统导购 Agent）

- **知识复用**：Skill 可独立迭代（更新匹配规则只改 `02-product-matching`）
- **上下文优化**：分层加载使单轮对话 Token 占用降低 60%
- **灵活扩展**：新增「售后咨询」只需加 `04-after-sales` Skill，无需重构核心逻辑

### 总结

Claude Skills 的核心价值是「让 Agent 快速具备领域专家能力」—— 通过模块化封装、渐进式披露，解决知识注入的「高效性」与「复用性」问题，搭配 MCP 的外部工具连接能力，构成工业级 Agent 的完整技术栈。

### 原文参考链接

- Anthropic 开源的 Agent Skills：https://github.com/anthropics/skills/blob/main/theme-factory/SKILL.md
- 专家知识包 superpowers：https://github.com/obra/superpowers/tree/main/skills
- 参考文章：https://mp.weixin.qq.com/s/bwFGcomH6BfkBzhFMiiH1g

### 附件图片

- `../assets/claude-skills-principle/claude-skills-overview.png` —— Agent + Skills + Computer：Agent 配置区（Core system prompt / Equipped Skills / Equipped MCP servers）与 Agent 虚拟机（Bash、Python、Nodejs + skills 文件目录树），说明 Skill 目录实际活在 VM 文件系统里，远程 MCP 服务器在网络另一侧。
- `../assets/claude-skills-principle/claude-skills-progressive-disclosure.png` —— 渐进式披露时序图：启动时加载全部元数据 → 用户请求「提取 PDF 文本并总结」→ 匹配 `pdf-processing` → `bash: read pdf-skill/SKILL.md` → 核心指令进入上下文 → 按需读 `FORMS.md` 或执行脚本 → 返回结果。

## 摘要

Claude Skills 是 Anthropic 的模块化能力扩展方案，本质是「元数据 + 指令 + 资源」三要素组成、以文件夹形式组织在 Agent 沙盒 VM 里的领域知识包。它靠**渐进式披露**三层加载（元数据常驻 ≈100 Token → 触发时读 SKILL.md → 按需读扩展文档/执行脚本）把 Token 占用从数千压到百级，其中脚本执行结果不进上下文。与 MCP 的分工是：Skills 给「懂什么」（SOP/知识），MCP 给「能调用什么」（外部工具/API），两者协同才是完整工业级 Agent。

## 可复用点

1. **渐进式披露可直接套用到本知识库**：和 `AGENTS.md` 里「先读 status/topics，再检索候选路径，最后只读命中原文」是同一套思想。本文给了更规范的三层模型和 Token 数量级参考，可反过来校准本系统的检索规则。
2. **Skill 三要素模板**（元数据 / 指令 / 资源）可作为写 skill 的检查清单：description 要写清「什么场景触发」，资源尽量下沉成脚本，别写进正文。
3. **脚本不进上下文、只回结果** —— 这条是本知识库 `scripts/` 设计的理论依据，解释清了为什么检索要走脚本而不是预读文件。
4. **「知识 + 工具」的 MCP/Skills 二分法** 可作为判断依据：一个新需求该做成 skill（方法论）还是接 MCP（外部数据），看它缺的是「怎么做」还是「数据从哪来」。
5. **模块化拆分范例**（导购 assistant 拆成收集/匹配/推荐三个 Skill）提供了「按流程阶段拆 skill」的实操样板，迭代时只改局部。
6. **openskills 第三方适配思路**：把 skill 写进 `AGENTS.md` + `openskills read <name>` 通过 Bash 注入，是让非 Claude Agent（Codex/Qwen Code）复用 skill 体系的一条路径 —— 与本项目现有 AGENTS.md 机制高度同源。
