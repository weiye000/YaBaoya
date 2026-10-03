/* ============================================================
   研途秘典 · 占卜主题数据
   修改主题：直接编辑本文件；详见 README「如何增加新的问题类型」
   ============================================================ */
(function (global) {
  "use strict";
  var YTM = global.YTM = global.YTM || {};
  YTM.data = YTM.data || {};

  YTM.data.questions = [
    {
      id: "general",
      title: "保研总运",
      glyph: "✦",
      sample: "我的保研之路会怎样？",
      desc: "综览全局：状态、优势、阻碍与启示"
    },
    {
      id: "school",
      title: "学校选择",
      glyph: "◇",
      sample: "什么类型的学校更适合我？",
      desc: "冲刺、稳妥还是匹配：看清你的择校倾向"
    },
    {
      id: "research",
      title: "科研运",
      glyph: "✶",
      sample: "我的科研运势怎么样？",
      desc: "论文、项目与坚持：你的学术探索方向"
    },
    {
      id: "camp",
      title: "夏令营 · 预推免",
      glyph: "❂",
      sample: "我的夏令营 / 预推免运势怎么样？",
      desc: "简历、面试与临场：把握机会窗口"
    },
    {
      id: "mentor",
      title: "导师缘",
      glyph: "✵",
      sample: "我和导师的缘分怎么样？",
      desc: "导师类型、相处模式与方向匹配"
    },
    {
      id: "obstacle",
      title: "最大阻碍",
      glyph: "⋆",
      sample: "是什么在阻碍我？",
      desc: "直面那个你一直绕开的卡点"
    },
    {
      id: "competition",
      title: "竞争力",
      glyph: "❖",
      sample: "我的保研竞争力如何？",
      desc: "硬实力、软实力与心态的全景镜"
    },
    {
      id: "keyword",
      title: "年度关键词",
      glyph: "✧",
      sample: "今年我的保研关键词是什么？",
      desc: "一年之题，浓缩为一个字词"
    }
  ];

  /* 用户当前阶段选项（可多选其一，也可跳过） */
  YTM.data.statusOptions = [
    "大三上",
    "大三下",
    "暑期",
    "预推免阶段",
    "已经拿到 offer",
    "正在纠结选择"
  ];
})(typeof window !== "undefined" ? window : globalThis);
