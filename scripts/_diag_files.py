# -*- coding: utf-8 -*-
import urllib.request

BASE = "https://cloud1-d9gqiv9hvb5ead833-1499970026.tcloudbaseapp.com"
for p in ["/", "/src/backend/adapter.js", "/src/backend/local.js", "/src/backend/cloudbase.js", "/src/config.backend.js"]:
    try:
        req = urllib.request.Request(BASE + p, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0", "Cache-Control": "no-cache"})
        data = urllib.request.urlopen(req, timeout=20).read().decode("utf-8", "ignore")
        if p == "/":
            print(p, "backend-script-tags:", data.count('src/backend/'), "| config-tag:", data.count('src/config.backend.js'))
        else:
            print(p, "len:", len(data), "| api defined:", "YTM.backend.api" in data, "| head:", data[:60].replace("\n", " "))
    except Exception as e:
        print(p, "FAIL", e)
