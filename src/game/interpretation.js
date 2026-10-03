/* ============================================================
   研途秘典 · 结果生成引擎
   输入：一次 reading（见 draw.js）
   输出：结构化解读结果（关键词 / 牌阵摘要 / 保研画像 / 命运提示 / 行动建议）
   纯函数、无 DOM，可在 Node 中测试。
   所有文本均为游戏叙事，不构成任何现实预测。
   ============================================================ */
(function (global) {
  "use strict";
  var YTM = global.YTM = global.YTM || {};
  YTM.game = YTM.game || {};

  /* 主题 → 卡牌语境字段 */
  var CONTEXT_KEY = {
    school: "school",
    research: "research",
    mentor: "mentor",
    camp: "camp",
    obstacle: "obstacle",
    general: "general",
    competition: "general",
    keyword: "general"
  };

  /* 牌阵位置 → 角色（决定取 light 还是 shadow） */
  var ROLES = {
    five: ["strength", "weakness", "chance", "block", "revelation"],
    three: ["past", "present", "future"],
    one: ["revelation"]
  };

  var SHADOW_ROLES = { weakness: true, block: true };

  function orient(entry) { return entry.reversed ? "r" : "u"; }
  function meaningOf(entry, key) {
    var m = entry.card.meaning[orient(entry)];
    return key ? m[key] : m;
  }

  function uniq(arr) {
    var seen = {}, out = [];
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i];
      if (!seen[v]) { seen[v] = true; out.push(v); }
    }
    return out;
  }

  function keywordLine(themeId, word) {
    var lines = {
      general: "把「" + word + "」二字放在心上，你的路会自己清晰起来。",
      school: "择校这件事，答案藏在「" + word + "」里。",
      research: "接下来一年，请围绕「" + word + "」二字安排你的精力。",
      camp: "这一程的关键，是「" + word + "」。",
      mentor: "你的导师缘，绕不开「" + word + "」二字。",
      obstacle: "你的通关密码，叫「" + word + "」。",
      competition: "你的竞争力关键词，落在「" + word + "」上。",
      keyword: "今年，请把「" + word + "」写进日程表的第一行。"
    };
    return lines[themeId] || lines.general;
  }

  function contextTextOf(entry, themeId) {
    var key = CONTEXT_KEY[themeId];
    if (key && key !== "general" && entry.card.context && entry.card.context[key]) {
      return entry.card.context[key];
    }
    return entry.card.general;
  }

  /* ---------------- 逐牌解读 ---------------- */

  function buildPerCard(reading) {
    var roles = ROLES[reading.spread.id] || [];
    return reading.cards.map(function (entry, i) {
      var role = roles[i] || "revelation";
      var m = meaningOf(entry);
      var lines = SHADOW_ROLES[role] ? m.shadow : m.light;
      return {
        label: entry.position.label,
        desc: entry.position.desc,
        name: entry.card.name,
        en: entry.card.en,
        reversed: entry.reversed,
        orientationLabel: entry.reversed ? "逆位" : "正位",
        keywordWord: entry.card.keyword[orient(entry)],
        core: m.core,
        contextText: contextTextOf(entry, reading.theme.id),
        lines: lines,
        adviceText: entry.card.advice[orient(entry)]
      };
    });
  }

  /* ---------------- 牌阵摘要 ---------------- */

  function buildSummary(reading) {
    return reading.cards.map(function (entry) {
      return {
        label: entry.position.label,
        name: entry.card.name,
        reversed: entry.reversed,
        keywordWord: entry.card.keyword[orient(entry)]
      };
    });
  }

  /* ---------------- 保研画像（按主题组装段落） ---------------- */

  function buildPortrait(reading) {
    var t = reading.theme.id;
    var c = reading.cards;
    var c0 = c[0], c1 = c[1] || c0, cLast = c[c.length - 1];
    var spread = reading.spread.id;
    var p = [];

    if (t === "general") {
      if (spread === "five") {
        p.push("你的底牌是「" + c0.card.name + "」——" + meaningOf(c0).light[0] + "。");
        p.push("而「" + c[3].card.name + "」落在「最大阻碍」的位置：它提醒你留意——" + meaningOf(c[3]).shadow[0] + "。");
        p.push("机会藏在「" + c[2].card.name + "」这一格：" + meaningOf(c[2]).light[0] + "。");
        p.push("最终的启示由「" + cLast.card.name + "」给出：" + meaningOf(cLast).core);
      } else if (spread === "three") {
        p.push("你之所以走到今天，「" + c0.card.name + "」给出了解释：" + meaningOf(c0).core);
        p.push("此刻的你与「" + c1.card.name + "」同频——" + meaningOf(c1).core);
        p.push("接下来的趋势，写在「" + cLast.card.name + "」里：" + meaningOf(cLast).core + "趋势不等于结果，方向盘还在你手里。");
      } else {
        p.push("「" + c0.card.name + "」落在了你的今日启示位：" + meaningOf(c0).core);
        p.push(contextTextOf(c0, t));
      }
      p.push("保研这条路，与其问「结果如何」，不如问「我如何把下一步走好」。");
    }

    else if (t === "school") {
      var styles = uniq(c.map(function (e) { return e.card.tags.schoolStyle; })).slice(0, 2);
      p.push("从牌面看，你的选择倾向更像「" + styles.join(" × ") + "」。");
      p.push("「" + c0.card.name + "」在择校语境下的提示：你更容易在与你当前研究方向高度匹配的环境中获得机会——" + c0.card.context.school);
      if (c.length > 1 && cLast !== c0) {
        p.push("而「" + cLast.card.name + "」提醒你：" + cLast.card.context.school);
      }
      p.push("与其不断寻找「最好的选择」，不如先明确什么样的研究方向适合你。");
    }

    else if (t === "research") {
      p.push("你的科研潜力，藏在「" + c0.card.name + "」里：" + meaningOf(c0).light[0] + "。");
      p.push("论文与项目层面：「" + c0.card.name + "」给出的信号是——" + c0.card.context.research);
      p.push("坚持程度由「" + cLast.card.name + "」暗示：" + meaningOf(cLast).core);
      p.push("学术探索的方向，往往不是选出来的，而是做出来的。");
    }

    else if (t === "camp") {
      p.push("简历与材料：「" + c0.card.name + "」提示——" + c0.card.context.camp);
      if (c.length > 1) {
        p.push("面试与沟通：「" + c1.card.name + "」提示——" + c1.card.context.camp);
      }
      p.push("临场状态由「" + cLast.card.name + "」书写：" + meaningOf(cLast).core);
      p.push("机会窗口，永远给有准备的人留着。");
    }

    else if (t === "mentor") {
      var types = uniq(c.map(function (e) { return e.card.tags.mentorType; })).slice(0, 2);
      p.push("你容易遇到的导师类型，偏向「" + types.join("与") + "」——这是「" + c0.card.name + "」所示。");
      p.push("相处模式上：「" + c0.card.name + "」提醒你——" + c0.card.context.mentor);
      if (cLast !== c0) {
        p.push("方向匹配：「" + cLast.card.name + "」给出的线索——" + cLast.card.context.mentor);
      }
      p.push("好的师生关系，一半靠缘分，一半靠经营。");
    }

    else if (t === "obstacle") {
      var obs = uniq(c.reduce(function (acc, e) {
        return acc.concat(e.card.tags.obstacle || []);
      }, []));
      if (!obs.length) obs = ["拖延"];
      p.push("牌面指出，最值得警惕的阻碍是：" + obs.slice(0, 3).join("、") + "。");
      p.push("「" + c0.card.name + "」说得更直白：" + c0.card.context.obstacle);
      var other = c.length > 1 ? c1 : c0;
      p.push("但阻碍的反面藏着解法——「" + other.card.name + "」的建议是：" + other.card.advice[orient(other)] + "。");
      p.push("看见它，承认它，然后绕开它。这就是今天占卜的意义。");
    }

    else if (t === "competition") {
      var abilities = uniq(c.map(function (e) { return e.card.tags.ability; }));
      p.push("你的竞争力不是单点，而是一组牌：" + abilities.join("、") + "——这是你当前的组合。");
      p.push("「" + c0.card.name + "」代表你最硬的部分：" + meaningOf(c0).light[0] + "。");
      if (c.length > 1) {
        p.push("「" + c1.card.name + "」提示你要补的课：" + meaningOf(c1).shadow[0] + "。");
      }
      p.push("竞争力不是一张总分表，而是一张组合牌。");
    }

    else if (t === "keyword") {
      p.push("「" + cLast.card.name + "」落在你的年度命题上。");
      p.push(meaningOf(cLast).core);
      p.push(contextTextOf(cLast, t));
      p.push("关键词不是预言，是你接下来一年的路标。");
    }

    else {
      p.push("「" + cLast.card.name + "」说：" + meaningOf(cLast).core);
      p.push(contextTextOf(cLast, t));
    }

    return p;
  }

  /* ---------------- 命运提示 ---------------- */

  function buildTips(reading) {
    var themeId = reading.theme.id;
    var rng = YTM.game.random.mulberry32((reading.seed ^ 0x9E3779B9) >>> 0);
    var pool = YTM.data.tips || [];
    var matched = pool.filter(function (t) {
      return t.themes.length === 0 || t.themes.indexOf(themeId) !== -1;
    });
    if (matched.length < 3) matched = pool.slice();
    var shuffled = YTM.game.random.shuffle(matched, rng);
    var general = pool.filter(function (t) { return t.themes.length === 0; });
    var result = [];
    for (var i = 0; i < shuffled.length && result.length < 4; i++) {
      if (result.indexOf(shuffled[i].text) === -1) result.push(shuffled[i].text);
    }
    if (result.length < 3) {
      for (var j = 0; j < general.length && result.length < 3; j++) {
        if (result.indexOf(general[j].text) === -1) result.push(general[j].text);
      }
    }
    return result;
  }

  /* ---------------- 组装最终结果 ---------------- */

  function buildResult(reading) {
    var cLast = reading.cards[reading.cards.length - 1];
    var word = cLast.card.keyword[orient(cLast)];

    return {
      themeId: reading.theme.id,
      themeTitle: reading.theme.title,
      spreadId: reading.spread.id,
      spreadName: reading.spread.name,
      spreadAlias: reading.spread.alias,
      keyword: { word: word, line: keywordLine(reading.theme.id, word) },
      spreadSummary: buildSummary(reading),
      portrait: buildPortrait(reading),
      tips: buildTips(reading),
      advice: cLast.card.advice[orient(cLast)],
      perCard: buildPerCard(reading),
      finalCard: {
        id: cLast.card.id,
        name: cLast.card.name,
        en: cLast.card.en,
        no: cLast.card.no,
        palette: cLast.card.palette,
        keyword: cLast.card.keyword,
        reversed: cLast.reversed,
        keywordWord: word
      },
      disclaimer: "本游戏结果仅供娱乐，不构成真实的升学预测或决策依据。"
    };
  }

  YTM.game.buildResult = buildResult;
})(typeof window !== "undefined" ? window : globalThis);
