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

  /* 牌阵位置 → 角色（决定取 light 还是 shadow；positions 已带 role 时优先使用） */
  var ROLES = {
    five: ["strength", "weakness", "chance", "block", "revelation"],
    three: ["past", "present", "future"],
    one: ["revelation"]
  };

  var SHADOW_ROLES = { weakness: true, block: true };

  /* 位置 × 正逆位 的叙事框架：保证「每张牌在某个位置上」都有一句自洽的开场 */
  var FRAME = {
    "我的优势": {
      u: "它正位落在「我的优势」——这张牌点出的，是你身上已经成形、可以倚仗的部分。",
      r: "它逆位落在「我的优势」——这份力量你其实拥有，只是近来被压住了，没那么亮。"
    },
    "我的短板": {
      u: "它正位落在「我的短板」——正位的力量用过了头，反而容易变成你的软肋。",
      r: "它逆位落在「我的短板」——这正是它逆位时最常暴露出的暗面。"
    },
    "外部机会": {
      u: "它正位落在「外部机会」——一个与你有关的转机正在成形，气质与这张牌相近。",
      r: "它逆位落在「外部机会」——机会藏在变化与混乱里，需要你多留意细节才能接住。"
    },
    "最大阻碍": {
      u: "它正位落在「最大阻碍」——最值得警惕的，是这份力量「过犹不及」的那一面。",
      r: "它逆位落在「最大阻碍」——它逆位时的状态，正是你最容易绊倒的地方。"
    },
    "最终启示": {
      u: "它正位落在「最终启示」——命运把整局牌收束成了这一句话。",
      r: "它逆位落在「最终启示」——答案也许不在你习惯的方向里，试试换个角度看。"
    },
    "过去": {
      u: "它正位落在「过去」——你能走到今天，靠的正是这份特质。",
      r: "它逆位落在「过去」——那段路里有迷茫也有收获，它们一起塑造了现在的你。"
    },
    "现在": {
      u: "它正位落在「现在」——此刻的你，正与这份状态同频。",
      r: "它逆位落在「现在」——当下的你也许正处在它的逆位里：有些乱，但不等于糟。"
    },
    "未来": {
      u: "它正位落在「未来」——接下来可能展开的趋势，与这张牌的气质相近。",
      r: "它逆位落在「未来」——趋势里藏着变数，主动调整会让它朝好的方向转。"
    },
    "今日启示": {
      u: "它正位落在「今日启示」——这是此刻最值得你听见的一句话。",
      r: "它逆位落在「今日启示」——今天的关键不在答案，而在换个角度看问题。"
    }
  };

  /* 用户当前阶段 → 结果页收尾呼应 */
  var STATUS_NOTES = {
    "大三上": "你正处在大三上——一切仍在积累期，牌面提示的方向，现在布局都来得及。",
    "大三下": "你正处在大三下——冲刺与查漏并行的阶段，把牌面的提醒写进日程里。",
    "暑期": "你正处在暑期——夏令营与实验室之间，把牌面的提醒带进每一次选择。",
    "预推免阶段": "你正处在预推免阶段——窗口很短，牌面说的「稳」与「准」此刻尤其重要。",
    "已经拿到 offer": "你已经拿到了 offer——占卜到这里更像一次复盘：确认自己为什么出发，比去哪更值得。",
    "正在纠结选择": "你正在纠结选择——牌面替你做不了决定，但能帮你听见自己更倾向的那个声音。"
  };

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
      general: "把「" + word + "」二字放在心上——看清它，你的路会自己清晰起来。",
      school: "择校这件事，答案藏在「" + word + "」里。",
      research: "接下来一年，请围绕「" + word + "」二字安排你的精力。",
      camp: "这一程的关键，是「" + word + "」。",
      mentor: "你的导师缘，绕不开「" + word + "」二字。",
      obstacle: "你的通关密码，叫「" + word + "」。",
      competition: "你的竞争力关键词，落在「" + word + "」上。",
      keyword: "这一年，命运把「" + word + "」二字交到了你手上。"
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

  /* ---------------- 逐牌解读（位置 × 正逆位 × 主题 自洽） ---------------- */

  function roleOf(entry, reading, index) {
    return entry.position.role || (ROLES[reading.spread.id] || [])[index] || "revelation";
  }

  function isNegativeRole(role) { return SHADOW_ROLES[role] === true; }

  function buildPerCard(reading) {
    return reading.cards.map(function (entry, i) {
      var role = roleOf(entry, reading, i);
      var m = meaningOf(entry);
      var negative = isNegativeRole(role);
      var lines = negative ? m.shadow : m.light;
      var frame = FRAME[entry.position.label];
      var lead = frame
        ? frame[orient(entry)]
        : "它" + (entry.reversed ? "逆位" : "正位") + "落在「" + entry.position.label + "」的位置。";
      return {
        label: entry.position.label,
        desc: entry.position.desc,
        name: entry.card.name,
        en: entry.card.en,
        reversed: entry.reversed,
        orientationLabel: entry.reversed ? "逆位" : "正位",
        keywordWord: entry.card.keyword[orient(entry)],
        role: role,
        lead: lead,
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

  /* ---------------- 保研画像（按主题组装；位置 × 正逆位自洽） ---------------- */

  function orientWord(entry) { return entry.reversed ? "逆位" : "正位"; }

  /* 句末标点归一：数据文本可能以 。？！ 结尾，模板拼接时避免出现「？。」 */
  function endPunct(s) {
    return /[。？！]$/.test(s) ? s : s + "。";
  }

  /* 生成一句「位置角色 × 正逆位」自洽的评语：
     正向位置取 light，负向位置取 shadow；逆位/正位分别补上解释性注脚 */
  function posLine(entry, reading) {
    var role = roleOf(entry, reading, entry.positionIndex);
    var negative = isNegativeRole(role);
    var line = negative ? meaningOf(entry).shadow[0] : meaningOf(entry).light[0];
    if (entry.reversed) {
      return line + (negative
        ? "（逆位出现：这个暗面近来格外活跃。）"
        : "（逆位出现：这份力量眼下被遮蔽，需要你主动点亮。）");
    }
    if (negative) return line + "（正位出现：要警惕的正是「过犹不及」。）";
    return line;
  }

  function firstNegative(cards, reading) {
    for (var i = 0; i < cards.length; i++) {
      if (isNegativeRole(roleOf(cards[i], reading, i))) return cards[i];
    }
    return null;
  }

  /* 优先取「最大阻碍」位，其次「短板」位——最该警惕的那张牌 */
  function firstBlock(cards, reading) {
    for (var i = 0; i < cards.length; i++) {
      if (roleOf(cards[i], reading, i) === "block") return cards[i];
    }
    return firstNegative(cards, reading);
  }

  function positiveCards(cards, reading) {
    return cards.filter(function (e) {
      return !isNegativeRole(roleOf(e, reading, e.positionIndex));
    });
  }

  function buildPortrait(reading) {
    var t = reading.theme.id;
    var c = reading.cards;
    var c0 = c[0], c1 = c[1] || c0, cLast = c[c.length - 1];
    var spread = reading.spread.id;
    var p = [];
    var blockish = firstBlock(c, reading);
    var posList = positiveCards(c, reading);
    var pos = posList[0] || c0;

    /* 用户的问题得到回应：先复述，再说明占卜的立场 */
    if (reading.question) {
      p.push("你问的是「" + reading.question + "」。牌面不会替你作答，但它给出了一种解释。");
    }

    if (t === "general") {
      if (spread === "five") {
        p.push("这一局，撑着你基本盘的是「" + c0.card.name + "」——它落在优势位，说的是：" + posLine(c0, reading));
        p.push("「" + c[3].card.name + "」落在阻碍位，提醒你最该留意的：" + posLine(c[3], reading));
        p.push("机会藏在「" + c[2].card.name + "」那一格：" + posLine(c[2], reading));
        p.push("最后的启示由「" + cLast.card.name + "」收束：" + meaningOf(cLast).core);
      } else if (spread === "three") {
        p.push("「" + c0.card.name + "」以" + orientWord(c0) + "落在过去位——你是如何走到今天的：" + meaningOf(c0).core);
        p.push("「" + c1.card.name + "」以" + orientWord(c1) + "落在现在位——你目前的状态：" + meaningOf(c1).core);
        p.push("「" + cLast.card.name + "」以" + orientWord(cLast) + "落在未来位——接下来可能出现的趋势：" + meaningOf(cLast).core + "趋势不等于结果，方向盘还在你手里。");
      } else {
        p.push("「" + c0.card.name + "」以" + orientWord(c0) + "落在今日启示位：" + meaningOf(c0).core);
        p.push(contextTextOf(c0, t));
      }
      p.push("保研这条路，与其问「结果如何」，不如问「我如何把下一步走好」。");
    }

    else if (t === "school") {
      var stylesRaw = uniq(posList.map(function (e) { return e.card.tags.schoolStyle; }));
      /* 「匹配型」与「学科匹配」语义相近，避免并列重复 */
      var styles = [];
      for (var si = 0; si < stylesRaw.length && styles.length < 2; si++) {
        var st = stylesRaw[si];
        if (st === "匹配型" && styles.indexOf("学科匹配") !== -1) continue;
        if (st === "学科匹配" && styles.indexOf("匹配型") !== -1) continue;
        styles.push(st);
      }
      if (!styles.length) styles = [c0.card.tags.schoolStyle];
      p.push("从牌面看，你的选择倾向更像「" + styles.join(" × ") + "」——这个判断来自你牌阵中的优势与机会位，而不是短板。");
      p.push("「" + c0.card.name + "」在择校语境下的提示：你更容易在与你当前研究方向高度匹配的环境中获得机会——" + c0.card.context.school);
      if (blockish && blockish !== c0) {
        p.push("而「" + blockish.card.name + "」落在「" + blockish.position.label + "」的位置，择校时要特别留意：" + blockish.card.context.school);
      }
      if (cLast !== c0 && cLast !== blockish) {
        p.push("最后「" + cLast.card.name + "」补了一句：" + cLast.card.context.school);
      }
      p.push("与其不断寻找「最好的选择」，不如先明确什么样的研究方向适合你。");
    }

    else if (t === "research") {
      p.push("科研潜力：「" + pos.card.name + "」落在「" + pos.position.label + "」的位置——" + posLine(pos, reading));
      p.push("论文与项目层面：「" + c0.card.name + "」给出的信号是——" + c0.card.context.research);
      if (blockish && blockish !== c0) {
        p.push("科研路上要留意的：「" + blockish.card.name + "」在「" + blockish.position.label + "」的位置提示——" + blockish.card.context.research);
      }
      p.push("坚持程度由「" + cLast.card.name + "」暗示：" + meaningOf(cLast).core);
      p.push("学术探索的方向，往往不是选出来的，而是做出来的。");
    }

    else if (t === "camp") {
      p.push("简历与材料：「" + c0.card.name + "」提示——" + c0.card.context.camp);
      if (c.length > 1) {
        if (isNegativeRole(roleOf(c1, reading, c1.positionIndex))) {
          p.push("面试与沟通：「" + c1.card.name + "」落在「" + c1.position.label + "」的位置，这里要特别练习——" + c1.card.context.camp);
        } else {
          p.push("面试与沟通：「" + c1.card.name + "」提示——" + c1.card.context.camp);
        }
      }
      p.push("临场状态由「" + cLast.card.name + "」书写：" + meaningOf(cLast).core);
      p.push("机会窗口，永远给有准备的人留着。");
    }

    else if (t === "mentor") {
      var types = uniq(posList.map(function (e) { return e.card.tags.mentorType; })).slice(0, 2);
      if (!types.length) types = [c0.card.tags.mentorType];
      p.push("你容易遇到的导师类型，偏向「" + types.join("与") + "」——这是你牌阵中优势与机会位给出的线索。");
      p.push("相处模式上：「" + c0.card.name + "」提醒你——" + c0.card.context.mentor);
      if (blockish && blockish !== c0) {
        p.push("需要磨合的是：「" + blockish.card.name + "」在「" + blockish.position.label + "」的位置提示——" + blockish.card.context.mentor);
      } else if (cLast !== c0) {
        p.push("方向匹配：「" + cLast.card.name + "」给出的线索——" + cLast.card.context.mentor);
      }
      p.push("好的师生关系，一半靠缘分，一半靠经营。");
    }

    else if (t === "obstacle") {
      var blockCard = blockish || c0;
      var tagCards = [blockCard].concat(c.filter(function (e) { return e !== blockCard; }));
      var obs = uniq(tagCards.reduce(function (acc, e) {
        return acc.concat(e.card.tags.obstacle || []);
      }, []));
      if (!obs.length) obs = ["拖延"];
      p.push("牌面指出，最值得警惕的阻碍是：" + obs.slice(0, 3).join("、") + "。");
      p.push("「" + blockCard.card.name + "」在「" + blockCard.position.label + "」的位置说得更直白：" + blockCard.card.context.obstacle);
      var solver = pos;
      if (solver === blockCard) solver = c[Math.min(1, c.length - 1)];
      p.push("但阻碍的反面藏着解法——「" + solver.card.name + "」的建议是：" + endPunct(solver.card.advice[orient(solver)]));
      p.push("看见它，承认它，然后绕开它。这就是今天占卜的意义。");
    }

    else if (t === "competition") {
      var abilities = uniq(posList.map(function (e) { return e.card.tags.ability; }));
      if (!abilities.length) abilities = [c0.card.tags.ability];
      p.push("你的竞争力不是单点，而是一组牌：" + abilities.join("、") + "——这是当前牌面给出的组合。");
      p.push("「" + c0.card.name + "」代表你最硬的部分：" + posLine(c0, reading));
      if (blockish && blockish !== c0) {
        p.push("「" + blockish.card.name + "」在「" + blockish.position.label + "」的位置提示你要补的课：" + posLine(blockish, reading));
      } else if (c.length > 1) {
        p.push("「" + c1.card.name + "」提示你要补的课：" + meaningOf(c1).shadow[0] + "。");
      }
      p.push("竞争力不是一张总分表，而是一张组合牌。");
    }

    else if (t === "keyword") {
      p.push("「" + cLast.card.name + "」以" + orientWord(cLast) + "落在「" + cLast.position.label + "」的位置，成为你的年度命题。");
      p.push(meaningOf(cLast).core);
      p.push(contextTextOf(cLast, t));
      p.push("关键词不是预言，是你接下来一年的路标。");
    }

    else {
      p.push("「" + cLast.card.name + "」以" + orientWord(cLast) + "落在「" + cLast.position.label + "」的位置：" + meaningOf(cLast).core);
      p.push(contextTextOf(cLast, t));
    }

    /* 用户选择的阶段得到回应 */
    if (reading.status && STATUS_NOTES[reading.status]) {
      p.push(STATUS_NOTES[reading.status]);
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
