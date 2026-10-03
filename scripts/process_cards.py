# -*- coding: utf-8 -*-
"""
研途秘典 · 卡面图片后处理
- 验证全部下载图片可正常解码
- RWS 塔罗统一缩放至 640px 宽（JPEG quality 82，控制仓库体积）
- Flammarion 版画按卡面比例 208:368 裁剪（画面主体居中偏左 43%）
运行：python scripts/process_cards.py
"""
import os
from PIL import Image

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "cards")
TARGET_W = 640
CARD_RATIO = 208 / 368  # 卡面内框比例

RWS_IDS = ["fool", "magician", "priestess", "empress", "emperor", "hierophant", "lovers",
           "chariot", "hermit", "wheel", "justice", "hanged", "death", "temperance",
           "devil", "tower", "star", "moon", "sun", "judgement", "world"]


def process_rws(card_id):
    src = os.path.join(BASE, card_id + ".jpg")
    img = Image.open(src)
    img.load()
    if img.mode != "RGB":
        img = img.convert("RGB")
    if img.width > TARGET_W:
        h = int(round(img.height * TARGET_W / img.width))
        img = img.resize((TARGET_W, h), Image.LANCZOS)
    img.save(src, "JPEG", quality=82, optimize=True)
    return img.size


def process_seeker():
    src = os.path.join(BASE, "seeker_raw.jpg")
    img = Image.open(src)
    img.load()
    if img.mode != "RGB":
        img = img.convert("RGB")
    w, h = img.size
    crop_w = int(round(h * CARD_RATIO))
    if crop_w > w:
        crop_w = w
    center_x = int(w * 0.43)  # 版画主体（探出头的人物）位于中偏左
    left = max(0, min(center_x - crop_w // 2, w - crop_w))
    img = img.crop((left, 0, left + crop_w, h))
    if img.width > TARGET_W:
        nh = int(round(img.height * TARGET_W / img.width))
        img = img.resize((TARGET_W, nh), Image.LANCZOS)
    img.save(os.path.join(BASE, "seeker.jpg"), "JPEG", quality=85, optimize=True)
    os.remove(src)
    return img.size


def main():
    print("processing RWS cards...")
    for cid in RWS_IDS:
        try:
            size = process_rws(cid)
            kb = os.path.getsize(os.path.join(BASE, cid + ".jpg")) / 1024
            print("  %-12s %s  %.0f KB" % (cid, "x".join(map(str, size)), kb))
        except Exception as e:
            print("  FAIL %s: %s" % (cid, e))
            raise
    print("processing seeker...")
    size = process_seeker()
    kb = os.path.getsize(os.path.join(BASE, "seeker.jpg")) / 1024
    print("  %-12s %s  %.0f KB" % ("seeker", "x".join(map(str, size)), kb))
    total = sum(os.path.getsize(os.path.join(BASE, f)) for f in os.listdir(BASE) if f.endswith(".jpg"))
    print("total: %.1f MB" % (total / 1024 / 1024))


if __name__ == "__main__":
    main()
