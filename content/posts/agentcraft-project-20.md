---
id: 20
title: "AgentCraft 项目档案 —— 专家/Skill/MCP 可发布的 Agent 平台"
slug: "agentcraft-project"
date: "2026-08-31T11:24:00+08:00"
updated: "2026-10-22T16:20:00+08:00"
summary: "AgentCraft 是我在实习里做的 AI Agent 平台：把专家人设、方法论、Skill 和 MCP 工具打包成可发布的专家，任务跑在独立 Docker 沙箱里。这篇记录它的架构、V1 到 V2 的重建，以及现在做到哪。"
cover: "/uploads/2026/09/1789801485-adee450b094da112.jpg"
category: "projects"
tags: ["agentcraft","ai-agent","pi-agent","fastapi","postgresql","mcp","skills","docker"]
isTop: false
draft: false
---
AgentCraft 是我在实习里做的项目，也是公司课程教材的主线示范项目。它想解决的问题不复杂：很多领域专家有经验，但这些经验散在提示词、笔记和个人习惯里，很难被复用；普通用户又很难自己拼出一套真正能用的垂直智能体。

所以这个平台把专家的人设、方法论、Skill 能力包和 MCP 工具打包成一个可以发布的“专家”。用户召唤专家、创建任务，任务跑在独立的 Docker 沙箱里，模型请求则通过按任务令牌路由的薄代理转发到用户自己的 Provider。简单说，它同时做了三件事：专家和能力的发布、每任务隔离的 Agent 运行时，以及多租户下的权限和配额治理。


## 它长什么样

V1 是本地部署、浏览器里操作的 AI 专家工作台，单机单操作者，对应教材《AI Coding 与 Harness 工程》。V2 是受邀多租户公网 Beta，面向 20 到 50 个受邀用户，永久免费 BYOK，部署在一台独立 Linux VM 上。

界面分成几块：首页是工作台概览和最近任务；专家中心可以召唤专家、直接建任务、管理 Skill；编辑专家时填的是名称、描述、AI 角色、使用场景、任务目标、工作步骤、输入要求这些结构化字段；任务对话是 SSE 流式输出加工具事件面板；另外还有 Skill 和 MCP 服务的增删改查与发布状态。

## 技术栈

后端是 Python 3.11+、FastAPI、SQLAlchemy 2.0 async、Alembic。V1 用 SQLite，V2 换成 PostgreSQL 16，带 RLS、双 DB role 和 UUIDv7。认证在 V2 从 JWT + localStorage 改成了 opaque cookie + CSRF + Argon2id + TOTP。容器侧用 aiodocker 调 Docker API，测试用 pytest、httpx 和 testcontainers。

前端是 React 18 + Vite 5，没有上状态管理库，Context 自己管，SSE 用原生 Fetch 和 ReadableStream。外部运行时锁死 `@earendil-works/pi-coding-agent@0.84.3`，任务沙箱、MCP 沙箱、provider-proxy 和 control 都是 Docker 镜像。

## 请求是怎么跑起来的

V1 的链路大概是这样：

```text
浏览器 ──HTTP/SSE──> agentcraft-control（FastAPI 控制面）
                        ├─ SQLite / 文件存储 / SkillLoader
                        ├─ 每任务 docker run ──> pi-task-<id>
                        │      （只读 rootfs、非 root、internal 网络；
                        │        /workspace rw + /task-files ro + 扩展 ro）
                        │      ├─ 模型请求 ──> provider-proxy（持原始 Key，按任务令牌路由上游）
                        │      └─ MCP 工具回调 ──> 控制面 /internal/mcp/call
                        │                            └─ docker run ──> mcp-sandbox
                        └─ 后台巡检：空闲回收 / 看门狗 / 总超时 / 崩溃恢复
```

这里最清楚的一条边界是：**Agent 进程里的事交给 Pi，进程外的事自己管。** 容器、数据库、SSE、安全策略、配额，全都留在 Python 控制面。AgentCraft 不重写 agent loop，只把 Pi 当成一个 RPC 进程驱动。

### 引擎层

`PiEngine` 封装了单容器的 JSONL 读写、pending id 和 Future 的关联，以及三种行的解析：response 交给 Future，extension_ui_request 自动应答，事件走回调。`PiEngineManager` 管容器池、轮编排、重播种和崩溃恢复，Skill 或 Provider 的指纹一变就重建容器。

协议上有几个容易踩的点：`prompt` 的 response 只是受理 ACK，真正完成要看 `agent_settled` 事件；stdin 要串行写，stdout 必须一直排空，否则 Pi 背压会把 agent 冻住；response id 不在 pending 表里，说明容器状态已经污染，只能重建；`extension_ui_request` 要在 2 秒内应答。这些都是实际跑过之后才敢写下来的。

### Skill 和 MCP

Skill 的状态机是 `draft → published → offline → published`，发布前有一个纯文本校验器。组装系统提示词时，每个 Skill 会用任务级 nonce 包起来，组装前先剥掉同形子串，防止边界逃逸。单个 Skill 的提示词上限是 64KB，超了直接 413，避免 argv 逼近 ARG_MAX。

MCP 走的是 Pi 扩展注册工具、回调 Python 控制面、再 `docker run mcp-sandbox` 的路径。stdio 模式有 Docker 就套一层 `docker run --rm -i`，密钥通过 `-e` 注入，不落日志。之前踩过一个 1.17MB 单行 JSONL 触发 asyncio 64KB 行上限的问题，修复是把传输层 limit 提到 32MiB，和上游同源。V2 则把用户自由注册 MCP Server 的面收掉了，改成平台维护的 `tool_catalog` 白名单，带一个全局 kill switch。

### 数据库和状态

V1 是 SQLite，11 张业务表。V2 是 PostgreSQL 16，30 张表分在身份、目录配额、内容治理、任务四个域里。权限用 RLS 加双 role：`agentcraft_app` 负责业务写和事务本地 GUC，`agentcraft_admin` 负责 pre-auth 查找和系统作业，逐表授权。任务轮有独立的 `task_rounds`，带 lease 和 fencing；`task_events` 是 SSE 和重放的唯一事实源，sequence 单调递增。

状态机不算复杂，但每条语义都得对齐：任务从 `uploading` 到 `queued`、`running`、`ready`，最后进 `completed/failed/aborted/deleted`；`queued` 持 reservation 但不占运行槽；`ready` 表示输入已冻结、没有活跃轮。释放的时候 running reservation、platform_slots、running_tasks 三本账要对称，漏一个就会慢慢把容量吃光。

## V1 到 V2，哪些留、哪些重建

V1 已经完整落地。V2 不是推倒重来，而是渐进改造加分层重建。

引擎核心基本保留：pi_engine、pi_engine_manager、docker_transport、event_handler、skill_loader、extension_generator，还有 Pi 0.84.3 的集成和帧语料。前端骨架和测试基建也留着。执行模型从“SSE 绑定请求”改成“后台 detached 执行 + 事件落库”，provider-proxy 加了 2MB / 90s / 5s 的限幅。

真正重建的是数据层、认证会话、配额、专家和 Skill 的发布模型、MCP 的开放面。V1 的 SQLite 数据没有迁移，直接以 PostgreSQL 的全新 `0001` 基线开始；`agentcraft.db` 本来就是开发联调数据，没有生产价值。

## 现在做到哪

V1 的阶段 0 到 7 全部完成。V2 的阶段 0（基线加固）、阶段 1（PG 数据层）、阶段 2（认证与会话）已经收口，阶段 3（BYOK 目录化）还没启动。阶段 2 结束时是 730 个测试，678 passed、52 skipped。

目前没有真正开放公网。部署设计做完了，但用户 VM 只有 128GiB 磁盘，按 Ops 的降级条款压到了并发 1、暂停公网开放在线。所以如果有人问“上线后出过什么故障”，准确的说法是：没有生产事故，只有本地全链路联调和压测阶段的问题。

## 一些复盘

这个项目对我最大的影响，不是把某个框架用熟了，而是开始习惯先划边界。Pi 负责什么、控制面负责什么、容器负责什么、数据库负责什么，边界清楚之后，很多实现问题会自己消失。反过来，如果一开始就把 agent loop、工具调用、状态管理揉在一个进程里，后面每加一个功能都要重新想一遍一致性。

另一个教训是协议要当协议看。`agent_settled`、pending id、行上限、2 秒应答，这些看起来像实现细节，其实都是契约。契约没对齐，测试再多也只是在测一个错误的假设。

项目还在阶段 3 之前停着，但骨架已经在了。后面要做的 BYOK 目录化、revision 审核、任务域重建、admin 面和前端改造，都是在这套骨架上继续长。
