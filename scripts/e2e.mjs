/**
 * 研途秘典 · 真实浏览器 E2E（Chrome DevTools Protocol）
 * 需求：本机安装 Chrome/Edge；Node ≥ 22（内置 fetch 与 WebSocket）
 * 运行：node scripts/e2e.mjs
 * 覆盖：桌面 + 移动视口下的完整旅程、JS 异常与 console.error 捕获、截图
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import os from "node:os";
import path from "node:path";

const PORT = 9333;
const HTTP_PORT = 9643;
const CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];
const CHROME = CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("未找到 Chrome/Edge，跳过 E2E"); process.exit(2); }

const PROFILE = path.join(os.tmpdir(), "ytm-e2e-" + Date.now());
const SHOTS = path.join(os.tmpdir(), "ytm-e2e-shots");
mkdirSync(SHOTS, { recursive: true });

/* 内置静态服务器（HTTP 同源，模拟生产环境；file:// 会让 Canvas 被污染） */
const ROOT = resolve(".");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".wav": "audio/wav",
  ".svg": "image/svg+xml",
  ".json": "application/json"
};
const httpServer = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (p === "/") p = "/index.html";
    const file = join(ROOT, normalize(p).replace(/^[/\\]+/, ""));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  } catch (e) {
    console.log("http 404:", req.url);
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => httpServer.listen(HTTP_PORT, "127.0.0.1", r));
/* 服务器自检 */
const selfCheck = await fetch(`http://127.0.0.1:${HTTP_PORT}/index.html`).then((r) => r.status).catch((e) => "ERR:" + e.message);
console.log("http self-check:", selfCheck);

const PAGE_URL = `http://127.0.0.1:${HTTP_PORT}/index.html`;

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
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method === "Runtime.exceptionThrown") {
        this.errors.push("exception: " + JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
      } else if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
        this.errors.push("console.error: " + (msg.params.entry.text || "").slice(0, 300));
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  async eval(expr) {
    const r = await this.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails.exception && r.exceptionDetails.exception.description;
      throw new Error("evaluate 异常: " + (d || JSON.stringify(r.exceptionDetails)));
    }
    return r.result.value;
  }
  async shot(name) {
    const r = await this.send("Page.captureScreenshot", { format: "png" });
    const { writeFileSync } = await import("node:fs");
    writeFileSync(path.join(SHOTS, name), Buffer.from(r.data, "base64"));
    console.log("  📷 截图: " + name);
  }
}

try {
  await waitForDevtools();
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(PAGE_URL)}`, { method: "PUT" })).json();
  console.log("target:", JSON.stringify({ id: target.id, url: target.url, type: target.type }));
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
  const cdp = new CDP(ws);
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Log.enable");

  /* 等待首页渲染 */
  for (let i = 0; i < 40; i++) {
    const ready = await cdp.eval(`!!document.querySelector('#btn-start')`);
    if (ready) break;
    await sleep(250);
  }

  /* 页面加载诊断 */
  const pageInfo = await cdp.eval(`(() => ({
    url: location.href,
    title: document.title,
    hasHome: !!document.querySelector('#screen-home'),
    screensHtml: (document.getElementById('screens') || { innerHTML: "(no #screens)" }).innerHTML.slice(0, 150)
  }))()`);
  console.log("pageInfo: " + JSON.stringify(pageInfo));

  /* ---------- 桌面视口 ---------- */
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await sleep(300);
  check(await cdp.eval(`document.querySelector('#screen-home').classList.contains('active')`), "桌面：首页激活");
  check(await cdp.eval(`document.querySelectorAll('.theme-card').length === 8`), "桌面：8 个主题卡");
  check(await cdp.eval(`document.querySelectorAll('.spread-option').length === 3`), "桌面：3 种牌阵");
  await cdp.shot("01-home-desktop.png");

  /* ---------- 移动视口 + 完整旅程 ---------- */
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(300);
  await cdp.shot("02-home-mobile.png");

  await cdp.eval(`document.querySelector('#btn-start').click()`); await sleep(350);
  check(await cdp.eval(`document.querySelector('#screen-theme').classList.contains('active')`), "移动：开始占卜 → 主题页");
  await cdp.shot("03-theme-mobile.png");

  await cdp.eval(`document.querySelector('.theme-card').click()`); await sleep(350);
  check(await cdp.eval(`document.querySelector('#screen-question').classList.contains('active')`), "移动：主题 → 问题页");
  await cdp.eval(`document.querySelector('#btn-ritual').click()`); await sleep(350);
  check(await cdp.eval(`document.querySelector('#screen-spread').classList.contains('active')`), "移动：问题 → 牌阵页");

  await cdp.eval(`document.querySelector('#btn-deal').click()`); await sleep(500);
  check(await cdp.eval(`document.querySelector('#screen-draw').classList.contains('active')`), "移动：开始抽牌 → 抽牌页");
  check(await cdp.eval(`document.querySelectorAll('#draw-spread .spread-card').length === 5`), "移动：5 张牌背就位");
  const scrollAudit = await cdp.eval(`(() => {
    const spread = document.querySelector('#draw-spread');
    const sr = spread.getBoundingClientRect();
    const first = spread.querySelector('.card-slot').getBoundingClientRect();
    const atStart = first.left >= sr.left - 2;
    spread.scrollLeft = spread.scrollWidth;
    const last = spread.querySelector('.card-slot:last-child').getBoundingClientRect();
    const atEnd = last.right <= sr.right + 2;
    return { atStart, atEnd, scrollable: spread.scrollWidth > spread.clientWidth };
  })()`);
  check(scrollAudit.atStart, "移动：初始位置第一张牌（优势位）完整可见");
  check(scrollAudit.atEnd, "移动：可滚动到最后一张牌（启示位）完整可见");
  check(scrollAudit.scrollable, "移动：五牌阵可横向滚动");
  check(await cdp.eval(`getComputedStyle(document.querySelector('#btn-result')).display === 'none'`), "移动：翻牌前解读按钮不可见");
  const imgsOk = await cdp.eval(`new Promise(res => {
    const ids = YTM.data.cards.map(c => c.id);
    let left = ids.length; let ok = true;
    ids.forEach(id => {
      const i = new Image();
      i.onload = () => { if (--left === 0) res(ok); };
      i.onerror = () => { ok = false; if (--left === 0) res(ok); };
      i.src = 'assets/cards/' + id + '.jpg';
    });
  })`);
  check(imgsOk, "移动：22 张卡面插画全部可加载");
  await cdp.shot("04-draw-mobile.png");

  for (let i = 0; i < 5; i++) {
    await cdp.eval(`document.querySelectorAll('#draw-spread .spread-card')[${i}].click()`);
    await sleep(900);
  }
  check(await cdp.eval(`document.querySelectorAll('#draw-spread .spread-card.flipped').length === 5`), "移动：5 张牌全部翻开");
  check(await cdp.eval(`document.querySelectorAll('#draw-spread .card-front svg image').length === 5`), "移动：翻开的牌面嵌入插画（5 张）");
  check(await cdp.eval(`!document.querySelector('#btn-result').hidden`), "移动：出现「查看完整解读」");
  check(await cdp.eval(`getComputedStyle(document.querySelector('#btn-result')).display !== 'none'`), "移动：翻牌后解读按钮可见");
  await cdp.shot("05-reveal-mobile.png");

  await cdp.eval(`document.querySelector('#btn-result').click()`); await sleep(600);
  check(await cdp.eval(`document.querySelector('#screen-result').classList.contains('active')`), "移动：进入结果页");
  check(await cdp.eval(`document.querySelectorAll('.summary-item').length === 5`), "移动：牌阵摘要 5 张");
  check(await cdp.eval(`document.querySelectorAll('.percard').length === 5`), "移动：逐牌详解 5 张");
  check(await cdp.eval(`document.querySelectorAll('.percard .card-detail-lead').length === 5`), "移动：每张牌都有位置×正逆位开场白");
  check(await cdp.eval(`document.querySelector('.keyword-word').textContent.length > 0`), "移动：关键词已渲染");
  check(await cdp.eval(`document.querySelectorAll('.tip-item').length >= 3`), "移动：命运提示 ≥3 条");
  await cdp.shot("06-result-mobile.png");

  await cdp.eval(`document.querySelector('#btn-share-open').click()`); await sleep(1200);
  check(await cdp.eval(`document.querySelector('#share-canvas').width === 1080`), "移动：分享卡 1080×1440");
  check(await cdp.eval(`document.querySelector('#modal-share').hidden === false`), "移动：分享弹窗打开");
  const sharePixels = await cdp.eval(`(() => {
    const cv = document.querySelector('#share-canvas');
    if (!cv) return { diag: 'canvas-missing' };
    const ctx = cv.getContext('2d');
    if (!ctx) return { diag: 'ctx-null' };
    const px = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data).join(',');
    let corner = null, cardMid = null, cardSide = null, tainted = false;
    try {
      corner = px(110, 110);
      cardMid = px(540, 975);
      cardSide = px(879, 810);
    } catch (e) {
      tainted = true;
    }
    return { diag: 'ok', tainted, corner, cardMid, cardSide };
  })()`);
  check(sharePixels.diag === "ok" && !sharePixels.tainted, "分享卡：Canvas 可读取像素（diag=" + sharePixels.diag + "）");
  if (sharePixels.diag === "ok" && !sharePixels.tainted) {
    check(sharePixels.cardMid !== sharePixels.corner, "分享卡：中央卡牌已真实绘制（非空背景）");
    check(sharePixels.cardSide !== sharePixels.corner, "分享卡：扇形侧卡已真实绘制（非空背景）");
  }
  await cdp.shot("07-share-mobile.png");

  await cdp.eval(`document.querySelector('#btn-again').click()`); await sleep(350);
  check(await cdp.eval(`document.querySelector('#screen-theme').classList.contains('active')`), "移动：再问一次 → 主题页");

  /* 命运簿 + 图鉴 + 云同步设置 */
  await cdp.eval(`document.querySelector('#btn-history').click()`); await sleep(300);
  check(await cdp.eval(`document.querySelectorAll('#history-list .history-item').length === 1`), "移动：命运簿记录 1 次占卜");
  check(await cdp.eval(`document.querySelectorAll('#history-tabs .history-tab').length === 2`), "移动：命运簿含「命运簿 / 研途图鉴」标签页");
  await cdp.eval(`document.querySelector('#history-tabs .history-tab[data-tab="collection"]').click()`); await sleep(200);
  check(await cdp.eval(`document.querySelectorAll('.collection-item').length === 22`), "移动：图鉴展示 22 张卡牌");
  check(await cdp.eval(`document.querySelectorAll('.collection-item.got').length >= 5`), "移动：本次抽到的牌已收入图鉴");
  check(await cdp.eval(`document.querySelector('.collection-progress').textContent.includes('5 / 22')`), "移动：图鉴进度为 5/22");
  await cdp.shot("08-history-mobile.png");
  await cdp.eval(`document.querySelector('#btn-account-open').click()`); await sleep(200);
  check(await cdp.eval(`document.querySelector('#account-body').textContent.includes('云同步尚未配置')`), "移动：未配置时同步设置显示配置指引");
  await cdp.shot("09-sync-mobile.png");
  await cdp.eval(`document.querySelectorAll('[data-close="modal-account"]')[0].click()`); await sleep(200);
  await cdp.eval(`document.querySelectorAll('[data-close="modal-history"]')[0].click()`); await sleep(200);

  /* 心事墙（演示模式） */
  await cdp.eval(`document.querySelector('#btn-wish').click()`); await sleep(400);
  check(await cdp.eval(`document.querySelector('#modal-wish').hidden === false`), "移动：心事墙弹窗打开");
  check(await cdp.eval(`document.querySelector('#wish-body').textContent.includes('演示模式')`), "移动：演示模式显示提示");
  check(await cdp.eval(`document.querySelectorAll('#wish-list .wish-item').length >= 3`), "移动：展示示例心事");
  await cdp.eval(`document.querySelector('#wish-text').value = 'E2E 测试心事'; document.querySelector('#wish-text').dispatchEvent(new Event('input'));`); await sleep(100);
  await cdp.eval(`document.querySelector('#btn-wish-post').click()`); await sleep(400);
  check(await cdp.eval(`document.querySelector('#wish-list').textContent.includes('E2E 测试心事')`), "移动：心事发布成功并显示「我的」标记");
  await cdp.shot("10-wish-mobile.png");
  await cdp.eval(`document.querySelectorAll('[data-close="modal-wish"]')[0].click()`); await sleep(200);

  /* ---------- 布局审计（移动视口 390×844） ---------- */

  const overflowOf = `(() => {
    const vw = window.innerWidth;
    const out = [];
    document.querySelectorAll('.screen.active *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > vw + 2 || r.left < -2)) {
        out.push((el.className.toString().split(' ')[0] || el.tagName) + ':' + Math.round(r.right));
      }
    });
    return out;
  })()`;
  const act = await cdp.eval(`document.querySelector('.screen.active').id`);
  const of1 = await cdp.eval(overflowOf);
  check(of1.length === 0, "移动：" + act + " 屏无元素溢出视口（" + of1.join(",") + "）");

  /* 快速走到抽牌页审计卡牌布局 */
  await cdp.eval(`document.querySelector('.theme-card').click()`); await sleep(300);
  await cdp.eval(`document.querySelector('#btn-ritual').click()`); await sleep(300);
  await cdp.eval(`document.querySelector('#btn-deal').click()`); await sleep(500);
  const drawAudit = await cdp.eval(`(() => {
    const card = document.querySelector('#draw-spread .spread-card').getBoundingClientRect();
    const spread = document.querySelector('#draw-spread');
    const of = [];
    document.querySelectorAll('#screen-draw .screen-body > *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > window.innerWidth + 2) of.push(el.id || el.className);
    });
    return { cardW: Math.round(card.width), cardH: Math.round(card.height),
             scrollable: spread.scrollWidth > spread.clientWidth, of };
  })()`);
  check(drawAudit.cardW >= 130 && drawAudit.cardW <= 200, "移动：卡牌宽 " + drawAudit.cardW + "px（130–200 区间）");
  check(Math.abs(drawAudit.cardH / drawAudit.cardW - 5 / 3) < 0.02, "移动：卡牌比例 5:3（高 " + drawAudit.cardH + "）");
  check(drawAudit.scrollable, "移动：五牌阵可横向滚动");
  check(drawAudit.of.length === 0, "移动：抽牌页无溢出（" + drawAudit.of.join(",") + "）");

  /* 刷新回首页，审计排版与配色 */
  await cdp.eval(`location.reload()`); await sleep(1500);
  check(await cdp.eval(`parseFloat(getComputedStyle(document.querySelector('.keyword-word, .home-title')).fontSize) >= 38`), "移动：主标题字号 ≥ 38px");
  check(await cdp.eval(`getComputedStyle(document.body).backgroundColor === 'rgb(6, 6, 15)'`), "移动：暗色主题背景生效");
  const homeAudit = await cdp.eval(`(() => {
    const r = document.querySelector('#btn-start').getBoundingClientRect();
    return { inView: r.top > 0 && r.bottom < window.innerHeight, w: Math.round(r.width) };
  })()`);
  check(homeAudit.inView, "移动：首页主按钮完整可见");
  check(homeAudit.w >= 280, "移动：首页主按钮宽度 ≥ 280px（实际 " + homeAudit.w + "）");

  /* 桌面布局 */
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(400);
  const desk = await cdp.eval(`(() => {
    const em = document.querySelector('.home-emblem-wrap').getBoundingClientRect();
    return { emW: Math.round(em.width), centered: Math.abs((em.left + em.right) / 2 - window.innerWidth / 2) < 20 };
  })()`);
  check(desk.centered && desk.emW >= 280 && desk.emW <= 320, "桌面：法阵居中且尺寸合理（" + desk.emW + "px）");

  check(cdp.errors.length === 0, "全程无 JS 异常 / console.error（" + cdp.errors.length + "）");
  cdp.errors.slice(0, 5).forEach((e) => console.error("    " + e));

  console.log(failures === 0 ? "\n真实浏览器 E2E 通过 ✔" : "\n真实浏览器 E2E 存在失败 ✗");
  console.log("截图目录: " + SHOTS);
  try { await cdp.send("Browser.close"); } catch (e) { /* 忽略 */ }
  httpServer.close();
  process.exit(failures === 0 ? 0 : 1);
} catch (err) {
  console.error("E2E 执行失败: " + err.message);
  chrome.kill();
  httpServer.close();
  process.exit(1);
}
