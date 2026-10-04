/**
 * 研途秘典 · 线上页面截图（首页 / 身份门 / 主题页）
 * 用法：YTM_WORKER_URL=https://xxx.workers.dev node scripts/cf_shots.mjs
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PAGE = process.env.YTM_WORKER_URL || "https://yantu-midian.yabaoyan.workers.dev";
const PORT = 9412;
const OUT = process.env.YTM_SHOT_DIR || path.join(os.tmpdir(), "ytm-cf-shots");
const CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];
const CHROME = CANDIDATES.find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = path.join(os.tmpdir(), "ytm-shots-" + Date.now());
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--window-size=430,932",
  "--remote-debugging-port=" + PORT, "--user-data-dir=" + profile, "about:blank"
], { stdio: "ignore" });

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { this.pending.get(m.id).resolve(m.result); this.pending.delete(m.id); }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve) => this.pending.set(id, { resolve }));
  }
  async eval(expr) {
    const r = await this.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result && r.result.value;
  }
  async shot(name) {
    const r = await this.send("Page.captureScreenshot", { format: "png" });
    fs.mkdirSync(OUT, { recursive: true });
    const p = path.join(OUT, name);
    fs.writeFileSync(p, Buffer.from(r.data, "base64"));
    console.log("📷 " + p);
  }
}

for (let i = 0; i < 40; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) break; } catch (e) { /* retry */ }
  await sleep(250);
}
const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(PAGE)}`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
const cdp = new CDP(ws);
await cdp.send("Runtime.enable");
await cdp.send("Page.enable");
await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

for (let i = 0; i < 60; i++) {
  await sleep(500);
  if (await cdp.eval(`typeof window.YTM !== "undefined" && typeof YTM.backend !== "undefined"`)) break;
}
await sleep(1200);
await cdp.shot("live-01-home.png");

await cdp.eval(`document.querySelector('#btn-start').click()`);
await sleep(1500);
await cdp.shot("live-02-gate.png");

await cdp.eval(`document.querySelector('#btn-gate-anon').click()`);
await sleep(900);
await cdp.shot("live-03-theme.png");

try { await cdp.send("Browser.close"); } catch (e) { /* ignore */ }
console.log("完成");
process.exit(0);
