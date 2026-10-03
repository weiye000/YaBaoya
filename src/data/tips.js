/* ============================================================
   研途秘典 · 命运提示池
   themes 为空数组表示通用提示，任何主题都可能抽中；
   指定主题 id 则只在对应主题下出现。
   ============================================================ */
(function (global) {
  "use strict";
  var YTM = global.YTM = global.YTM || {};
  YTM.data = YTM.data || {};

  YTM.data.tips = [
    /* ---- 通用 ---- */
    { text: "不要因为一次拒绝，重新定义自己的能力。", themes: [] },
    { text: "命运给的从来不是答案，而是一种解释。", themes: [] },
    { text: "焦虑的反面不是放松，而是具体。", themes: [] },
    { text: "真正重要的不是「去哪」，而是「为什么去」。", themes: [] },
    { text: "信息很多的时候，少看一点反而更清醒。", themes: [] },
    { text: "你不需要抓住每一个机会，只需要抓住对的那一个。", themes: [] },
    { text: "把「我能不能」换成「我如何」，问题会小一半。", themes: [] },
    { text: "你的节奏，不需要和任何人保持一致。", themes: [] },
    { text: "先完成，再完美；保研这条路尤其如此。", themes: [] },
    { text: "纠结很久的事，往往缺的不是信息，而是取舍的勇气。", themes: [] },
    { text: "别人的结果单，不该是你衡量自己的尺子。", themes: [] },
    { text: "迷茫不是路消失了，而是你看得太远。", themes: [] },
    { text: "停下来整理一次材料，胜过焦虑三晚。", themes: [] },
    { text: "有些机会，是留给「还在场的人」的。", themes: [] },

    /* ---- school 学校选择 ---- */
    { text: "冲刺型不是赌博，前提是你清楚自己押上的是什么。", themes: ["school"] },
    { text: "稳妥不是将就，而是把确定性攥在自己手里。", themes: ["school"] },
    { text: "与研究方向匹配的环境，比排名更值得多看两眼。", themes: ["school"] },
    { text: "地域会影响三年的生活节奏，别把它当小事。", themes: ["school"] },
    { text: "学校的名气写在别人的嘴上，平台写在你自己的简历里。", themes: ["school"] },
    { text: "别用「别人去了哪」，来倒推自己该去哪。", themes: ["school"] },

    /* ---- research 科研运 ---- */
    { text: "论文的起点不是灵感，是坐下来写的第一个小时。", themes: ["research"] },
    { text: "一段扎实的科研经历，胜过十段浅尝辄止。", themes: ["research"] },
    { text: "看不懂的文献，读第二遍时往往就懂了一半。", themes: ["research"] },
    { text: "坚持不是每天都前进，而是停了之后还能再开始。", themes: ["research"] },
    { text: "主动问一次，比自己在原地猜十天有用。", themes: ["research"] },

    /* ---- camp 夏令营 / 预推免 ---- */
    { text: "面试里，真诚的「不知道」好过慌张的「都懂」。", themes: ["camp"] },
    { text: "简历写得好，不是写得多，而是删得准。", themes: ["camp"] },
    { text: "夏令营的本质是双向选择，你也有一半的牌。", themes: ["camp"] },
    { text: "临场发挥差一点没关系，准备可以补上大半。", themes: ["camp"] },
    { text: "被拒，和你不合适，是两件不同的事。", themes: ["camp"] },

    /* ---- mentor 导师缘 ---- */
    { text: "好的师生关系，一半靠缘分，一半靠主动沟通。", themes: ["mentor"] },
    { text: "选导师不只是选方向，也是选一种工作方式。", themes: ["mentor"] },
    { text: "主动汇报进度的人，运气都不会太差。", themes: ["mentor"] },
    { text: "先弄清老师最近在做什么，再开口谈你想做什么。", themes: ["mentor"] },
    { text: "独立不是不求助，而是求助前先自己试过。", themes: ["mentor"] },

    /* ---- obstacle 最大阻碍 ---- */
    { text: "拖延常常不是懒，是害怕做得不够好。", themes: ["obstacle"] },
    { text: "信息差不可怕，可怕的是以为自己掌握了全部信息。", themes: ["obstacle"] },
    { text: "目标太多等于没有目标，先锁死一个。", themes: ["obstacle"] },
    { text: "焦虑是迷雾，行动是手电筒。", themes: ["obstacle"] },
    { text: "把大目标切成今天能做完的一小步。", themes: ["obstacle"] },

    /* ---- competition 竞争力 ---- */
    { text: "竞争力不是一张总分表，而是一张组合牌。", themes: ["competition"] },
    { text: "硬实力决定下限，信息和判断决定上限。", themes: ["competition"] },
    { text: "被低估的往往不是实力，而是展示实力的方式。", themes: ["competition"] },
    { text: "简历里缺的从来不是经历，而是「所以呢」。", themes: ["competition"] },

    /* ---- keyword 年度关键词 ---- */
    { text: "关键词不是预言，是你接下来一年的路标。", themes: ["keyword"] },
    { text: "把关键词写下来，贴在每天能看到的地方。", themes: ["keyword"] },
    { text: "一年只做好一件事，就已经很难得。", themes: ["keyword"] }
  ];
})(typeof window !== "undefined" ? window : globalThis);
