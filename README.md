# blog_chibarie

个人博客，纯静态部署在 GitHub Pages。

线上：<https://chibarie.github.io/blog_chibarie/>

## 技术栈

- Vue 3 + TypeScript
- Vite
- Tailwind CSS
- Markdown 内容，构建时生成静态数据
- GitHub Actions + GitHub Pages

## 目录

```
content/              # 文章、说说、站点配置
web/                  # Vue 前台
web/scripts/          # 构建与检查脚本
.github/workflows/    # Pages 部署
```

图片放在 `web/public/uploads/`，该目录与 `server/`、`admin/`（旧版本地后台存档）只保留在本地，不进公开仓库。

## 本地开发

```bash
cd web
npm ci
npm run dev
```

构建：

```bash
npm run build
```

## 写作

文章放在 `content/posts/`：

```md
---
title: 标题
slug: my-post
date: 2026-10-23T09:00:00+08:00
category: tech
tags: [Vue, TypeScript]
---

正文。
```

图片放在 `web/public/uploads/`，正文用 `/uploads/...` 引用。
草稿放在 `content/drafts/`，该目录不会提交到公开仓库。

## 部署

推送到 `main` 后，GitHub Actions 会自动构建并发布到 GitHub Pages。
