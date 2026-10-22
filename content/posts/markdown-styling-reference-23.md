---
id: 23
title: "Markdown 写作语法参考"
slug: "markdown-styling-reference"
date: "2026-07-24T11:38:37+08:00"
updated: "2026-10-22T16:48:00+08:00"
summary: "提示块、代码块、表格等排版语法的速查表，写文章时随时对照。"
cover: "/uploads/2026/09/1789797039-0b4f341d8da47564.jpg"
category: "tech"
tags: []
isTop: false
draft: false
---
这篇是我自己写文章时的排版速查，忘了语法就回来翻一下。

## 提示块

用 `:::` 包裹，支持五种类型，标题可以自定义（不写就用默认的）。

::: tip 提示
适合放小技巧、补充说明。比如「按 `Ctrl+K` 可以快速搜索」。
:::

::: info 说明
适合放背景信息、名词解释，语气比提示更中性一些。
:::

::: warning 注意
适合放容易踩坑的地方。比如「改了配置记得重启服务」。
:::

::: danger 警告
适合放会造成数据丢失或不可逆后果的操作，用之前先想三秒。
:::

::: warning 自定义标题也可以
第一个空格后面的内容会当作标题，比如这条就换了标题。
:::

::: quote 摘录
适合放引用、原文摘抄、别人的观点。
:::

## 代码块

行内代码写作 `pnpm dev`，代码块标明语言就会自动高亮：

```go
func main() {
    db, err := gorm.Open(sqlite.Open("blog.db"), &gorm.Config{})
    if err != nil {
        log.Fatal(err)
    }
    log.Println("数据库已连接")
}
```

```bash
cd server && ./bin/blog-server.exe
```

## 其他常用语法

**加粗**、*斜体*、~~删除线~~、[链接](https://github.com/mirai-mamori/Sakurairo)。

无序列表：

- 第一项
- 第二项

有序列表：

1. 先做这个
2. 再做那个

表格：

| 类型 | 用途 | 颜色 |
| --- | --- | --- |
| tip | 技巧补充 | 粉 |
| info | 背景说明 | 蓝紫 |
| warning | 注意避坑 | 琥珀 |
| danger | 危险操作 | 红 |

引用：

> 把学到的东西讲清楚，才知道自己是不是真的懂了。

## 几个容易忘的细节

正文从 `##` 开始写，页面右侧会自动生成目录，`###` 会作为子项缩进。提示块用 `:::` 开、`:::` 单独一行收，中间别留空行。
