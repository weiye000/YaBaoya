# -*- coding: utf-8 -*-
"""
研途秘典 · HTTP 部署冒烟检查
用法：先起静态服务器（python -m http.server 8643），再运行本脚本。
检查：页面 UTF-8 内容、脚本/样式数量、全部静态资源（含插画与音效）200 可访问。
"""
import sys
import urllib.request

BASE = "http://127.0.0.1:8643"

ASSETS = ["assets/cards/%s.jpg" % i for i in [
    "fool", "magician", "priestess", "empress", "emperor", "hierophant", "lovers",
    "chariot", "hermit", "wheel", "justice", "hanged", "death", "temperance",
    "devil", "tower", "star", "moon", "sun", "judgement", "world", "seeker"
]] + ["assets/sounds/%s.wav" % s for s in ["click", "draw", "flip", "reveal", "result"]]

fails = 0


def check(cond, msg):
    global fails
    print(("OK  " if cond else "FAIL"), msg)
    if not cond:
        fails += 1


d = urllib.request.urlopen(BASE + "/index.html", timeout=5).read().decode("utf-8")
check("\u7814\u9014\u79d8\u5178" in d, "index.html 标题正确（研途秘典）")
check("\u4fdd\u7814" in d, "index.html 含「保研」文案")
check(d.count("<script src=") == 13, "index.html 引用 13 个脚本")
check(d.count('<link rel="stylesheet"') == 5, "index.html 引用 5 个样式表")

for path in ASSETS:
    try:
        r = urllib.request.urlopen(BASE + "/" + path, timeout=10)
        ok = r.status == 200 and r.headers.get("Content-Length", "0") != "0"
        if not ok:
            print("FAIL", path, "status", r.status)
            fails += 1
    except Exception as e:
        print("FAIL", path, e)
        fails += 1

print("assets checked:", len(ASSETS))
print("ALL OK" if fails == 0 else "FAILURES: %d" % fails)
sys.exit(0 if fails == 0 else 1)
