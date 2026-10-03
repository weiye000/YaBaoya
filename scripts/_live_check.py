# -*- coding: utf-8 -*-
import urllib.request

BASE = "https://cloud1-d9gqiv9hvb5ead833-1499970026.tcloudbaseapp.com"
for p in ["/", "/src/main.js", "/src/config.backend.js", "/src/backend/adapter.js", "/src/styles/global.css", "/assets/cards/fool.jpg"]:
    try:
        r = urllib.request.urlopen(BASE + p, timeout=20)
        data = r.read()
        info = ""
        if p == "/":
            info = "title_ok=%s" % ("\u7814\u9014\u79d8\u5178" in data.decode("utf-8"))
        if p == "/src/config.backend.js":
            info = "envId_filled=%s" % ("cloud1-d9gqiv9hvb5ead833" in data.decode("utf-8"))
        print(p, r.status, len(data), info)
    except Exception as e:
        print(p, "FAIL", e)
