# -*- coding: utf-8 -*-
import urllib.request

BASE = "https://cloud1-d9gqiv9hvb5ead833-1499970026.tcloudbaseapp.com/"
UAS = {
    "python": "Python-urllib/3.11",
    "chrome": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "wechat": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.30",
}
for name, ua in UAS.items():
    try:
        req = urllib.request.Request(BASE, headers={"User-Agent": ua})
        data = urllib.request.urlopen(req, timeout=20).read().decode("utf-8", "ignore")
        print(name, "->", "title_ok=%s" % ("\u7814\u9014\u79d8\u5178" in data),
              "| risk=%s" % ("\u98ce\u9669\u63d0\u9192" in data),
              "| len=%d" % len(data))
    except Exception as e:
        print(name, "FAIL", e)
