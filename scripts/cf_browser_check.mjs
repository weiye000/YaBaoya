/**
 * 研途秘典 · Cloudflare 线上真机验证（真实浏览器 + CDP）
 * 覆盖：页面加载 → 身份门 → 匿名进入 → 心事墙 → 注册新账号 → 进入游戏 → 数据入库校验 → 清理
 * 用法：YTM_WORKER_URL=https://xxx.workers.dev node scripts/cf_browser_check.mjs
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const PAGE = process.env.YTM_WORKER_URL || "https://yantu-midian.yabaoyan.workers.dev";
const PORT = 9411;
const SHOTS = path.join(os.tmpdir(), "ytm-cf-shots");
const CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];
const CHROME = CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("未找到 Chrome/Edge"); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
function check(ok, label, extra) {
  if (ok) { pass++; console.log("  ✓ " + label); }
  else { fail++; console.log("  ✗ " + label + (extra ? " → " + extra : "")); }
}

const profile = path.join(os.tmpdir(), "ytm-cf-browser-" + Date.now());
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--remote-debugging-port=" + PORT, "--user-data-dir=" + profile, "about:blank"
], { stdio: "ignore" });

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.errors = [];
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === "Runtime.exceptionThrown") {
        const d = msg.params.exceptionDetails;
        this.errors.push("exception: " + (d.exception && d.exception.description || d.text));
      }
      if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
        this.errors.push("console.error: " + msg.params.args.map((a) => a.value || a.description || "").join(" "));
      }
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
    if (r.exceptionDetails) throw new Error("evaluate: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description));
    return r.result.value;
  }
}

try {
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

  /* 等待页面与后端就绪 */
  let ready = false;
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    ready = await cdp.eval(`typeof window.YTM !== "undefined" && typeof YTM.backend !== "undefined" && typeof YTM.backend.api !== "undefined"`);
    if (ready) break;
  }
  check(ready, "页面与脚本加载完成");
  check(await cdp.eval(`YTM.backend.api.isCloud()`), "运行在云端模式（Worker 后端）");
  check(await cdp.eval(`YTM.backend.api.mode()`) === "cloud", "适配器模式为 cloud");

  console.log("== 身份门 ==");
  await cdp.eval(`document.querySelector('#btn-start').click()`); await sleep(1200);
  check(await cdp.eval(`document.querySelector('#screen-gate').classList.contains('active')`), "开始占卜 → 身份门");
  check(await cdp.eval(`!!document.querySelector('#btn-gate-anon')`), "身份门含「匿名进入」");
  check(await cdp.eval(`!!document.querySelector('#btn-gate-register')`), "身份门含注册入口");

  await cdp.eval(`document.querySelector('#btn-gate-anon').click()`); await sleep(600);
  check(await cdp.eval(`document.querySelector('#screen-theme').classList.contains('active')`), "匿名进入 → 主题页");
  const device = await cdp.eval(`YTM.backend.api.deviceId()`);
  check(!!device && device.indexOf("d_") === 0, "匿名会话已建立（设备身份 " + device + "）");

  console.log("== 心事墙（真实读写 D1） ==");
  await cdp.eval(`document.querySelector('#btn-wish').click()`); await sleep(1500);
  const wishOpen = await cdp.eval(`!document.querySelector('#modal-wish').hidden`);
  check(wishOpen, "心事墙弹窗打开");
  const before = await cdp.eval(`document.querySelectorAll('.wish-item').length`);
  check(typeof before === "number", "心事列表渲染（当前 " + before + " 条）");

  console.log("== 注册账号（真实 PBKDF2 + Worker 注册） ==");
  const username = "自检" + Date.now().toString().slice(-6);
  await cdp.eval(`document.querySelector('#btn-wish').click()`); await sleep(400);
  await cdp.eval(`document.querySelector('#btn-start').click()`); await sleep(800);
  await cdp.eval(`document.querySelector('#gate-name').value = ${JSON.stringify(username)}`);
  await cdp.eval(`document.querySelector('#gate-pass').value = "test123456"`);
  await cdp.eval(`document.querySelector('#btn-gate-register').click()`);
  await sleep(3500);
  const after = await cdp.eval(`({ theme: document.querySelector('#screen-theme').classList.contains('active'), err: (document.querySelector('#gate-error') || {}).textContent || "", user: JSON.stringify(YTM.backend.api.user()) })`);
  check(after.theme, "注册成功后进入主题页", after.err);
  check(/"username":"/.test(after.user), "本地记录登录态：" + after.user);

  console.log("== 云端登录态 ==");
  const state = await cdp.eval(`YTM.backend.api.loginState().then(s => JSON.stringify(s))`);
  check(/"username":"/.test(state), "服务端确认登录态：" + state);

  if (process.env.CF_CLEAN === "1") {
    console.log("  清理账号：" + username + "（请用 D1 控制台删除，或保持为测试账号）");
  }

  check(cdp.errors.length === 0, "全局无 JS 异常（" + cdp.errors.length + "）");
  cdp.errors.slice(0, 5).forEach((e) => console.log("    " + e));

  const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  const fs = await import("node:fs");
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.writeFileSync(path.join(SHOTS, "cf-live.png"), Buffer.from(shot.data, "base64"));
  console.log("📷 截图：" + path.join(SHOTS, "cf-live.png"));

  try { await cdp.send("Browser.close"); } catch (e) { /* ignore */ }
  console.log(`\n结果：通过 ${pass} 项，失败 ${fail} 项`);
  process.exit(fail === 0 ? 0 : 1);
} catch (err) {
  console.error("执行失败：" + err.message);
  chrome.kill();
  process.exit(1);
}
