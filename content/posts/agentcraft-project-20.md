---
id: 20
title: "AgentCraft 项目档案 —— 专家/Skill/MCP 可发布的 Agent 平台"
slug: "agentcraft-project"
date: "2026-08-31T11:24:00+08:00"
updated: "2026-09-19T15:04:46.433+08:00"
summary: "我为什么存这个：这是我自己在做的项目，当前正处于 V2 公测 Beta 的阶段 2 → 阶段 3 之间。存进知识库是为了：①把散在 docs/ 和代码里的架构决策收拢成一份可检索的档案；②它和刚入库的 Pi Coding Agent 原理、…"
cover: "/uploads/2026/09/1789801485-adee450b094da112.jpg"
category: "dev"
tags: ["Fastapi","agentcraft","pi-agent","rpc","agent-platform","multi-tenant","docker-sandbox","mcp","react","postgresql","skills","sdd","internship-project","教材项目"]
isTop: false
draft: false
---
## 原始内容

> 我为什么存这个：这是我自己在做的项目，当前正处于 V2 公测 Beta 的阶段 2 → 阶段 3 之间。存进知识库是为了：①把散在 docs/ 和代码里的架构决策收拢成一份可检索的档案；②它和刚入库的 Pi Coding Agent 原理、Claude Skills 原理构成同一条技术主线（Agent harness / 渐进式披露 / RPC 集成），放在一起能形成知识网络；③后续写文章、做复盘、Spark 关联都用得上。

### 一、项目定位

**AgentCraft 是一个「把领域经验封装为可复用专家」的 AI Agent 应用/平台。**

用户（专家）将**人设 + 方法论 + Skill 能力包 + MCP 工具**组合成「专家」并发布；普通用户召唤专家创建任务，任务在**每任务独立 Docker 沙箱**中运行 **Pi 编码代理**，模型请求经按任务令牌路由的**薄 Provider 代理**转发到用户自带 Provider（BYOK）。

一句话：**AgentCraft = 专家/Skill/MCP 的可发布平台 + 每任务隔离的 Pi Agent 运行时 + 多租户治理。**

**两代定位**：

- **V1**：本地部署、浏览器交互的「AI 专家工作台」，实习单位的**课程主线项目**（对应教材《AI Coding 与 Harness 工程》），单机单操作者。
- **V2（Public Beta）**：受邀多租户公网 Beta —— 20~50 名受邀用户、永久免费 BYOK、部署于「个人公网 IP + 独立 Linux VM」。

**界面形态**（截图已存档到 `input/assets/agentcraft-screenshots/`）：

- **首页**：工作台概览（进行中任务数 / 专家数 / 已发布 Skill 数）+ 最近任务 + 精选专家（按技术/设计/写作/数据分析/办公效率分类）
- **专家中心**：召唤专家 / 直接建任务 / 管理 Skill
- **编辑专家**：名称、描述、AI 角色、使用场景、任务目标、工作步骤、输入要求等结构化字段
- **任务对话**：SSE 流式对话 + 工具事件面板
- **Skill 管理 / MCP 服务管理**：能力包的 CRUD 与发布状态机

![AgentCraft 首页](/uploads/imports/assets/agentcraft-screenshots/01-home.png)
![任务对话进行中](/uploads/imports/assets/agentcraft-screenshots/02-task-chat.png)
![编辑专家](/uploads/imports/assets/agentcraft-screenshots/03-expert-edit.png)
![Skill 管理](/uploads/imports/assets/agentcraft-screenshots/04-skill-manage.png)
![MCP 服务管理](/uploads/imports/assets/agentcraft-screenshots/05-mcp-manage.png)

### 二、技术栈

**后端**（`agentcraft/pyproject.toml`）：

| 类别 | 选型 |
|---|---|
| 语言 | Python `>=3.11`（README 要求 3.12+） |
| Web 框架 | **FastAPI** `>=0.115` + uvicorn[standard] |
| ORM | **SQLAlchemy 2.0**（async，`Mapped`/`mapped_column`） |
| 迁移 | **Alembic**（V1 链 `backend/alembic/`；V2 链 `backend/alembic_v2/`） |
| 数据库 | **V1: SQLite**（aiosqlite）→ **V2: PostgreSQL 16**（asyncpg，RLS，UUIDv7） |
| 校验 | Pydantic v2 + pydantic-settings |
| 认证 | python-jose（JWT）、`bcrypt==4.0.1`、**argon2-cffi**（V2 Argon2id）、pyotp（TOTP） |
| 加密 | `cryptography>=50`（AES-256-GCM 信封加密） |
| 容器 | `aiodocker`（Docker API attach）+ docker CLI + 子进程三传输回退 |
| 测试 | pytest + pytest-asyncio + httpx + **testcontainers**（PG） |
| Lint | **ruff**（line-length=100，`E,F,I,B,C90`，mccabe max-complexity=10） |

**前端**（`agentcraft/frontend/package.json`）：React 18.3 + Vite 5.4 + react-router-dom 6.26 + @phosphor-icons/react。**无状态管理库**（Context 自管），SSE 用原生 Fetch + ReadableStream。

**外部运行时**：**Pi coding-agent 锁死 `@earendil-works/pi-coding-agent@0.84.3`**、Docker（任务沙箱 + MCP 沙箱 + provider-proxy + control 镜像）、uv / npm 工具链。

### 三、目录结构

根目录是「双仓合一」：`docs/` 是文档仓，`agentcraft/` 是独立 git 代码仓，`source/pi/` 是 Pi 0.84.3 只读源码参考。

```text
AgentCraft/
├── docs/                 # 文档仓
│   ├── AgentCraft_V2_Progress.md          ★ V2 进展与问题记录 v1.2
│   ├── AgentCraft-V1/                     # PRD / Engineering Spec / DB Design / Scaffold Plan v0.4.x
│   ├── AgentCraft-V2-Public-Beta/         # PRD/Engineering/DB/Deployment_Ops v2.0.0 + API Supplement v2.0.1
│   └── superpowers/                       # SDD 计划与设计（plans/ specs/）
├── agentcraft/           # 代码仓
│   ├── backend/
│   │   ├── main.py               # FastAPI 入口 + lifespan 巡检接线
│   │   ├── config.py             # Settings + 密钥 fail-fast 校验
│   │   ├── errors.py             # ErrorCode 注册表（27 V2 码 + legacy）
│   │   ├── logging_config.py     # dictConfig + SensitiveDataFilter 四模式脱敏
│   │   ├── provider_proxy.py     ★ 按任务令牌路由的 provider 薄代理
│   │   ├── api/                  # V1 路由 + api/v2/（auth/account/schemas）
│   │   ├── engine/               ★ Pi 运行时（见下）
│   │   ├── services/             # task/mcp/provider/lifecycle/harness/skill 服务
│   │   ├── models/               # V1 SQLAlchemy 模型（11 张表）
│   │   ├── middleware/           # auth / permission / upload_guard
│   │   ├── utils/crypto.py       # AES-256-GCM 信封加密
│   │   ├── v2/                   ★ V2 应用层（数据层+认证+会话+配额）
│   │   ├── alembic/              # V1 SQLite 迁移链
│   │   └── alembic_v2/           # V2 PostgreSQL 迁移链（0001/0002/0003）
│   ├── frontend/src/             # React（pages P01-P10 / components / api / lib）
│   ├── harness/                  # MCP 工具实现（mcp/validate_skill.py 等）
│   ├── docker/                   # Dockerfile.control / pi-worker / provider-proxy / mcp-sandbox + compose
│   ├── tests/                    # 58 个 test_*.py
│   ├── tools/                    # seed_demo.py / probe_* / acceptance_pi_e2e.py
│   └── docs/                     # 开发计划/进度/开发记录/阶段手册
├── source/pi/            # Pi coding-agent v0.84.3 源码参考（只读，不参与构建）
└── pic/                  # 5 张产品界面截图
```

### 四、核心架构

#### 4.1 总体架构（V1，`agentcraft/README.md`）

```text
浏览器 ──HTTP/SSE──> agentcraft-control（FastAPI 控制面）
                        ├─ SQLite / 文件存储 / ExtensionGenerator / SkillLoader
                        ├─ 每任务 docker run ──> pi-task-<id>
                        │      （只读 rootfs、非 root、internal 网络；
                        │        /workspace rw + /task-files ro + 扩展 ro）
                        │      ├─ 模型请求 ──> provider-proxy（持原始 Key，按任务令牌路由上游）
                        │      └─ MCP 工具回调 ──> 控制面 /internal/mcp/call
                        │                            └─ docker run ──> mcp-sandbox
                        └─ 后台巡检：空闲回收 / 看门狗 / 总超时 / 崩溃恢复
```

**核心分工原则**（`agentcraft/docs/phase5_piagent.md`）：

> **凡是「agent 进程里」的事让 Pi 干；凡是「进程外」的事 —— 容器、DB、SSE、安全策略 —— 自己干。**

#### 4.2 Agent 运行时（engine 层）

**关键点：AgentCraft 不自己写推理循环，推理循环在 Pi 内部（TypeScript）。AgentCraft 只做 RPC 协议适配。**

| 文件 | 类/函数 | 职责 |
|---|---|---|
| `backend/engine/pi_engine.py` | `PiEngine` | 单容器 RPC 封装：JSONL 读写、pending id/Future 关联、**三分叉行解析**（response → Future / extension_ui_request → 自动应答 / 事件 → 回调）；`send_command`/`send_prompt`/`abort`；`_read_loop` 持续排空 stdout 防背压 |
| `backend/engine/pi_engine_manager.py` | `PiEngineManager` | 容器池 `{task_id: PiEngine}`、`ensure_container`（Skill/Provider **双指纹**变化即重建）、`run_round`（轮编排）、**重播种**（`_reseed_message`，最近 40 条历史嵌入首条消息）、崩溃恢复（≤3 次）、`sweep_idle`/`sweep_watchdog` 后台巡检 |
| `backend/engine/docker_transport.py` | `ContainerSpec` / `DockerApiTransport` / `DockerCliTransport` | 沙箱清单唯一事实源（非 root、只读 rootfs、`cap_drop=ALL`、no-new-privileges、资源限额、仅 internal 网络）+ 两传输通道。`MAX_LINE_BYTES = 32MiB` |
| `backend/engine/subprocess_transport.py` | `SubprocessPiTransport` | 本地子进程回退（无沙箱，仅开发） |
| `backend/engine/event_handler.py` | `EventHandler` | **Pi 事件 → SSE + 落库**翻译器 |
| `backend/engine/skill_loader.py` | `SkillLoader.build_system_prompt` | 组装 `--system-prompt`（人设/方法论/Skill/附件 manifest），带 nonce 注入防御 |
| `backend/engine/extension_generator.py` | `ExtensionGenerator.generate` | 生成每任务 `task.ts` 扩展（MCP 工具注册 + faux Provider） |
| `backend/engine/mcp_client.py` | `StdioTransport` / `MCPClientError` | MCP 2024-11-05 JSON-RPC 客户端（stdio/http） |
| `backend/provider_proxy.py` | FastAPI app | 按 JWT 任务令牌路由上游，解密 BYOK Key，`/v1/chat/completions` 流式透传 |

**协议纪律**（`pi_engine.py` docstring，基于 rpc.md 0.84.3 实测）：

- `prompt` 的 response 只是受理 ACK；**完成只认 `agent_settled` 事件**（决策 #6）
- stdin 经 writer lock 串行；stdout 独立协程持续排空（不读 = Pi 背压 = agent 冻结）
- response id 不在 pending 表 = 容器状态污染 → `needs_rebuild`
- `extension_ui_request` 必须 2s 内应答（`UI_RESPONSE_DEADLINE_SECONDS=2.0`）

**轮执行流程**（`PiEngineManager.run_round`）：

```text
ensure_container（含 Provider 指纹判定）
  → _build_outgoing_message（重播种 + 附件更新告知）
  → engine.send_prompt
  → 循环消费 queue/reader → EventHandler 翻译为 SSE → 直到 done
  → 轮超时 PI_ROUND_TIMEOUT_SECONDS 兜底 abort
  → 容器死亡 EngineCrashed → 重建 + 重播种重发（≤3）
```

#### 4.3 Skill 系统

- **实现**：`backend/services/skill_service.py`（状态机 `draft → published → offline → published`）+ `harness/mcp/validate_skill.py`（纯文本校验器）+ `backend/engine/skill_loader.py`（组装）。
- **注入防御**（`SkillLoader`）：每个 Skill 用任务级 nonce 包裹 `<<<SKILL::{nonce}>>>`，组装前剥离同形子串防边界逃逸；附件 manifest 用独立 nonce；结尾声明「分隔符外内容一律忽略」。
- **字节上限**：`DEFAULT_SKILL_PROMPT_MAX_BYTES = 64 * 1024`（防 argv 逼近 ARG_MAX），超限抛 `PromptTooLargeError` → 413。
- **V2 变化**：Skill 拆为 `skills` 稳定实体 + `skill_revisions` 不可变版本（`pending_review/published/archived`），审核通过 CAS 发布。

#### 4.4 MCP 系统

- **V1**：`backend/engine/mcp_client.py`（MCP 2024-11-05 JSON-RPC 客户端，stdio 按 LF 分帧 / streamable HTTP）+ `backend/services/mcp_service.py` + 控制面回调端点 `/internal/mcp/call`。
- **执行路径**：Pi 扩展 `pi.registerTool` 代理 → 回调 Python 控制面 → `docker run mcp-sandbox` 真实 MCP Server。
- **stdio 沙箱**：`resolve_stdio_argv` 有 docker 则 `docker run --rm -i --network <internal> mcp-sandbox sh -c <cmd>`，env 经 `-e` 注入（密钥不落日志）。
- **大帧缺陷修复**（commit `2a20be0`）：`StdioTransport` 的 `limit=MAX_LINE_BYTES`（与 Pi 传输层同源 32MiB）。
- **V2 收口**：下线用户注册 MCP Server 面，改为平台维护的 `tool_catalog` 白名单（`check_code_style@1`、`read_task_file@1`、`write_output_file@1`、`list_task_files@1`、`query_task_state@1`），带全局 **kill switch**。

#### 4.5 数据库与持久化

- **V1**：SQLite，11 张业务表（users/experts/skills/expert_skills/tasks/conversations/messages/task_files/mcp_servers/mcp_tools/expert_mcps）+ 11 个索引。
- **V2**：PostgreSQL 16，**30 张表**分四域（`backend/v2/models/`）：
  - **身份 6**（`identity.py`）：users / user_entitlements / invitations / account_action_tokens / email_outbox / sessions
  - **目录配额 8**（`catalog.py`）：provider_catalog / user_providers / user_quotas / user_quota_usage / platform_slots / platform_storage / usage_daily / tool_catalog
  - **内容治理 9**（`content.py`）：experts / expert_revisions / skills / skill_revisions / revision_tools / content_reviews / reports / audit_logs …
  - **任务域 7**（`tasking.py`）：tasks / task_files / task_reservations / task_messages / task_rounds / task_events / idempotency_records
- **RLS 与双 DB role**：`agentcraft_app`（业务写 + 事务本地 GUC）/ `agentcraft_admin`（pre-auth 查找、系统作业），逐表授权矩阵；`app.set_current_owner()` 为 `SECURITY DEFINER` 事务本地上下文（`backend/v2/db.py` 的 `OWNER_FN_STATEMENTS`）。
- **持久轮 `task_rounds`**：`pending/running/cancelling/settled/failed/cancelled`，lease/fencing（`lease_owner`/`lease_epoch`/`lease_expires_at`）。
- **统一事件源 `task_events`**：SSE 与重放唯一事实源，单调 `sequence`。
- **幂等**：`idempotency_records`（subject_hash + route + key + request_hash）。

#### 4.6 状态机（V2）

```text
任务：uploading → queued → running → ready → completed | failed | aborted | deleted
用户：pending → active → suspended → deleting → deleted
专家：draft → pending_review → published | rejected | archived
轮：  pending → running → cancelling → settled/failed/cancelled
```

关键语义：`uploading` 无 runner；`queued` 持存活 reservation 但不占运行槽；`ready` 输入已冻结、无活跃轮；**三本账对称释放**（running reservation + platform_slots + running_tasks）。

### 五、V1 → V2 的演进

V1 已完整落地（阶段 0-7 全部完成）。V2 是**渐进改造 · 分层重建**，资产处置矩阵：

| 处置 | 资产 |
|---|---|
| **保留** | engine 核心（pi_engine / pi_engine_manager / docker_transport / event_handler / skill_loader / extension_generator）、pi 0.84.3 集成与帧语料、`validate_skill`、统一错误信封、前端骨架、测试基建（FakePiTransport） |
| **改造** | engine 执行模型（SSE 绑定 → **detached 后台执行 + 事件落库**）、provider-proxy（加 2MB/90s/5s 限幅）、任务状态机与上传窗口、前端页面 |
| **重建** | 数据层（SQLite **11** 表 → PostgreSQL）、认证与会话（JWT+localStorage → **opaque cookie + CSRF + Argon2id + TOTP**）、配额（常量 → 事务化 reservation）、专家/Skill（单表直发布 → **不可变 revision + 审核**）、MCP（自由注册 → tool_catalog 白名单） |
| **新建** | invitations / sessions / user_quotas / platform_slots / content_reviews / reports / audit_logs / rate_limit_events / admin API / 产物管道 / 邮件 outbox / detached 轮执行器 |
| **废弃** | 用户自选 workdir、用户注册 MCP Server 面、自助申请 expert、`GET /api/experts/{id}/skills` |

**数据迁移策略**：不迁移 V1 数据（`agentcraft.db` 为开发联调数据，无生产价值）；PostgreSQL 从全新 `0001` 基线开始。

### 六、当前进度（2026-09-10 快照）

| 阶段 | 状态 | 证据 |
|---|---|---|
| V1（阶段 0-7 全链路） | ✅ 完成 | `agentcraft/docs/DEVELOPMENT_PLAN.md` |
| V2 阶段 0（基线加固） | ✅ 完成 | 10 commits `2a20be0..56048fc`；**433 passed + 52 skipped** |
| V2 阶段 1（PG 数据层） | ✅ 完成 | 15 commits `56048fc..6a8c074`；30 表 + 双 role 授权矩阵 + 11 表 RLS；**495 passed + 52 skipped**；CI 双 job 绿 |
| V2 阶段 2（认证与会话） | ✅ 完成 | 19 commits `6a8c074..4645eb9` + T15；14 端点域；**730 = 678 passed + 52 skipped** |
| V2 阶段 3（BYOK 目录化） | ⬜ 未启动 | 可复用 v2 认证/会话域的幂等、限流引擎 |
| V2 阶段 4-9 | ⬜ 未启动 | revision 审核 / 工具收口 / 任务域重建 / admin 面 / 前端改造 / 发布门槛 |

**当前节点**：**阶段 2 完成、阶段 3 待启动** 的收口状态。

**已知遗留项**：`tasks.py:246` SSE 转发引擎异常文本口径；`pi_engine.py:231` chars-vs-bytes；`provider_proxy` 进程未接 `configure_logging`；GitHub Actions 尚未 SHA-pinning（仓公开前处理）。

**硬约束**：用户 VM 128GiB 磁盘不足 → 部署阶段按 Ops §2 降级条款（并发 1、暂停公网开放在线）。

### 七、研发方法论：SDD 子代理驱动

项目采用 **SDD（Spec-Driven Development）子代理驱动**流程：

- 每任务派 fresh 实现代理 + 双裁决审查 + 修复环 + 全分支终审
- 流程产物在 `.superpowers/sdd/` 与 `.superpowers/survey/`
- 阶段计划与完成记录在 `docs/superpowers/plans/`

**这套流程实际产出了高价值发现**（阶段 1 终审）：

- GUC 可伪造 **Critical** 漏洞
- experts / skills 无 RLS 的劫持风险

### 八、与 Pi Coding Agent 的关联（18 条集成决策）

见 `docs/AgentCraft-V1/AgentCraft_Engineering_Spec_v0.4.0.md` §12。核心映射：

| Pi 能力 | AgentCraft 用法 |
|---|---|
| RPC 模式 `runRpcMode` | `PiEngine` 是其 Python 对端 |
| 单进程单会话 | 每任务一容器（决策 #2） |
| `--system-prompt` 覆盖 | `SkillLoader.build_system_prompt`（决策 #3） |
| 扩展 `pi.registerTool` | 生成 `task.ts` + Python `/internal/mcp/call` 回调（决策 #4） |
| 无会话持久 + 内存连续 | 重播种最近 40 条历史（决策 #5） |
| `agent_settled` 事件 | 唯一认可的轮完成信号（决策 #6） |
| 版本 | 锁死 `0.84.3`，升级需重新核对协议表（决策 #8） |
| 无内置 faux Provider | 经 `pi.registerProvider` 自注册（决策 #9/#16） |
| 沙箱可写点 | 只读 rootfs 下增 `~/.pi` tmpfs（决策 #17） |

**Pi 源码参考对应**：`source/pi/packages/agent/src/agent-loop.ts`（`agentLoop`）、`source/pi/packages/coding-agent/src/modes/rpc/rpc-mode.ts`（`runRpcMode`）、`rpc-types.ts`（`RpcCommand`）、`packages/agent/docs/harness.md`（conversation tree / crash recovery，是 AgentCraft 重播种设计的源头参考）。

## 摘要

AgentCraft 是 chibarie 自研的 AI Agent 平台，把「人设 + 方法论 + Skill + MCP」封装成可发布的**专家**，用户召唤专家建任务后，任务在**每任务独立的 Docker 沙箱**里跑 **Pi coding-agent（锁死 0.84.3）**，模型请求经按任务令牌路由的 **provider-proxy** 转发到用户自己的 Provider（BYOK）。架构上最清晰的一条主线是**控制面与引擎分离**：不重写 agent loop，把 Pi 当黑盒 RPC 进程驱动，Python 侧只管容器、DB、SSE、安全、配额。技术栈为 FastAPI + SQLAlchemy 2.0 async + React 18/Vite，V1 用 SQLite，V2 迁到 PostgreSQL 16（RLS + 双 DB role + 30 表）。当前 V1 已完整交付，V2 公测 Beta 完成阶段 0/1/2（数据层 + 认证会话，730 测试通过），阶段 3（BYOK 目录化）待启动。
