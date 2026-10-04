/**
 * 研途秘典 · 端到端冒烟测试（Node + 最小 DOM 桩）
 * 1) 按 index.html 顺序真实加载全部脚本并执行 boot()；
 * 2) 捕获事件委托，模拟完整用户旅程：
 *    开始占卜 → 选主题 → 进入仪式 → 抽牌 → 连翻 5 张 → 完整解读 → 分享卡
 * 运行：node scripts/smoke.mjs
 */
import { pathToFileURL } from "node:url";
import path from "node:path";

/* ---------- 最小 DOM 桩 ---------- */
const elements = new Map();

function makeClassList() {
  const set = new Set();
  return {
    set,
    add(...c) { c.forEach((x) => set.add(x)); },
    remove(...c) { c.forEach((x) => set.delete(x)); },
    toggle(c, force) {
      const on = force === undefined ? !set.has(c) : !!force;
      if (on) set.add(c); else set.delete(c);
      return on;
    },
    contains(c) { return set.has(c); }
  };
}

function makeEl(id) {
  return {
    id,
    innerHTML: "",
    textContent: "",
    hidden: false,
    style: {},
    dataset: {},
    value: "",
    width: 0,
    height: 0,
    clientWidth: 800,
    clientHeight: 600,
    attributes: {},
    classList: makeClassList(),
    listeners: {},
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return this.attributes[k] === undefined ? null : this.attributes[k]; },
    /* 模拟外部脚本/图片加载：设置 src 后异步触发 onload */
    set src(v) { this._src = v; setTimeout(() => { if (this.onload) this.onload(); }, 0); },
    get src() { return this._src; },
    addEventListener(type, fn) {
      (this.listeners[type] = this.listeners[type] || []).push(fn);
    },
    removeEventListener() {},
    appendChild() {},
    after() {},
    remove() {},
    closest() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getContext() {
      return new Proxy({}, {
        get: (t, k) => (typeof k === "symbol" ? undefined : () => ({ addColorStop() {} })),
        set: () => true
      });
    }
  };
}

globalThis.document = {
  readyState: "complete",
  hidden: false,
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, makeEl(id));
    return elements.get(id);
  },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  createElement() { return makeEl(""); },
  addEventListener() {},
  body: makeEl("body"),
  head: makeEl("head")
};

globalThis.innerWidth = 800;
globalThis.innerHeight = 600;
globalThis.devicePixelRatio = 1;
globalThis.scrollTo = () => {};
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.matchMedia = () => ({ matches: false });
/* Image 桩：模拟插画加载成功，驱动分享卡走真实插画绘制路径 */
globalThis.Image = class {
  constructor() { this.naturalWidth = 640; this.naturalHeight = 1100; }
  set src(v) { this._src = v; setTimeout(() => { if (this.onload) this.onload(); }, 0); }
  get src() { return this._src; }
};
const lsStore = new Map();
globalThis.localStorage = {
  getItem(k) { return lsStore.has(k) ? lsStore.get(k) : null; },
  setItem(k, v) { lsStore.set(k, String(v)); },
  removeItem(k) { lsStore.delete(k); }
};

/* ---------- 按 index.html 顺序加载全部脚本 ---------- */
const files = [
  "src/data/cards.js",
  "src/data/spreads.js",
  "src/data/questions.js",
  "src/data/tips.js",
  "src/game/random.js",
  "src/game/draw.js",
  "src/game/interpretation.js",
  "src/config.backend.js",
  "src/backend/worker.js",
  "src/backend/adapter.js",
  "src/ui/starfield.js",
  "src/ui/sound.js",
  "src/ui/storage.js",
  "src/ui/cards-ui.js",
  "src/ui/share.js",
  "src/main.js"
];
for (const f of files) {
  await import(pathToFileURL(path.resolve(f)).href);
}

/* 冒烟测试桩：拦截 Worker 后端的 fetch（Node 无网络，用假响应代替） */
function stubJson(o) {
  return { ok: true, status: 200, json: async () => o };
}
globalThis.fetch = async function (url, opts) {
  const u = String(url);
  const method = (opts && opts.method) || "GET";
  const body = opts && opts.body ? JSON.parse(opts.body) : {};
  if (u.includes("/api/session")) return stubJson({ code: 0, device: "d_smoke", token: "smoke-token" });
  if (u.includes("/api/me")) return stubJson({ code: 1, message: "未登录" });
  if (u.includes("/api/history")) return stubJson(method === "POST" ? { code: 0 } : { code: 0, items: [] });
  if (u.includes("/api/wishes")) return stubJson(method === "POST" ? { code: 0, item: { id: "w1", text: body.text, keyword: "测试", lights: 0, mine: true } } : { code: 0, items: [] });
  if (u.includes("/api/lights")) return stubJson({ code: 0, lights: 1 });
  if (u.includes("/api/admin")) return stubJson({ code: 0, users: [], counts: { users: 0, readings: 0, wishes: 0, lights: 0 } });
  return stubJson({ code: 1, message: "not found" });
};

/* ---------- 断言工具 ---------- */
let failures = 0;
function check(cond, msg) {
  if (cond) console.log("  ✓ " + msg);
  else { failures++; console.error("  ✗ FAIL: " + msg); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 合成事件目标：closest(sel) 仅当 sel 命中时返回自身 */
function makeTarget(matchSel, attrs) {
  const t = {
    attributes: attrs || {},
    classList: makeClassList(),
    getAttribute(k) { return this.attributes[k] === undefined ? null : this.attributes[k]; },
    closest(sel) { return sel === matchSel ? this : null; }
  };
  return t;
}

function fire(element, target) {
  const ls = (element && element.listeners && element.listeners.click) || [];
  for (const fn of ls) fn({ target });
}

/* ---------- 第一阶段：boot 渲染 ---------- */
const home = elements.get("screen-home") || makeEl("screen-home");
const theme = elements.get("screen-theme") || makeEl("screen-theme");
const spread = elements.get("screen-spread") || makeEl("screen-spread");
const screens = elements.get("screens") || makeEl("screens");

check(home.innerHTML.includes("研途秘典"), "首页标题已渲染");
check(home.innerHTML.includes('id="btn-start"'), "首页「开始占卜」按钮已渲染");
check(home.innerHTML.includes("仅供娱乐"), "首页免责声明已渲染");
check(home.classList.contains("active"), "首页处于激活状态");
check((theme.innerHTML.match(/data-theme-id=/g) || []).length === 8, "主题页渲染 8 个主题");
check((spread.innerHTML.match(/data-spread-id=/g) || []).length === 3, "牌阵页渲染 3 种牌阵");
check(!screens.innerHTML.includes("命运之门暂时无法开启"), "boot 无致命错误");

const YTM = globalThis.YTM;
let svgOk = true;
for (const c of YTM.data.cards) {
  if (!YTM.ui.cards.cardFaceSVG(c, false).startsWith("<svg") ||
      !YTM.ui.cards.cardFaceSVG(c, true).includes("逆位") ||
      !YTM.ui.cards.cardFaceSVG(c, false).includes('href="assets/cards/' + c.id + '.jpg"')) svgOk = false;
}
check(svgOk, "22 张卡牌正/逆位 SVG 均可生成且嵌入插画引用");

/* ---------- 第二阶段：完整用户旅程 ---------- */
console.log("  · 模拟完整旅程");

fire(screens, makeTarget("#btn-start"));                       // 首页 → 身份门
await sleep(200);
check(elements.get("screen-gate").classList.contains("active"), "点击「开始占卜」进入身份门");
fire(screens, makeTarget("#btn-gate-anon"));                    // 身份门 → 主题页
await sleep(200);
check(theme.classList.contains("active"), "匿名进入 → 主题页");

fire(screens, makeTarget("[data-theme-id]", { "data-theme-id": "general" }));  // 选「保研总运」
await sleep(200);
const question = elements.get("screen-question");
check(question.classList.contains("active"), "选择主题后进入问题页");
check((question.innerHTML.match(/data-status=/g) || []).length === 6, "问题页渲染 6 个状态选项");
check(question.innerHTML.includes("q-text"), "问题页渲染自由输入框");

fire(screens, makeTarget("#btn-ritual"));                      // 进入占卜仪式 → 牌阵选择页
await sleep(200);
check(spread.classList.contains("active"), "点击「进入占卜仪式」进入牌阵页");

/* 牌阵页选五牌阵（默认选中），点击开始抽牌 */
fire(screens, makeTarget("#btn-deal"));
await sleep(250);
const draw = elements.get("screen-draw");
check(draw.classList.contains("active"), "点击「开始抽牌」进入抽牌页");
check(draw.innerHTML.includes('id="draw-spread"'), "抽牌页渲染牌阵容器");
check(draw.innerHTML.includes("spread--five"), "默认五牌阵进入抽牌页");
const cardCount = (draw.innerHTML.match(/class="spread-card"/g) || []).length;
check(cardCount === 5, "五牌阵渲染 5 张牌背（实际 " + cardCount + "）");

/* 依次翻开 5 张牌 */
for (let i = 0; i < 5; i++) {
  fire(draw, makeTarget(".spread-card", { "data-idx": String(i) }));
  await sleep(700);
}
const detail = elements.get("card-detail");
check(detail.innerHTML.includes("card-detail-head"), "翻牌后渲染逐牌解读面板");
check(detail.innerHTML.includes("card-detail-advice"), "解读面板包含行动建议块");
check(!elements.get("btn-result").hidden, "全部翻开后出现「查看完整解读」按钮");

fire(screens, makeTarget("#btn-result"));                      // 查看完整解读
await sleep(250);
const result = elements.get("screen-result");
check(result.classList.contains("active"), "进入结果页");
check(result.innerHTML.includes("研途关键词"), "结果页渲染关键词区");
check(result.innerHTML.includes("逐牌详解"), "结果页渲染逐牌详解区");
check((result.innerHTML.match(/class="percard"/g) || []).length === 5, "逐牌详解覆盖全部 5 张牌");
check(result.innerHTML.includes("保研画像"), "结果页渲染保研画像区");
check(result.innerHTML.includes("命运提示"), "结果页渲染命运提示区");
check(result.innerHTML.includes("给此刻的你"), "结果页渲染行动建议区");
check(result.innerHTML.includes("仅供娱乐"), "结果页渲染免责声明");
check((result.innerHTML.match(/summary-item/g) || []).length === 5, "牌阵摘要渲染 5 张牌");

/* 生成分享卡 */
fire(screens, makeTarget("#btn-share-open"));
await sleep(100);
const shareCanvas = elements.get("share-canvas");
check(shareCanvas.width === 1080 && shareCanvas.height === 1440, "分享卡 Canvas 为 1080×1440");
check(elements.get("modal-share").hidden === false, "分享弹窗已打开");

/* 再问一次：状态重置 */
fire(screens, makeTarget("#btn-again"));
await sleep(200);
check(theme.classList.contains("active"), "「再问一次」回到主题页");

/* ---------- 第三阶段：云端适配器 + 心事墙（fetch 已打桩） ---------- */
console.log("  · 云端适配器");
const B = YTM.backend.api;
check(B.mode() === "cloud" && B.isCloud(), "始终为云端模式（无单机模式）");
check(YTM.backend.impl.worker && YTM.backend.impl.worker.mode() === "cloud", "Cloudflare Worker 适配器已加载");
check(YTM.backend.impl.local === undefined, "单机适配器已移除");
check(B.user() === null, "初始无账号");
const demoState = await B.loginState();
check(demoState === null, "未登录时登录状态为 null");
check(typeof B.isAdmin === "function" && B.isAdmin() === false, "非管理员 isAdmin=false");
check(typeof B.adminStats === "function", "管理接口存在（云端校验）");
const wishes = await B.listWishes();
check(Array.isArray(wishes) && wishes.length === 0, "心事墙读取（空列表）");
const posted = await B.postWish("冒烟测试心事", "测试");
check(posted && posted.mine === true, "发帖成功（桩）");
await B.lightWish("w1");
fire(elements.get("btn-wish"), makeTarget("none"));
await sleep(30);
const wishBody = elements.get("wish-body");
check(wishBody.innerHTML.includes("心事墙还空着") || wishBody.innerHTML.includes("wish-item"), "心事墙界面正常渲染（无演示横幅）");
check(!wishBody.innerHTML.includes("演示模式"), "不再出现「演示模式」提示");
fire(elements.get("btn-history"), makeTarget("none"));
await sleep(20);
check(elements.get("history-actions").innerHTML.includes("登录 / 云同步"), "命运簿含登录/云同步入口");

/* ---------- 第四阶段：身份选择门 ---------- */
console.log("  · 身份选择门");
YTM.backend.impl.worker.loginState = () => Promise.resolve(null);
fire(screens, makeTarget("#btn-start"));
await sleep(250);
const gate = elements.get("screen-gate");
check(gate.classList.contains("active"), "开始占卜 → 身份选择门");
check(gate.innerHTML.includes("研途之门前"), "身份门标题渲染");
check(gate.innerHTML.includes("匿名进入研途"), "身份门含「匿名进入」");
check(gate.innerHTML.includes("账号密码登录"), "身份门含「账号密码登录」");
check(gate.innerHTML.includes("gate-name") && gate.innerHTML.includes("gate-pass"), "身份门含登录表单");
check(gate.innerHTML.includes("pass-toggle"), "密码框含「显示/隐藏密码」切换");
fire(screens, makeTarget("#btn-gate-anon"));
await sleep(250);
check(theme.classList.contains("active"), "匿名进入 → 主题页");

console.log(failures === 0 ? "\n端到端冒烟测试通过 ✔" : "\n端到端冒烟测试存在失败 ✗");
process.exit(failures === 0 ? 0 : 1);
