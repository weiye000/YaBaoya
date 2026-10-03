/**
 * 文案抽查：打印指定组合的完整解读，供人工审读
 * 运行：node scripts/inspect_reading.mjs
 */
import { pathToFileURL } from "node:url";
import path from "node:path";

for (const f of ["src/data/cards.js", "src/data/spreads.js", "src/data/questions.js", "src/data/tips.js",
  "src/game/random.js", "src/game/draw.js", "src/game/interpretation.js"]) {
  await import(pathToFileURL(path.resolve(f)).href);
}
const YTM = globalThis.YTM;

const cases = [
  { spread: "five", theme: "general", seed: 7 },
  { spread: "five", theme: "general", seed: 19 },
  { spread: "five", theme: "school", seed: 42 },
  { spread: "three", theme: "general", seed: 3 },
  { spread: "one", theme: "keyword", seed: 5 },
  { spread: "five", theme: "obstacle", seed: 11 },
  { spread: "five", theme: "mentor", seed: 23 },
  { spread: "five", theme: "camp", seed: 31 }
];

for (const cs of cases) {
  const reading = YTM.game.createReading({
    spreadId: cs.spread, themeId: cs.theme, seed: cs.seed,
    question: "我到底能不能保研？", status: "大三下"
  });
  const r = YTM.game.buildResult(reading);
  console.log("\n════════════════════════════════════════════");
  console.log("【" + r.themeTitle + " · " + r.spreadName + "】 seed=" + cs.seed);
  console.log("抽牌: " + reading.cards.map((e) => `${e.position.label}→${e.card.name}(${e.reversed ? "逆" : "正"})`).join(" | "));
  console.log("关键词: " + r.keyword.word + " —— " + r.keyword.line);
  console.log("\n· 保研画像：");
  r.portrait.forEach((p) => console.log("  " + p));
  console.log("\n· 逐牌详解：");
  r.perCard.forEach((pc) => {
    console.log("  ——[" + pc.label + "] " + pc.name + "·" + pc.orientationLabel);
    console.log("    开场: " + pc.lead);
    console.log("    要义: " + pc.core);
    console.log("    语境: " + pc.contextText);
    pc.lines.forEach((l) => console.log("    要点: " + l));
    console.log("    建议: " + pc.adviceText);
  });
  console.log("\n· 命运提示: " + r.tips.join(" / "));
  console.log("· 行动建议: " + r.advice);
}
