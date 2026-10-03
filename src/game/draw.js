/* ============================================================
   研途秘典 · 抽牌系统
   组装一次完整的占卜：牌阵 + 主题 + 用户状态/问题 + 随机抽牌。
   纯函数、无 DOM，可在 Node 中测试。
   ============================================================ */
(function (global) {
  "use strict";
  var YTM = global.YTM = global.YTM || {};
  YTM.game = YTM.game || {};

  var QUESTION_MAX = 140;

  function createReading(opts) {
    opts = opts || {};
    var spread = YTM.data.getSpread(opts.spreadId);
    if (!spread) throw new Error("未知牌阵: " + opts.spreadId);
    var theme = YTM.data.getQuestion(opts.themeId);
    if (!theme) throw new Error("未知主题: " + opts.themeId);

    var seed = opts.seed != null ? (opts.seed >>> 0) : YTM.game.random.newSeed();
    var rng = opts.rng || YTM.game.random.mulberry32(seed);

    var drawn = YTM.game.random.drawCards(spread.count, rng);
    var cards = drawn.map(function (d, i) {
      return {
        card: d.card,
        reversed: d.reversed,
        positionIndex: i,
        position: spread.positions[i]
      };
    });

    var question = opts.question == null ? "" : String(opts.question);
    question = question.trim().slice(0, QUESTION_MAX);

    return {
      seed: seed,
      ts: Date.now(),
      spread: spread,
      theme: theme,
      status: opts.status || null,
      question: question || null,
      cards: cards
    };
  }

  YTM.game.createReading = createReading;
})(typeof window !== "undefined" ? window : globalThis);
