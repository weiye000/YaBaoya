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
  body: makeEl("body")
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
globalThis.localStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {}
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
      !YTM.ui.cards.cardFaceSVG(c, true).includes("逆位")) svgOk = false;
}
check(svgOk, "22 张卡牌正/逆位 SVG 均可生成");

/* ---------- 第二阶段：完整用户旅程 ---------- */
console.log("  · 模拟完整旅程");

fire(screens, makeTarget("#btn-start"));                       // 首页 → 主题页
await sleep(200);
check(theme.classList.contains("active"), "点击「开始占卜」进入主题页");

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

console.log(failures === 0 ? "\n端到端冒烟测试通过 ✔" : "\n端到端冒烟测试存在失败 ✗");
process.exit(failures === 0 ? 0 : 1);
