---
title: "运维面试复习笔记：Linux、网络、Docker 与 Kubernetes"
slug: "operations-interview-linux-network-containers"
date: "2026-10-28T11:30:00+08:00"
summary: "从一份运维面试题出发，按 Linux、网络、Docker、Kubernetes 和上线变更梳理复习思路，重点区分工具输出、故障判断与验证方法，并核对容易背错的技术细节。"
cover: "/uploads/2026/10/20261028-operations-interview-cover.jpg"
category: "tech"
tags: ["Linux", "Docker", "Kubernetes", "Nginx", "运维", "面试"]
isTop: false
draft: false
---

这篇笔记的复习线索来自网络技术联盟站发布在腾讯云开发者社区的[运维工程师面试题汇总](https://cloud.tencent.com/developer/article/2230879)。原文涵盖 Linux、网络、容器、集群和日常运维，完整题目可以回到原文查看。

下面选取其中的主要方向，结合官方文档重新组织成复习笔记。比起记住一串命令，更值得练习的是：命令能看到什么、看到异常后怎么缩小范围、处理完成后拿什么证明恢复。

## Linux：把命令和要回答的问题对应起来

### 端口、连接和进程分别怎么看

排查服务访问失败时，可以先区分三个问题：进程是否存在、端口是否监听、连接处于什么状态。

```bash
# 查看 TCP 监听端口及对应进程；部分进程信息需要更高权限
ss -lntp

# 查看本机 8080 端口上的 TCP 连接
ss -nt state established '( sport = :8080 )'

# 查看 socket 统计摘要
ss -s
```

`LISTEN` 说明存在监听 socket，`ESTABLISHED` 说明 TCP 连接已经建立，但都不能单独证明业务请求成功。一个连接还可能被复用来承载多次请求，因此连接数也不能直接当成 HTTP 并发请求数。`ss` 的选项与过滤语法可查 [Linux 手册](https://man7.org/linux/man-pages/man8/ss.8.html)。

面试回答可以继续往前走一步：如果端口监听正常，就检查监听地址、访问路径、应用日志和实际 HTTP 响应，而不是直接宣布“服务没问题”。

### 僵尸进程的关键在回收

僵尸进程已经结束执行，但父进程还没有通过 `wait()`、`waitpid()` 等接口收取退出状态。此时保留的是供父进程读取的退出信息，不能靠反复向僵尸进程发送信号来完成回收。[wait(2) 手册](https://man7.org/linux/man-pages/man2/wait.2.html)说明了这套机制。

```bash
ps -eo pid,ppid,stat,comm
```

看到状态中的 `Z` 后，下一步应追查父进程为什么没有回收子进程。处理时需要评估父进程承担的业务，再决定修复、重启或其他恢复方式。

### LVM 扩容先认清存储层次

LVM 的三个基本概念是：PV 为物理卷，VG 将物理卷组成空间池，LV 则是从卷组分配出的逻辑块设备。[LVM 手册](https://man7.org/linux/man-pages/man8/lvm.8.html)对这几个对象有明确说明。

排查空间不足时，先看清“磁盘或分区 → PV → VG → LV → 文件系统 → 挂载点”的关系：

```bash
lsblk -f
findmnt /
pvs
vgs
lvs
df -hT
```

卷组已有空闲空间和需要新增磁盘，是两条不同的扩容路径。扩展 LV 后，还要让文件系统使用新增空间；`lvextend` 提供 `--resizefs` 选项，但具体支持条件仍要结合文件系统和本机工具确认，参见 [lvextend 手册](https://man7.org/linux/man-pages/man8/lvextend.8.html)。

答题时把这些层次说清楚，比背一组固定设备名更可靠。

## 网络：沿着请求经过的链路定位

### DNS 查询要分清参与者

以一次没有命中缓存的常规递归解析为例，客户端向递归解析器询问；解析器根据委派信息逐步找到负责目标域名的权威服务器，再把结果返回客户端。这里要区分客户端、递归解析器和权威服务器，也要考虑缓存，而不是把查询理解成浏览器固定逐级访问所有 DNS 服务器。相关概念见 [RFC 1034](https://www.rfc-editor.org/rfc/rfc1034.html)。

对于“网站打不开”这样的题，可以按以下顺序提出假设并验证：

1. 本机地址、网关、路由和链路是否正常。
2. 域名是否解析到预期地址。
3. 目标端口是否可以建立连接。
4. HTTPS 握手及证书是否正常。
5. 代理、应用和下游依赖在哪一段报错。

`ping` 测的是 ICMP 可达性。它既不能替代端口检查，也不能证明网页、登录接口或数据库查询正常。

### 网站变慢时，先拆时间

可以先对一个具体 URL 采样，再结合浏览器网络面板、代理日志和应用监控继续定位：

```bash
curl -o /dev/null -sS \
  -w 'dns=%{time_namelookup} connect=%{time_connect} tls=%{time_appconnect} first_byte=%{time_starttransfer} total=%{time_total}\n' \
  https://example.com/
```

这些时间通常是从传输开始计算的累计值，不能直接当作每一阶段的独立耗时。例如在一次新建 HTTPS 连接、无重定向的测量中，可以比较相邻指标来辅助判断。复用连接、代理和重定向都会影响解释方式，字段定义以 [curl 官方手册](https://curl.se/docs/manpage.html)为准。

拿到时间分布后，再决定检查 DNS、建连、应用处理还是资源下载。这样才能解释为什么查 CPU、慢查询或图片体积。

## Docker：区分镜像、运行实例和持久数据

### 一条命令背后是谁在工作

Docker Engine 使用客户端与服务端架构：CLI 通过 API 与守护进程交互，由守护进程管理镜像、容器、网络和卷等对象。镜像是创建容器的基础，容器是运行实例，镜像仓库用于存取和分发镜像，参见 [Docker Engine 文档](https://docs.docker.com/engine/)。

复习时可以顺着一次交付过程提问：镜像怎么构建、怎么分发、容器怎么启动、配置怎么注入、业务数据存在哪里、失败后怎样定位。

### 写时复制发生在修改时

以常见的分层存储机制理解，容器可以共享只读镜像层，同时拥有独立的可写层。读取下层文件无需为了读取而复制；需要修改时，存储实现才执行相应的写时复制操作。容器可写层中的变更也不会反向修改原始镜像。[Docker 存储文档](https://docs.docker.com/engine/storage/drivers/)解释了这些机制，并说明不同存储实现的差异。

需要长期保存的数据应单独规划卷或其他持久存储。把数据留在容器可写层里，会让容器替换和删除变成数据生命周期问题。

### 构建失败先看失败步骤

排查 Dockerfile 时，建议依次确认构建上下文、复制路径、依赖下载、执行权限和具体失败命令。利用缓存和多阶段构建时，也要能说明哪些文件变化会导致相关步骤重新执行。构建方式与实践可查 [Docker 构建指南](https://docs.docker.com/build/building/best-practices/)。

不要把旧版构建器产生临时容器的过程，当成所有构建环境都必须具备的排障入口。

## Kubernetes：先讲职责，再讲协作

### 控制平面和节点各自负责什么

| 组件 | 复习时抓住的职责 |
| --- | --- |
| `kube-apiserver` | 提供 Kubernetes API |
| `etcd` | 保存 API Server 的集群数据 |
| `kube-scheduler` | 为尚未绑定节点的 Pod 选择节点 |
| `kube-controller-manager` | 运行控制器，使实际状态趋近期望状态 |
| `kubelet` | 在节点上确保 Pod 及其容器按要求运行 |
| 容器运行时 | 实际运行容器 |
| `kube-proxy` | 实现 Service 所需的节点网络规则；部分网络方案可替代它 |

这张表对应 [Kubernetes 组件文档](https://kubernetes.io/docs/concepts/overview/components/)。可以用“提交一个工作负载后，各组件分别做什么”来检查自己是否真正理解，而不只会报组件名。

### 移除 dockershim 的含义

Kubernetes 自 1.24 起移除了项目内置的 dockershim。节点需要使用符合 CRI 的运行时，例如 containerd、CRI-O；如果使用 Docker Engine，则需要额外的 CRI 适配组件。不能据此推导出“用 Docker 构建的镜像不能运行”。具体支持关系见 [Kubernetes 容器运行时文档](https://kubernetes.io/docs/setup/production-environment/container-runtimes/)。

### Namespace 只是隔离方案的一部分

Namespace 为一组资源提供命名和管理范围，但并非所有资源都属于某个 Namespace，例如 Node 是集群级资源，参见 [Namespace 文档](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/)。

讨论多租户时还需要继续回答：谁能操作哪些资源、每个租户能占用多少资源、哪些网络流量允许通过。RBAC、配额和 NetworkPolicy 等机制需要共同设计，不能仅创建两个 Namespace 就宣称实现了完整安全隔离，参见[多租户指南](https://kubernetes.io/docs/concepts/security/multi-tenancy/)。

## Nginx：把调度策略和业务需求连起来

常见 HTTP 负载均衡策略包括轮询、结合权重分配、`least_conn` 和 `ip_hash`。它们分别关注请求分配、后端权重、活跃连接数以及客户端 IP 的映射关系，参见 [Nginx 负载均衡文档](https://nginx.org/en/docs/http/load_balancing.html)。

`ip_hash` 可以帮助同一客户端持续访问某个后端，但选择了同一后端，并不等于完成了跨节点会话数据同步。答题时仍要说明后端故障或实例变化后的会话处理方式。

另外，Nginx 不只有 HTTP 代理能力，`stream` 模块也支持 TCP、UDP 场景；是否可用取决于安装包及模块配置，参见 [stream 模块文档](https://nginx.org/en/docs/stream/ngx_stream_core_module.html)。比较负载均衡方案时，应说明协议、路由需求、健康检查和运维条件，避免脱离场景给产品排固定名次。

## 上线与恢复：答案需要落到验证

对于配置修改、发布和备份类问题，可以用同一组问题自查：

- 这次操作会影响哪些服务和用户？
- 变更前保留了什么基线，在哪里验证过？
- 出现什么现象就停止或回退？
- 如何确认业务恢复，而不仅是进程重新启动？
- 恢复所依赖的数据和配置，是否真的做过恢复演练？

例如修改代理配置，除了检查语法和加载结果，还应该实际请求关键路径，观察错误率与响应时间。讨论备份时，也应区分副本、同步和可恢复的历史备份：错误删除可能被同步到副本，真正要验证的是能否恢复到所需时间点。

复习时可以为每个知识点写四句话：解决什么问题、依靠什么机制、出现故障先查哪里、最后如何验证。这样从基础概念切换到场景题时，回答也能接得上。
