# -*- coding: utf-8 -*-
import urllib.request
import sys

d = urllib.request.urlopen("http://127.0.0.1:8643/index.html", timeout=5).read().decode("utf-8")
checks = {
    "title_ok": "\u7814\u9014\u79d8\u5178" in d,          # 研途秘典
    "subtitle_ok": "\u4fdd\u7814" in d,                   # 保研
    "scripts": d.count("<script src=") == 13,
    "css": d.count('<link rel="stylesheet"') == 5,
}
for k, v in checks.items():
    print(k, "=", v)
    if not v:
        sys.exit(1)
print("ALL OK")
