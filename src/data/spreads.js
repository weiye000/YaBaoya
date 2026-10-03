/* ============================================================
   研途秘典 · 牌阵数据
   修改牌阵：直接编辑本文件；详见 README「如何增加新的牌阵」
   ============================================================ */
(function (global) {
  "use strict";
  var YTM = global.YTM = global.YTM || {};
  YTM.data = YTM.data || {};

  YTM.data.spreads = [
    {
      id: "one",
      name: "单牌占卜",
      alias: "今日研途启示",
      count: 1,
      desc: "只问一件事，只看一张牌。适合第一次踏入研途秘典的人。",
      positions: [
        { label: "今日启示", desc: "此刻最值得你听见的一句话", role: "revelation" }
      ]
    },
    {
      id: "three",
      name: "三牌阵",
      alias: "过去 · 现在 · 未来",
      count: 3,
      desc: "看看你如何走到今天，又将沿着哪条路继续向前。",
      positions: [
        { label: "过去", desc: "你是如何走到今天的", role: "past" },
        { label: "现在", desc: "你目前的状态", role: "present" },
        { label: "未来", desc: "接下来可能出现的趋势", role: "future" }
      ]
    },
    {
      id: "five",
      name: "保研命运阵",
      alias: "核心牌阵",
      count: 5,
      desc: "五张牌，五重天机：优势、短板、机会、阻碍，与最终的启示。",
      positions: [
        { label: "我的优势", desc: "你身上最值得被看见的部分", role: "strength" },
        { label: "我的短板", desc: "需要留意的暗面", role: "weakness" },
        { label: "外部机会", desc: "可能出现的转机", role: "chance" },
        { label: "最大阻碍", desc: "最需要跨过去的那道坎", role: "block" },
        { label: "最终启示", desc: "命运留给你的那句话", role: "revelation" }
      ]
    }
  ];
})(typeof window !== "undefined" ? window : globalThis);
