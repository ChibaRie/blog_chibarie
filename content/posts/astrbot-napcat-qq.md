---
id: 26
title: "把 DeepSeek 接进 QQ：AstrBot + NapCat 折腾记录"
slug: "astrbot-napcat-qq"
date: "2026-10-26T20:45:00+08:00"
summary: "用 AstrBot 加 NapCat 把 DeepSeek 拉进 QQ 的完整流程：装什么、三个端口分别干什么、人格和分段回复怎么配、长期记忆和主动消息插件怎么跑通。"
cover: "/uploads/2026/10/20261026-astrbot-cover.jpg"
category: "tech"
tags: ["AstrBot", "NapCat", "QQ", "DeepSeek"]
isTop: false
draft: false
---

看到 DeepSeek 进 QQ 和人聊天，聊着聊着还能聊出情绪来，很难不想自己试一次。B 站上十分钟的视频看起来毫无难度：装两个程序，扫个码，填个 API Key，机器人就上线了。真动手才发现十分钟的教程我折腾了一个多小时，中间还卡在解压失败和填错端口上。

所以把过程记下来。顺带说清楚每一步"配好了"到底该看什么日志，免得下次换电脑再踩一遍。

> 本文整理自 Soki 的[《AstrBot + NapCat 接入 QQ》](https://www.soki.moe/posts/astrbot-napcat-qq)，按自己的理解重写了措辞，配置步骤、端口和命令保持原样。

## 先把分工搞清楚

这套东西是四层串起来的：

```text
你的 QQ
   ↓
NapCat     登录 QQ、收发消息
   ↓
AstrBot    处理对话、人格、记忆、插件
   ↓
DeepSeek   生成回答（API 调用）
```

前两个跑在你自己电脑上，所以你的电脑就是服务器。代价有两条：每次对话花的是 API 的钱；电脑关机或休眠，机器人就跟着下班。

动手前需要：

- 一台 Windows 电脑；
- 一个专门给机器人用的 QQ（别拿主号）；
- DeepSeek 开放平台的 API Key；
- 只有要装长期记忆插件时，才需要一个 Embedding 模型。

本文基于 AstrBot 4.29.1。后续版本菜单可能改名，找不到配置项时先用页面里的搜索。

## 一、装 AstrBot

到 [AstrBot Launcher](https://github.com/AstrBotDevs/astrbot-launcher/releases/latest) 下载，Windows 选名字里带 `x64-setup.exe` 的那个。装完打开启动器，按提示下载 AstrBot、创建实例、部署实例。

新版启动器自己处理 Python 环境，不需要先研究环境变量。

第一次安装会停在"安装依赖"很久。我盯着 60% 看了半天，以为死机了——那个数字表示走到了第几个阶段，不是文件下载进度，后台还在解压和装依赖。先看日志，别因为数字不动就反复关掉重来。

下载确实慢的话，去启动器的"高级"里找"中国大陆一键加速"。

启动成功后日志里会出现：

```text
AstrBot started.
```

同时给出管理页面地址、初始用户名和随机密码。默认管理端口常见是 `6185`，但启动器创建的实例不一定是这个，我这次分到的是：

```text
http://127.0.0.1:22415
```

**一切以你自己的启动日志为准。** 浏览器打开那个地址，用日志里的账号和初始密码登录，登录后会提示改密码，改掉。

## 二、装 NapCat，让机器人上线

到 [NapCatQQ Releases](https://github.com/NapNeko/NapCatQQ/releases/latest) 下载 Windows 一键包：

```text
NapCat.Shell.Windows.OneKey.zip
```

解压后运行 `NapCatInstaller.exe`，它会自己拉 QQ 和依赖包。跑完进入生成的 `NapCat.XXXX.Shell` 目录，执行：

```bat
napcat.bat
```

Windows 的 CMD 控制台画不出二维码。按提示从缓存路径取二维码图片，或者复制链接丢给任意二维码工具生成后扫。用小号扫码登录，然后打开控制台打印的 WebUI 地址，默认通常是：

```text
http://127.0.0.1:6099
```

我在这里碰到过一次解压失败：

```text
Unexpected end of archive
```

后面跟着一串文件错误，最后报解压 NapCat 失败。原因是 `NapCat.Shell.zip` 没下完整。挂上全局代理重新下完整包，再装一遍就好。

## 三、把 NapCat 和 AstrBot 接起来

这一步最容易绕晕。两个程序都开着、QQ 也上线了，**不代表它们已经连上**。

先在 AstrBot 里建适配器：

```text
机器人 → 创建机器人 → OneBot v11
```

两边跑在同一台电脑上，可以这样填：

| 配置 | 示例 |
| --- | --- |
| ID | 自己起个名字 |
| 启用 | 开 |
| 反向 WebSocket 主机地址 | `127.0.0.1` |
| 反向 WebSocket 端口 | `6199` |
| 反向 WebSocket Token | 自己设的一串随机字符，纯数字也行 |

保存。然后去 NapCat：

```text
网络配置 → 新建 → WebSockets 客户端
```

启用它，URL 填：

```text
ws://127.0.0.1:6199/ws
```

Token 必须和 AstrBot 那边完全一致。

这里有三个端口，混了就会得到"页面都能打开但发消息没反应"：

| 端口 | 用途 |
| --- | --- |
| `22415` | 本次实例的 AstrBot 管理网页 |
| `6099` | NapCat 管理网页（WebUI） |
| `6199` | NapCat 与 AstrBot 之间的连接 |

我一开始把连接地址填成了 `ws://127.0.0.1:22415/ws`，结果两个管理页面都能正常打开，QQ 里发消息死活没回音。管理页面能开只说明网页在跑，机器人通信走的是另一个端口。

顺带区分三种凭证，它们不是同一个东西：

- NapCat WebUI Token：登录 NapCat 面板；
- 反向 WebSocket Token：两个程序之间验证连接；
- DeepSeek API Key：调用模型。

地址填对、Token 对齐之后，AstrBot 日志里要出现类似这句才算连上：

```text
aiocqhttp(OneBot v11) 适配器已连接
```

只有 `Loading IM platform adapter ...` 属于还没连上。

## 四、接 DeepSeek

去 [DeepSeek 开放平台](https://platform.deepseek.com/) 建 API Key，确认账户有可用额度。没有就充一点，够玩很久。

回 AstrBot：

```text
模型提供商 → 对话 → 新增
```

选 DeepSeek，填：

```text
API Base URL：https://api.deepseek.com/v1
API Key：你的 DeepSeek Key
```

保存后获取模型列表，把要用的模型加进去。我这次用的是：

```text
deepseek-flash
```

模型名会更新，以[官方文档](https://api-docs.deepseek.com/zh-cn/)和实际列表为准。

::: warning 别忘了设默认模型
只在"模型提供商"里添加模型还不算完，还要去：

```text
配置文件 → AI → 模型
```

把对话模型选成刚添加的那个并保存。漏了这步，消息能进来但回答会是空的或者报错。
:::

然后用自己的 QQ 给机器人发一句。如果配置了默认唤醒前缀 `/`：

```text
/你好
```

有回复，链路就通了。

## 五、给它一个人格

能回答之后，就该决定它是谁。原作者的设定是吃白饭的女仆大肥鱼，温柔可靠、有点俏皮、能接梗也有自己的判断。核心可以先写成这样：

```text
你是一只女性人格的大肥鱼，自我认知是这个家的女仆。

你温柔可靠，有自己的判断，偶尔嘴贫、摸鱼和讨饭。
平时像熟悉的朋友一样自然聊天。

日常回复通常一到三句。
对方分享生活时，先自然接话，不要立刻给解决方案。
认真讨论技术时，准确清晰，不为了人设编造事实。

不要每次都强调自己是鱼，也不要每句话都提白饭。
少用客服话术、括号动作和夸张表情。
不要每次结尾都反问，不必把所有话题升华成人生哲理。

记得的事情可以自然提起，不记得就承认。
不编造现实中的共同经历或自己不具备的能力。
```

建好人格之后，回：

```text
配置文件 → AI → 人格 → 默认采用的人格
```

选中它并保存。人格列表里堆着好几张卡片，不代表最后建的会自动生效。

如果之前的对话已经积累了一大堆旧风格回答，测之前用 `/reset` 清空当前上下文。注意它丢的是这段对话的上下文，不是每次聊天前都要敲的命令。

## 六、打开分段回复

截图里那种"像在聊天"的感觉，一部分来自节奏：几句话陆续发出来，和一次甩出整段完全不是一个观感。AstrBot 内置了这个功能。

我这个版本的入口：

```text
配置文件 → 扩展功能 → 分段回复
```

建议起步配置：

| 配置 | 值 |
| --- | --- |
| 启用分段回复 | 开 |
| 仅对 LLM 结果分段 | 开 |
| 间隔方法 | `random` |
| 随机间隔时间 | `1.5,3.5` |

分段只能改变发送方式，救不了内容本身。人格里还得限制长度，否则一段小作文切成五条发出来，还是小作文。

## 七、加长期记忆

插件市场搜 `astrbot_plugin_livingmemory`，项目在 [LivingMemory](https://github.com/lxfight-s-Astrbot-Plugins/astrbot_plugin_livingmemory)。它负责从对话里提炼记忆，并在之后的聊天中检索出来。我装的时候拿到的是 `2.7.0-beta.3`，求稳就优先选稳定版，插件和框架都更新得很快。

它需要两类模型：

- LLM：总结对话、整理记忆；
- Embedding：把内容转成向量，供检索使用。

DeepSeek 的聊天模型不能当 Embedding 用。我另外在[硅基流动](https://cloud.siliconflow.cn/)申请了 Key，然后：

```text
模型提供商 → 嵌入
```

添加一个 OpenAI 兼容的嵌入模型：

```text
API Base URL：https://api.siliconflow.cn/v1
模型名称：BAAI/bge-m3
```

再到 LivingMemory 的配置里选模型。我这边保存的 ID 是：

```text
Embedding 模型 ID：siliconflow_embedding
LLM 模型 ID：deepseek/deepseek-flash
```

这里填的是 AstrBot 内部保存的模型 ID，不一定等于服务商那边的模型名。

保存并重载插件，然后在 QQ 里发：

```text
/lmem status
```

正常聊几轮之后：

```text
/lmem summarize
/lmem search 游戏
```

分别验证总结和检索。

我第一次执行状态命令收到的是"权限不足"。处理方式：

```text
配置文件 → 访问控制 → 管理员 → 管理员 ID
```

把你自己聊天的 QQ 号加进去保存。注意这里填的是你的号，不是机器人的号。

::: tip 装好不等于跑通
插件装上、模型 ID 填对，只代表没有明显配置错误。真的总结一次、再搜一次刚聊过的内容，才能确认记忆链路是活的。
:::

## 八、让它偶尔主动找你

插件市场搜 `astrbot_plugin_proactive_chat`，项目在 [Proactive Chat](https://github.com/Pancakes-Labs/astrbot_plugin_proactive_chat)。

装完必须指定会话。默认私聊列表是空的，插件开着也不会对所有人广播。先在自己和机器人的私聊里发：

```text
/sid
```

把返回的完整会话 ID 填进插件的"私聊会话 UMO 列表"。

起步建议用宽松一点的间隔：

| 配置 | 建议 |
| --- | --- |
| 私聊主动消息 | 开 |
| 最小触发间隔 | 60 分钟 |
| 最大触发间隔 | 180 分钟 |
| 最大未回复次数 | 2 |
| 免打扰时段 | 按自己作息填 |
| TTS | 配好语音之前先关 |

主动消息的提示词也值得改。方向是延续最近的话题、问问事情进展、聊点游戏和技术，而不是隔三差五来一句"在吗""吃了吗""怎么不理我"。

保存后正常聊一句，让插件把后续任务排上。这里的间隔是等待时间，不是保存完立刻发消息。

## 几句实话

这套东西跑起来不难，难的是每个环节的"看起来好了"和"真的好了"差得很远：网页能打开不等于适配器连上，模型加进去不等于设成默认，插件装好不等于记忆能用。

排查思路只有一个：每一步都去找那条明确的成功日志或明确的返回，别靠界面猜测。
