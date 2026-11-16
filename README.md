# blog_chibarie

<https://chibarie.github.io/blog_chibarie/>

个人站：技术笔记、生活记录、说说与图库。纯静态站点，Vue 3 + TypeScript + Vite + Tailwind，推送到 `main` 后由 GitHub Actions 构建并发布到 Pages。

## 内容放在哪

| 内容 | 位置 |
| --- | --- |
| 文章 | `content/posts/` |
| 说说 | `content/notes/` |
| 图库清单（编号、尺寸、体积、平均色） | `content/gallery.json` |
| 文章与说说图片 | `web/public/uploads/` |
| 图库派生图（缩略图 / 原图 / 头图） | `web/public/gallery/` |
| 私有草稿 | `content/drafts/`（不入库） |

## 本地

```bash
cd web
npm install
npm run dev     # 生成内容 + 开发服务器
npm run build   # 内容生成 + 类型检查 + 构建 + 静态路由外壳
```

## 图库

图库由本地收藏生成。脚本只写入真实尺寸、体积与平均色，不会编造标题：

```bash
python web/scripts/gallery-build.py \
  --src "<本地收藏目录>" \
  --out web/public/gallery \
  --manifest content/gallery.json \
  --hero 7,9,22,27,35,46
```

先跑一次拿到编号，再用 `--hero` 指定要裁成 1920×1080 头图的图版。重复运行会保留 `content/gallery.json` 里已有的 `title` 与 `note`。

## 界面

`web/src/styles/tokens.css` 定义两套完整主题（夜航 / 纸白）与单一强调色；切角只给可点击元素，正文与展示栏是直角。页面上的编号、尺寸、字数与计数都来自内容文件。主题、强调色、头图亮度/遮罩/模糊与正文字号可在站内「外观」面板调整，只保存在当前浏览器。
