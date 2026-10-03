/* ============================================================
   研途秘典 · 随机系统
   Fisher-Yates 洗牌 + 无放回抽取 + 正逆位随机（约 60/40）。
   随机只决定游戏叙事，不构成任何现实预测。
   ============================================================ */
(function (global) {
  "use strict";
  var YTM = global.YTM = global.YTM || {};
  YTM.game = YTM.game || {};

  /* 可复现的伪随机数生成器（用于测试与占卜复盘） */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 洗牌（返回新数组，不修改原数组） */
  function shuffle(arr, rng) {
    var a = arr.slice();
    var r = rng || Math.random;
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function pick(arr, rng) {
    var r = rng || Math.random;
    return arr[Math.floor(r() * arr.length)];
  }

  /* 从卡池无放回抽取 count 张，返回 [{card, reversed}] */
  function drawCards(count, rng) {
    var r = rng || Math.random;
    var cards = YTM.data.cards;
    if (!cards || cards.length < count) {
      throw new Error("卡池不足：需要 " + count + " 张，卡池共 " + (cards ? cards.length : 0) + " 张");
    }
    return shuffle(cards, r).slice(0, count).map(function (card) {
      return { card: card, reversed: r() < 0.4 };
    });
  }

  /* 生成一次占卜的随机种子（用于命运簿记录，便于复盘） */
  function newSeed() {
    return (Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0;
  }

  YTM.game.random = {
    mulberry32: mulberry32,
    shuffle: shuffle,
    pick: pick,
    drawCards: drawCards,
    newSeed: newSeed
  };
})(typeof window !== "undefined" ? window : globalThis);
