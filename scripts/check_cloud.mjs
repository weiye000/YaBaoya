/**
 * 研途秘典 · 云端自检（真实浏览器访问线上地址）
 * 检查：配置生效（cloud 模式）→ 心事墙读 → 命运簿写/读 → 点亮
 * 运行：node scripts/check_cloud.mjs [url]
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const URL = process.argv[2] || "https://cloud1-d9gqiv9hvb5ead833-1499970026.tcloudbaseapp.com/";
const PORT = 9377;
const CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];
const CHROME = CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("未找到 Chrome/Edge"); process.exit(2); }

const PROFILE = path.join(os.tmpdir(), "ytm-cloudcheck-" + Date.now());
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--remote-debugging-port=" + PORT, "--user-data-dir=" + PROFILE, "about:blank"
], { stdio: "ignore" });

let failures = 0;
function check(cond, msg) {
  if (cond) console.log("  ✓ " + msg);
  else { failures++; console.error("  ✗ FAIL: " + msg); }
}
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
    this.errors = [];
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        resolve(msg.result);
      } else if (msg.method === "Runtime.exceptionThrown") {
        const d = msg.params.exceptionDetails.exception && msg.params.exceptionDetails.exception.description;
        this.errors.push("exception: " + (d || "").slice(0, 200));
      } else if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
        this.errors.push("console.error: " + (msg.params.entry.text || "").slice(0, 200));
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

  for (let i = 0; i < 40; i++) {
    const ready = await cdp.eval(`!!document.querySelector('#btn-start')`);
    if (ready) break;
    await sleep(500);
  }
  let pageInfo = await cdp.eval(`(() => ({
    url: location.href,
    title: document.title,
    hasYTM: typeof window.YTM !== "undefined",
    screens: (document.getElementById("screens") || { innerHTML: "" }).innerHTML.slice(0, 80)
  }))()`);
  console.log("pageInfo: " + JSON.stringify(pageInfo));
  /* 测试域名的官方风险提示页：点「确定访问」后重试 */
  if (!pageInfo.hasYTM && pageInfo.title.indexOf("风险") !== -1) {
    console.log("· 检测到测试域名提示页，点击「确定访问」…");
    await cdp.eval(`(() => {
      const btn = [...document.querySelectorAll("button,a")].find(el => el.textContent.includes("确定访问"));
      if (btn) btn.click();
    })()`);
    for (let i = 0; i < 60; i++) {
      await sleep(500);
      const ok = await cdp.eval(`!!document.querySelector('#btn-start')`);
      if (ok) break;
    }
    pageInfo = await cdp.eval(`(() => ({
      url: location.href,
      title: document.title,
      hasYTM: typeof window.YTM !== "undefined",
      screens: (document.getElementById("screens") || { innerHTML: "" }).innerHTML.slice(0, 80)
    }))()`);
    console.log("pageInfo(点击后): " + JSON.stringify(pageInfo));
  }
  cdp.errors.slice(0, 5).forEach((e) => console.log("  [页面错误] " + e));
  check(await cdp.eval(`YTM.backend.api.isCloud() === true`), "环境 ID 已生效（cloud 模式）");
  check(await cdp.eval(`YTM.backend.api.mode() === 'cloud'`), "后端选择 cloudbase 适配器");

  /* 心事墙读取（数据库读权限） */
  const wishRes = await cdp.eval(`YTM.backend.api.listWishes(5).then(r => ({ ok: true, n: r.length })).catch(e => ({ ok: false, msg: String((e && (e.message || e.code || e.errMsg)) || JSON.stringify(e)) }))`);
  check(wishRes.ok, "心事墙读取成功（读权限 OK）" + (wishRes.ok ? "，现有 " + wishRes.n + " 条" : "，错误：" + wishRes.msg));

  /* 命运簿云写入（数据库写权限） */
  const testReading = await cdp.eval(`YTM.game.createReading({ spreadId: "one", themeId: "general", seed: 1 })`);
  const saveRes = await cdp.eval(`YTM.backend.api.saveReading(${JSON.stringify({ seed: testReading.seed, themeTitle: "自检", spreadName: "单牌占卜", keyword: "自检", finalCardName: "自检牌", reading: testReading, result: { keyword: { word: "自检" } } })}).then(() => ({ ok: true })).catch(e => ({ ok: false, msg: String((e && (e.message || e.code || e.errMsg)) || JSON.stringify(e)) }))`);
  check(saveRes.ok, "命运簿云写入成功（写权限 OK）" + (saveRes.ok ? "" : "，错误：" + saveRes.msg));

  /* 同步码读取 */
  const listRes = await cdp.eval(`YTM.backend.api.listReadings(5).then(r => ({ ok: true, n: r.length })).catch(e => ({ ok: false, msg: String((e && (e.message || e.code || e.errMsg)) || JSON.stringify(e)) }))`);
  check(listRes.ok, "命运簿云读取成功" + (listRes.ok ? "，云端共 " + listRes.n + " 条" : "，错误：" + listRes.msg));

  /* 发帖 + 点亮 */
  const postRes = await cdp.eval(`YTM.backend.api.postWish("云端自检心事 " + Date.now(), "自检").then(r => ({ ok: true, id: r.id })).catch(e => ({ ok: false, msg: String((e && (e.message || e.code || e.errMsg)) || JSON.stringify(e)) }))`);
  check(postRes.ok, "心事发布成功" + (postRes.ok ? "" : "，错误：" + postRes.msg));
  if (postRes.ok) {
    const lightRes = await cdp.eval(`YTM.backend.api.lightWish(${JSON.stringify(postRes.id)}).then(() => ({ ok: true })).catch(e => ({ ok: false, msg: String((e && (e.message || e.code || e.errMsg)) || JSON.stringify(e)) }))`);
    check(lightRes.ok, "点亮成功" + (lightRes.ok ? "" : "，错误：" + lightRes.msg));
  }

  /* 账号云函数探测（可能因套餐不可用） */
  const fnRes = await cdp.eval(`(() => { try { return YTM.backend.impl.cloudbase ? "impl-ok" : "no-impl"; } catch (e) { return String(e); } })()`);
  check(fnRes === "impl-ok", "cloudbase 适配器已加载");

  /* 安全自检：users 集合是否对浏览器关闭直读 */
  const secRes = await cdp.eval(`YTM.backend.impl.cloudbase.probeUsers().then(r => r).catch(e => ({ error: String((e && e.message) || e) }))`);
  if (secRes && secRes.leaked === true) {
    check(false, "安全：users 集合仍可被浏览器直读（当前可读到 " + secRes.count + " 条）——请把 users 规则改为 {\"read\":false,\"write\":false}");
  } else if (secRes && secRes.error) {
    check(false, "安全自检执行失败：" + secRes.error);
  } else {
    check(true, "安全：users 集合已对浏览器关闭直读");
  }

  console.log(failures === 0 ? "\n云端自检全部通过 ✔" : "\n云端自检存在失败 ✗");
  try { await cdp.send("Browser.close"); } catch (e) { /* 忽略 */ }
  process.exit(failures === 0 ? 0 : 1);
} catch (err) {
  console.error("自检执行失败: " + err.message);
  chrome.kill();
  process.exit(1);
}
