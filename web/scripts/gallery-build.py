#!/usr/bin/env python3
"""把本地收藏目录整理成站点图库。

用法（路径只在本机命令行传入，不写进仓库）：
  python scripts/gallery-build.py \
    --src "D:/pictures/collection" \
    --out public/gallery \
    --manifest ../content/gallery.json \
    --hero 8,29,30,56,63,28 \
    --exclude 14,32,52,55,60

产出：
  public/gallery/thumb/NNN.webp   网格缩略图（最长边 640）
  public/gallery/full/NNN.webp    查看大图（最长边 1780）
  public/gallery/hero/NNN.webp    首页头图（1920x1080 裁切）
  content/gallery.json            真实尺寸 / 体积 / 平均色 / 原始文件名

所有数字都来自文件本身；不写入任何杜撰的标题或作者。
重复图片会按感知哈希（dHash）自动跳过，并在终端打印。
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime

from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = None
THUMB_EDGE = 640
FULL_EDGE = 1780
HERO_W, HERO_H = 1920, 1080
IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif")


def dhash(im: Image.Image, size: int = 8) -> int:
    small = im.convert("L").resize((size + 1, size), Image.Resampling.LANCZOS)
    pixels = list(small.getdata())
    bits = 0
    for row in range(size):
        for col in range(size):
            left = pixels[row * (size + 1) + col]
            right = pixels[row * (size + 1) + col + 1]
            bits = (bits << 1) | (1 if left > right else 0)
    return bits


def hamming(a: int, b: int) -> int:
    return ((a ^ b).bit_count()) if hasattr(int, "bit_count") else bin(a ^ b).count("1")


def average_color(im: Image.Image) -> str:
    tiny = im.convert("RGB").resize((1, 1), Image.Resampling.LANCZOS)
    r, g, b = tiny.getpixel((0, 0))
    return f"#{r:02x}{g:02x}{b:02x}"


def fit(im: Image.Image, edge: int) -> Image.Image:
    copy = im.copy()
    copy.thumbnail((edge, edge), Image.Resampling.LANCZOS)
    return copy


def crop_hero(im: Image.Image) -> Image.Image:
    return ImageOps.fit(im, (HERO_W, HERO_H), Image.Resampling.LANCZOS, centering=(0.5, 0.42))


def save_webp(im: Image.Image, path: str, quality: int) -> int:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGB")
    im.save(path, "WEBP", quality=quality, method=6)
    return os.path.getsize(path)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--hero", default="", help="要生成头图的序号，逗号分隔")
    parser.add_argument("--exclude", default="", help="要跳过的序号，逗号分隔")
    parser.add_argument("--near-dup", type=int, default=6, help="dHash 汉明距离阈值")
    args = parser.parse_args()

    src = os.path.abspath(args.src)
    out = os.path.abspath(args.out)
    files = sorted(f for f in os.listdir(src) if f.lower().endswith(IMAGE_EXTS))
    skip = {int(n) for n in args.exclude.split(",") if n.strip().isdigit()}
    hero_ids = [int(n) for n in args.hero.split(",") if n.strip().isdigit()]

    # 重新生成时保留博主手写的标题与备注（按原始文件名对应）
    previous: dict[str, dict] = {}
    if os.path.exists(args.manifest):
        try:
            with open(args.manifest, encoding='utf-8') as handle:
                previous = {entry.get('source'): entry for entry in json.load(handle)}
        except (OSError, ValueError):
            previous = {}

    items, hashes, dropped = [], [], []
    for index, name in enumerate(files):
        if index in skip:
            continue
        path = os.path.join(src, name)
        try:
            with Image.open(path) as raw:
                raw.load()
                im = ImageOps.exif_transpose(raw)
                if im.mode == "P":
                    im = im.convert("RGBA")
                width, height = im.size
                if width < 480 or height < 480:
                    dropped.append((name, "尺寸过小"))
                    continue
                hash_value = dhash(im)
                duplicate = next(
                    ((other["source"], hamming(hash_value, other["hash"])) for other in hashes
                     if hamming(hash_value, other["hash"]) <= args.near_dup),
                    None,
                )
                if duplicate:
                    dropped.append((name, f"近似重复 {duplicate[0]} (d={duplicate[1]})"))
                    continue
                ratio = width / height
                items.append({
                    "source": name,
                    "file": path,
                    "image": im,
                    "width": width,
                    "height": height,
                    "ratio": ratio,
                    "avg": average_color(im),
                    "mtime": os.path.getmtime(path),
                    "hash": hash_value,
                })
                hashes.append(items[-1])
        except Exception as exc:  # noqa: BLE001 - 单张损坏不应中断整批
            dropped.append((name, f"读取失败 {exc}"))

    # 横竖交错：先按文件时间排，再分两个队列轮流取，保证网格有节奏
    ordered = sorted(items, key=lambda item: item["mtime"])
    landscape = [item for item in ordered if item["ratio"] >= 1.15]
    portrait = [item for item in ordered if item["ratio"] < 1.15]
    mixed: list[dict] = []
    while landscape or portrait:
        if landscape:
            mixed.append(landscape.pop(0))
        if portrait:
            mixed.append(portrait.pop(0))

    manifest = []
    total = 0
    for number, item in enumerate(mixed, start=1):
        key = f"{number:03d}"
        hero_path = ""
        thumb_bytes = save_webp(fit(item["image"], THUMB_EDGE), os.path.join(out, "thumb", f"{key}.webp"), 78)
        full_bytes = save_webp(fit(item["image"], FULL_EDGE), os.path.join(out, "full", f"{key}.webp"), 82)
        if number in hero_ids or item["source"] in hero_ids:
            hero_path = f"/gallery/hero/{key}.webp"
            save_webp(crop_hero(item["image"]), os.path.join(out, "hero", f"{key}.webp"), 80)
        orientation = "square" if 0.87 <= item["ratio"] < 1.15 else ("landscape" if item["ratio"] >= 1.15 else "portrait")
        manifest.append({
            "no": number,
            "source": item["source"],
            "thumb": f"/gallery/thumb/{key}.webp",
            "src": f"/gallery/full/{key}.webp",
            "hero": hero_path,
            "width": item["width"],
            "height": item["height"],
            "bytes": full_bytes,
            "thumbBytes": thumb_bytes,
            "avg": item["avg"],
            "orientation": orientation,
            "title": previous.get(item["source"], {}).get("title", ""),
            "note": previous.get(item["source"], {}).get("note", ""),
            "collectedAt": datetime.fromtimestamp(item["mtime"]).strftime("%Y-%m-%d"),
        })
        total += full_bytes + thumb_bytes

    with open(args.manifest, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=1)
        handle.write("\n")

    print(f"图库 {len(manifest)} 张，派生文件合计 {total / 1e6:.1f} MB")
    print(f"头图 {sum(1 for item in manifest if item['hero'])} 张")
    for name, reason in dropped:
        print(f"  跳过 {name}: {reason}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
