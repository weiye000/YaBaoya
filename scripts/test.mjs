/**
 * 研途秘典 · 逻辑层自动化测试（Node）
 * 运行：node scripts/test.mjs
 * 覆盖：数据完整性 / 随机系统 / 抽牌 / 解读引擎（全部主题 × 牌阵组合）
 */
import { pathToFileURL } from "node:url";
import path from "node:path";

async function load(rel) {
  await import(pathToFileURL(path.resolve(rel)).href);
}

await load("src/data/cards.js");
await load("src/data/spreads.js");
await load("src/data/questions.js");
await load("src/data/tips.js");
await load("src/game/random.js");
await load("src/game/draw.js");
await load("src/game/interpretation.js");

const YTM = globalThis.YTM;

let passes = 0;
let failures = 0;
function assert(cond, msg) {
  if (cond) { passes++; }
  else { failures++; console.error("  ✗ FAIL:", msg); }
}
function section(title) { console.log("\n· " + title); }

/* ---------- 1. 卡牌数据 ---------- */
section("卡牌数据完整性");
const cards = YTM.data.cards;
assert(cards.length === 22, `卡牌应为 22 张，实际 ${cards.length}`);
const ids = new Set();
const HEX = /^#[0-9a-fA-F]{6}$/;
for (const c of cards) {
  assert(!ids.has(c.id), `卡牌 id 重复: ${c.id}`);
  ids.add(c.id);
  assert(c.no !== undefined && c.no !== null, `卡牌 ${c.id} 缺少编号`);
  assert(typeof c.name === "string" && c.name.length > 0, `卡牌 ${c.id} 缺少名称`);
  assert(typeof c.en === "string" && c.en.length > 0, `卡牌 ${c.id} 缺少英文名`);
  assert(Array.isArray(c.palette) && c.palette.length === 2 && c.palette.every((p) => HEX.test(p)), `卡牌 ${c.id} 配色非法`);
  assert(c.keyword.u && c.keyword.r, `卡牌 ${c.id} 缺少正/逆位关键词`);
  for (const o of ["u", "r"]) {
    assert(c.meaning[o].core, `卡牌 ${c.id} ${o} 缺少 core`);
    assert(Array.isArray(c.meaning[o].light) && c.meaning[o].light.length >= 2, `卡牌 ${c.id} ${o} light 不足 2 条`);
    assert(Array.isArray(c.meaning[o].shadow) && c.meaning[o].shadow.length >= 2, `卡牌 ${c.id} ${o} shadow 不足 2 条`);
  }
  assert(c.general && c.general.length > 10, `卡牌 ${c.id} 缺少 general 语境`);
  for (const k of ["school", "research", "mentor", "camp", "obstacle"]) {
    assert(c.context[k] && c.context[k].length > 5, `卡牌 ${c.id} 缺少 context.${k}`);
  }
  assert(c.advice.u && c.advice.r, `卡牌 ${c.id} 缺少建议`);
  assert(c.tags.schoolStyle && c.tags.mentorType && Array.isArray(c.tags.obstacle) && c.tags.ability, `卡牌 ${c.id} tags 不完整`);
}
console.log(`  ✓ ${cards.length} 张卡牌字段完整`);

/* ---------- 2. 牌阵 / 主题 / 提示池 ---------- */
section("牌阵 / 主题 / 提示池");
const spreads = YTM.data.spreads;
assert(spreads.length === 3, "应有 3 种牌阵");
const ROLE_SET = new Set(["strength", "weakness", "chance", "block", "revelation", "past", "present", "future"]);
for (const s of spreads) {
  assert(s.count === s.positions.length, `牌阵 ${s.id} 卡牌数与位置数不一致`);
  assert([1, 3, 5].includes(s.count), `牌阵 ${s.id} 卡牌数异常`);
  for (const pos of s.positions) {
    assert(ROLE_SET.has(pos.role), `牌阵 ${s.id} 位置「${pos.label}」缺少合法 role`);
  }
}
const questions = YTM.data.questions;
assert(questions.length === 8, "应有 8 个主题");
assert(new Set(questions.map((q) => q.id)).size === 8, "主题 id 重复");
const tips = YTM.data.tips;
assert(tips.length >= 40, `提示池应 ≥40 条，实际 ${tips.length}`);
for (const q of questions) {
  const has = tips.some((t) => t.themes.includes(q.id) || t.themes.length === 0);
  assert(has, `主题 ${q.id} 没有任何可用提示（专属或通用）`);
}
console.log(`  ✓ ${spreads.length} 牌阵 / ${questions.length} 主题 / ${tips.length} 条提示`);

/* ---------- 3. 随机系统 ---------- */
section("随机系统（1000 次抽牌）");
let revCount = 0, total = 0, dupFail = 0;
for (let i = 0; i < 1000; i++) {
  const drawn = YTM.game.random.drawCards(5);
  total += 5;
  revCount += drawn.filter((d) => d.reversed).length;
  const seen = new Set(drawn.map((d) => d.card.id));
  if (seen.size !== 5) dupFail++;
  assert(seen.size === 5, "同一牌阵出现重复卡牌");
}
assert(dupFail === 0, `重复抽牌发生 ${dupFail} 次`);
const ratio = revCount / total;
assert(ratio > 0.25 && ratio < 0.55, `正逆位比例异常: ${(ratio * 100).toFixed(1)}%`);
console.log(`  ✓ 无重复抽牌；逆位比例 ${(ratio * 100).toFixed(1)}%（目标约 40%）`);

/* ---------- 4. 抽牌组装 ---------- */
section("抽牌组装 createReading");
for (const s of spreads) {
  for (const q of questions) {
    const r = YTM.game.createReading({ spreadId: s.id, themeId: q.id, status: "大三下", question: "  能不能保研？  " });
    assert(r.cards.length === s.count, `${s.id}/${q.id} 卡牌数错误`);
    assert(r.question === "能不能保研？", `${s.id}/${q.id} 问题未正确 trim`);
    assert(r.status === "大三下", `${s.id}/${q.id} 状态丢失`);
    for (let i = 0; i < r.cards.length; i++) {
      assert(r.cards[i].position === s.positions[i], `${s.id}/${q.id} 位置映射错误`);
    }
  }
}
const longQ = "长".repeat(300);
const rLong = YTM.game.createReading({ spreadId: "one", themeId: "general", question: longQ });
assert(rLong.question.length === 140, `问题未截断到 140 字（实际 ${rLong.question.length}）`);
const rEmpty = YTM.game.createReading({ spreadId: "one", themeId: "general", question: "   " });
assert(rEmpty.question === null, "空问题应为 null");
console.log("  ✓ 全部主题 × 牌阵组合、截断与空输入正常");

/* ---------- 5. 解读引擎 ---------- */
section("解读引擎 buildResult（全部主题 × 牌阵 × 20 种子）");
for (const s of spreads) {
  for (const q of questions) {
    for (let seed = 1; seed <= 20; seed++) {
      const reading = YTM.game.createReading({ spreadId: s.id, themeId: q.id, seed });
      const r = YTM.game.buildResult(reading);
      assert(r.keyword.word && r.keyword.word.length >= 1, `${s.id}/${q.id}#${seed} 关键词为空`);
      assert(r.keyword.line && r.keyword.line.length > 5, `${s.id}/${q.id}#${seed} 关键词释义为空`);
      assert(r.spreadSummary.length === s.count, `${s.id}/${q.id}#${seed} 摘要数量错误`);
      assert(r.portrait.length >= 2, `${s.id}/${q.id}#${seed} 画像段落不足`);
      for (const p of r.portrait) assert(typeof p === "string" && p.length > 5, `${s.id}/${q.id}#${seed} 画像段落过短`);
      assert(r.tips.length >= 3 && r.tips.length <= 4, `${s.id}/${q.id}#${seed} 提示条数 ${r.tips.length} 异常`);
      assert(r.advice && r.advice.length > 3, `${s.id}/${q.id}#${seed} 行动建议为空`);
      assert(r.perCard.length === s.count, `${s.id}/${q.id}#${seed} 逐牌解读数量错误`);
      for (const pc of r.perCard) {
        assert(pc.core && pc.contextText && pc.lines.length >= 2 && pc.adviceText, `${s.id}/${q.id}#${seed} 逐牌字段缺失`);
        assert(pc.lead && pc.lead.length > 5, `${s.id}/${q.id}#${seed} 「${pc.name}」缺少位置开场白`);
        /* 位置角色 × 卡牌池 严格一致：短板/阻碍位必须取 shadow，其余取 light */
        const entry = reading.cards.find((e) => e.card.name === pc.name && e.position.label === pc.label);
        const m = entry.card.meaning[entry.reversed ? "r" : "u"];
        const expected = pc.role === "weakness" || pc.role === "block" ? m.shadow : m.light;
        assert(JSON.stringify(pc.lines) === JSON.stringify(expected),
          `${s.id}/${q.id}#${seed} 「${pc.name}」${pc.label}位 的要点与位置角色不一致`);
      }
      /* 画像必须明确呼应牌阵中的关键位置（以五牌总运为例：优势位与阻碍位都要点名） */
      if (s.id === "five" && q.id === "general") {
        const joined = r.portrait.join("");
        assert(joined.includes(reading.cards[0].card.name) && joined.includes(reading.cards[3].card.name),
          `${s.id}/${q.id}#${seed} 总运画像未同时呼应优势位与阻碍位卡牌`);
      }
      /* 阻碍主题：画像首段的阻碍词必须来自本局卡牌的真实标签 */
      if (q.id === "obstacle") {
        const tags = new Set(reading.cards.flatMap((e) => e.card.tags.obstacle || []));
        const hit = [...tags].some((w) => r.portrait[0].includes(w));
        assert(hit, `${s.id}/${q.id}#${seed} 阻碍画像未命中任何本局卡牌的阻碍标签`);
      }
      assert(r.finalCard.id && r.finalCard.name && r.finalCard.palette, `${s.id}/${q.id}#${seed} 最终牌信息缺失`);
      assert(r.disclaimer.includes("仅供娱乐"), `${s.id}/${q.id}#${seed} 缺少免责声明`);
      /* 禁止出现概率/承诺类表述与标点堆叠 */
      const full = JSON.stringify(r);
      assert(!/[0-9]+%|百分之|一定能|保证|铁定/.test(full), `${s.id}/${q.id}#${seed} 出现概率/承诺类表述`);
      assert(!/。{2}|？。|！。/.test(full), `${s.id}/${q.id}#${seed} 出现标点堆叠（。。/？。）`);
    }
  }
}
console.log("  ✓ 24 种组合 × 20 种子 = 480 次解读全部有效，且无概率/承诺表述");

/* ---------- 6. 用户输入呼应（问题 / 阶段） ---------- */
section("用户问题与阶段呼应");
const rQ = YTM.game.createReading({ spreadId: "one", themeId: "general", question: "我能保研吗？", status: "大三上" });
const resQ = YTM.game.buildResult(rQ);
assert(resQ.portrait[0].includes("我能保研吗？"), "画像首段应回应用户的问题");
assert(resQ.portrait.join("").includes("大三上"), "画像收尾应呼应用户所选阶段");
console.log("  ✓ 问题与阶段均被解读文案呼应");

/* ---------- 7. 确定性 ---------- */
section("同种子可复现");
const a = YTM.game.createReading({ spreadId: "five", themeId: "general", seed: 42 });
const b = YTM.game.createReading({ spreadId: "five", themeId: "general", seed: 42 });
const ra = YTM.game.buildResult(a), rb = YTM.game.buildResult(b);
assert(JSON.stringify(ra) === JSON.stringify(rb), "同种子结果不一致");
console.log("  ✓ 同种子 → 同结果（命运簿复盘可用）");

/* ---------- 7. 障碍主题覆盖池 ---------- */
section("障碍词池覆盖");
const pool = ["拖延", "信息差", "过度焦虑", "选择困难", "简历不足", "科研不足", "沟通不足", "目标分散"];
const used = new Set();
for (const c of cards) for (const o of c.tags.obstacle) used.add(o);
const missing = pool.filter((p) => !used.has(p));
assert(missing.length === 0, `障碍池未被任何卡牌引用: ${missing.join("、")}`);
console.log(`  ✓ 障碍池 8 类全部被卡牌引用`);

/* ---------- 汇总 ---------- */
console.log(`\n────────────────────────`);
console.log(`通过 ${passes} 项，失败 ${failures} 项`);
if (failures > 0) {
  console.error("存在失败项，请修复后再交付。");
  process.exit(1);
} else {
  console.log("全部测试通过 ✔");
}
