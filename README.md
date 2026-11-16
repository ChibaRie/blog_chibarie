# blog_chibarie

<https://chibarie.github.io/blog_chibarie/>

纯静态站点，Vue 3 + Vite + Tailwind

## 内容

| 内容 | 位置 |
| --- | --- |
| 文章 | `content/posts/` |
| 说说 | `content/notes/` |
| 图库清单（编号、尺寸、体积、平均色） | `content/gallery.json` |
| 文章与说说图片 | `web/public/uploads/` |
| 图库派生图（缩略图 / 原图 / 头图） | `web/public/gallery/` |
| 私有草稿 | `content/drafts/`（不入库） |


## 图库

脚本只写入真实尺寸、体积与平均色

```bash
python web/scripts/gallery-build.py \
  --src "<本地收藏目录>" \
  --out web/public/gallery \
  --manifest content/gallery.json \
  --hero 7,9,22,27,35,46
```

先跑一次拿到编号，再用 `--hero` 指定要裁成 1920×1080 头图的图版。重复运行会保留 `content/gallery.json` 里已有的 `title` 与 `note`。
