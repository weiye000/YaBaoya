/**
 * 研途秘典 · 登录链路诊断（一次性）
 * 访问线上地址 → 点过测试域名提示页 → 尝试一次登录调用，打印真实错误
 * 运行：node scripts/_diag_login.mjs
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const URL = "https://cloud1-d9gqiv9hvb5ead833-1499970026.tcloudbaseapp.com/";
const PORT = 9389;
const CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];
const CHROME = CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("未找到 Chrome/Edge"); process.exit(2); }

const PROFILE = path.join(os.tmpdir(), "ytm-diag-" + Date.now());
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--remote-debugging-port=" + PORT, "--user-data-dir=" + PROFILE, "about:blank"
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevtools() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return;
    } catch (e) { /* retry */ }
    await sleep(250);
  }
  throw new Error("DevTools 端口未就绪");
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve) => this.pending.set(id, { resolve }));
  }
  async eval(expr) {
    const r = await this.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails.exception && r.exceptionDetails.exception.description;
      throw new Error("evaluate 异常: " + (d || JSON.stringify(r.exceptionDetails)));
    }
    return r.result.value;
  }
}

try {
  await waitForDevtools();
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(URL)}`, { method: "PUT" })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
  const cdp = new CDP(ws);
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");

  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const title = await cdp.eval(`document.title`);
    const hasApi = await cdp.eval(`typeof window.YTM !== "undefined" && typeof YTM.backend !== "undefined" && typeof YTM.backend.api !== "undefined"`);
    if (hasApi) break;
    if (title.indexOf("风险") !== -1 || title.indexOf("提示") !== -1) {
      await cdp.eval(`(() => {
        const btn = [...document.querySelectorAll("button,a")].find(el => el.textContent.includes("确定访问"));
        if (btn) btn.click();
      })()`);
    }
  }
  console.log("后端就绪: " + (await cdp.eval(`typeof window.YTM !== "undefined" && typeof YTM.backend !== "undefined" && typeof YTM.backend.api !== "undefined"`)));

  const r = await cdp.eval(`(async () => {
    const out = {};
    try {
      out.auth = await YTM.backend.impl.cloudbase.probeAuth();
    } catch (e) {
      out.auth = { error: String((e && (e.message || e.errMsg)) || JSON.stringify(e)) };
    }
    try {
      out.login = await YTM.backend.api.login("diag-probe-xyz", "123456").then(x => ({ ok: true, x: JSON.stringify(x) }));
    } catch (e) {
      out.login = { ok: false, err: String((e && (e.message || e.errMsg || e.msg)) || JSON.stringify(e)) };
    }
    return out;
  })()`);
  console.log("诊断结果: " + JSON.stringify(r, null, 2));

  try { await cdp.send("Browser.close"); } catch (e) { /* 忽略 */ }
  process.exit(0);
} catch (err) {
  console.error("诊断执行失败: " + err.message);
  chrome.kill();
  process.exit(1);
}
