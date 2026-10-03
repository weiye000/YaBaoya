/* ============================================================
   研途秘典 · 主控制器
   状态机 / 页面路由 / 页面渲染 / 弹窗 / 命运簿 / 分享
   ============================================================ */
(function (global) {
  "use strict";
  var YTM = global.YTM = global.YTM || {};

  var state = {
    themeId: null,
    status: null,
    question: "",
    spreadId: null,
    reading: null,
    result: null
  };

  var navLock = false;
  var drawBusy = false;
  var drawGen = 0; /* 抽牌代次：防止翻牌定时器跨重渲染残留 */

  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  /* ---------------- 路由 ---------------- */

  function nav(id) {
    var next = $("screen-" + id);
    var cur = document.querySelector(".screen.active");
    if (!next || next === cur || navLock) return;
    navLock = true;
    var swap = function () {
      if (cur) cur.classList.remove("active", "leaving");
      next.classList.add("active");
      navLock = false;
      global.scrollTo(0, 0);
    };
    if (cur) {
      cur.classList.add("leaving");
      setTimeout(swap, 175);
    } else {
      swap();
    }
  }

  /* ---------------- 管理台（仅管理员 Yaya 登录后可见） ---------------- */

  function loadAdminData() {
    if (!YTM.backend.api.isAdmin()) return;
    YTM.backend.api.adminStats().then(function (data) {
      var stats = $("admin-stats");
      if (stats) {
        stats.innerHTML =
          '<div class="admin-stat"><span class="admin-stat-n">' + data.counts.users + '</span><span class="admin-stat-l">注册用户</span></div>' +
          '<div class="admin-stat"><span class="admin-stat-n">' + data.counts.readings + '</span><span class="admin-stat-l">命运簿记录</span></div>' +
          '<div class="admin-stat"><span class="admin-stat-n">' + data.counts.wishes + '</span><span class="admin-stat-l">心事</span></div>' +
          '<div class="admin-stat"><span class="admin-stat-n">' + data.counts.lights + '</span><span class="admin-stat-l">点亮</span></div>';
      }
      var usersBox = $("admin-users");
      if (usersBox) {
        var rows = data.users.map(function (u) {
          return '<div class="admin-row">' +
            '<span class="admin-row-name">' + esc(u.username) +
            (u.role === "admin" ? ' <span class="admin-badge">管理员</span>' : '') + '</span>' +
            '<span class="admin-row-time">' + esc(u.createdAt ? fmtTime(u.createdAt) : "") + '</span>' +
            '</div>';
        }).join("");
        usersBox.innerHTML =
          '<h2 class="admin-section-title">注册用户（' + data.users.length + '）</h2>' +
          '<div class="admin-list">' + (rows || '<p class="account-note dim">暂无注册用户</p>') + '</div>';
      }
    }).catch(function (err) {
      var stats = $("admin-stats");
      if (stats) {
        stats.innerHTML = '<p class="account-error">加载失败：' + esc(err && err.message ? err.message : "未知错误") + '</p>';
      }
    });

    YTM.backend.api.listWishes(30).then(function (list) {
      var box = $("admin-wishes");
      if (!box) return;
      var rows = list.map(function (w) {
        return '<div class="admin-row">' +
          '<span class="admin-row-text">' + esc(w.text) + ' <span class="u-dim">（✦ ' + w.lights + '）</span></span>' +
          '<button class="admin-del" type="button" data-wish-id="' + esc(w.id) + '">删除</button>' +
          '</div>';
      }).join("");
      box.innerHTML =
        '<h2 class="admin-section-title">心事管理</h2>' +
        '<div class="admin-list">' + (rows || '<p class="account-note dim">心事墙还是空的</p>') + '</div>';
    }).catch(function () {});
  }

  function renderAdmin() {
    var body = $("screen-admin");
    if (!body) return;
    var user = YTM.backend.api.user();
    body.innerHTML =
      '<div class="screen-body">' +
      '<button class="btn-back" type="button" data-nav="home">返回</button>' +
      '<div class="screen-head">' +
      '<h1 class="screen-title">研途管理台</h1>' +
      '<p class="screen-subtitle">管理员 · ' + esc(user ? user.username : "Yaya") + ' · 数据经云端校验，仅本人可见</p>' +
      '</div>' +
      '<div id="admin-stats" class="admin-stats"><p class="account-note dim">加载统计中…</p></div>' +
      '<div id="admin-users" class="admin-section"></div>' +
      '<div id="admin-wishes" class="admin-section"></div>' +
      '<div class="account-actions">' +
      '<button id="btn-admin-refresh" class="btn btn-ghost btn-wide" type="button">刷新数据</button>' +
      '<button id="btn-admin-play" class="btn btn-primary btn-wide" type="button">进入游戏</button>' +
      '<button id="btn-admin-logout" class="text-link" type="button">退出登录</button>' +
      '</div>' +
      '</div>';
    loadAdminData();
  }

  /* ---------------- 身份选择门（登录 / 注册 / 匿名进入） ---------------- */

  function renderGate() {
    var body = $("screen-gate");
    if (!body) return;
    body.innerHTML = '<div class="screen-body"><p class="account-note dim">确认登录状态…</p></div>';
    /* 真实校验会话（避免仅凭本地记忆显示已登录） */
    YTM.backend.api.refreshAuthState().then(function () {
      renderGateContent();
    }).catch(function () {
      renderGateContent();
    });
  }

  function renderGateContent() {
    var body = $("screen-gate");
    if (!body) return;
    var user = YTM.backend.api.user();
    var cloud = YTM.backend.api.isCloud();
    if (user) {
      body.innerHTML =
        '<div class="screen-body">' +
        '<button class="btn-back" type="button" data-nav="home">返回</button>' +
        '<div class="screen-head">' +
        '<h1 class="screen-title">欢迎回来</h1>' +
        '<p class="screen-subtitle">已登录账户 · 命运簿与图鉴将自动云同步</p>' +
        '</div>' +
        '<div class="gate-logged">' +
        '<p class="account-user">当前账户：<span class="u-gold">' + esc(user.username) + '</span></p>' +
        '<button id="btn-gate-enter" class="btn btn-primary btn-wide" type="button">以该身份进入研途</button>' +
        '<button id="btn-gate-logout" class="text-link" type="button">退出登录</button>' +
        '</div>' +
        '<p class="account-note dim">换设备登录同一账号，所有占卜记录都会跟着你。</p>' +
        '</div>';
      return;
    }
    body.innerHTML =
      '<div class="screen-body">' +
      '<button class="btn-back" type="button" data-nav="home">返回</button>' +
      '<div class="screen-head">' +
      '<h1 class="screen-title">研途之门前</h1>' +
      '<p class="screen-subtitle">' + (cloud ? "登录后命运簿与你同行；不登录也可直接进入" : "云端未配置 · 当前为本地模式（可选，见 README）") + '</p>' +
      '</div>' +
      '<div class="account-form">' +
      '<input id="gate-name" class="account-input" type="text" maxlength="16" placeholder="用户名（2-16 位）" autocomplete="username">' +
      '<input id="gate-pass" class="account-input" type="password" placeholder="密码（6-32 位）" autocomplete="current-password">' +
      '<p id="gate-error" class="account-error" hidden></p>' +
      '<div class="account-actions">' +
      '<button id="btn-gate-login" class="btn btn-primary btn-wide" type="button">登录并进入</button>' +
      '<button id="btn-gate-register" class="btn btn-ghost btn-wide" type="button">注册新账号并进入</button>' +
      '</div>' +
      '</div>' +
      '<div class="gate-divider"><span></span>或<span></span></div>' +
      '<button id="btn-gate-anon" class="btn btn-ghost btn-wide" type="button">匿名进入研途</button>' +
      '<p class="account-note dim">' + (cloud ? "匿名玩家使用设备身份与 8 位同步码，可随时在命运簿里升级为账号。" : "不配置云端也完全不影响游戏，数据保存在本机。") + '</p>' +
      '</div>';
  }

  /* ---------------- 首页 ---------------- */

  var HOME_EMBLEM =
    '<svg viewBox="0 0 200 200" aria-hidden="true">' +
    '<circle cx="100" cy="100" r="97" fill="none" stroke="#c9a45c" stroke-opacity="0.5" stroke-width="1" stroke-dasharray="1 26.7"/>' +
    '<circle cx="100" cy="100" r="85" fill="none" stroke="#c9a45c" stroke-opacity="0.28" stroke-width="0.8" stroke-dasharray="3 6"/>' +
    '<circle cx="100" cy="100" r="68" fill="none" stroke="#c9a45c" stroke-opacity="0.7" stroke-width="1"/>' +
    '<polygon points="100,20 112,100 100,180 88,100" fill="none" stroke="#e8cf8f" stroke-opacity="0.5" stroke-width="1"/>' +
    '<circle cx="100" cy="100" r="44" fill="none" stroke="#c9a45c" stroke-opacity="0.35" stroke-width="0.8" stroke-dasharray="2 6"/>' +
    '<path d="M100 8 L106 26 L124 32 L106 38 L100 56 L94 38 L76 32 L94 26 Z" fill="#e8cf8f" fill-opacity="0.7"/>' +
    '<path d="M100 144 L106 162 L124 168 L106 174 L100 192 L94 174 L76 168 L94 162 Z" fill="#e8cf8f" fill-opacity="0.4"/>' +
    '<path d="M8 100 L26 94 L32 76 L38 94 L56 100 L38 106 L32 124 L26 106 Z" fill="#e8cf8f" fill-opacity="0.55"/>' +
    '<path d="M144 100 L162 94 L168 76 L174 94 L192 100 L174 106 L168 124 L162 106 Z" fill="#e8cf8f" fill-opacity="0.55"/>' +
    '</svg>';

  function renderHome() {
    $("screen-home").innerHTML =
      '<div class="home-inner">' +
      '<div class="home-emblem-wrap">' +
      '<div class="home-emblem">' + HOME_EMBLEM + '</div>' +
      '<div class="home-emblem-core">研</div>' +
      '</div>' +
      '<h1 class="home-title">研途秘典</h1>' +
      '<p class="home-subtitle">你的保研之路，究竟会通向哪里？</p>' +
      '<div class="home-divider" aria-hidden="true"><span></span>✦<span></span></div>' +
      '<p class="home-tagline">写下你的问题。<br>让命运替你翻开下一页。</p>' +
      '<button class="btn btn-primary home-cta" id="btn-start" type="button">开始占卜</button>' +
      '<p class="home-disclaimer">本游戏结果仅供娱乐，不构成真实的升学预测或决策依据。</p>' +
      '</div>';
  }

  /* ---------------- 主题选择 ---------------- */

  function renderTheme() {
    var qs = YTM.data.questions;
    var cardsHtml = qs.map(function (q) {
      return '<button class="theme-card" type="button" data-theme-id="' + q.id + '">' +
        '<span class="theme-glyph" aria-hidden="true">' + q.glyph + '</span>' +
        '<span class="theme-title">' + q.title + '</span>' +
        '<span class="theme-sample">' + q.sample + '</span>' +
        '</button>';
    }).join("");
    $("screen-theme").innerHTML =
      '<div class="screen-body">' +
      '<button class="btn-back" type="button" data-nav="' +
      (YTM.backend.api.isCloud() ? "gate" : "home") + '">返回</button>' +
      '<div class="screen-head">' +
      '<h1 class="screen-title">选择占卜主题</h1>' +
      '<p class="screen-subtitle">这一次，你想问命运什么？</p>' +
      '</div>' +
      '<div class="theme-grid">' + cardsHtml + '</div>' +
      '</div>';
  }

  /* ---------------- 问题输入 ---------------- */

  function renderQuestion() {
    var theme = YTM.data.getQuestion(state.themeId) || YTM.data.questions[0];
    var chips = YTM.data.statusOptions.map(function (s) {
      return '<button class="chip' + (state.status === s ? " selected" : "") + '" type="button" data-status="' + esc(s) + '">' + esc(s) + '</button>';
    }).join("");
    $("screen-question").innerHTML =
      '<div class="screen-body">' +
      '<button class="btn-back" type="button" data-nav="theme">返回</button>' +
      '<div class="screen-head">' +
      '<div class="q-theme-banner"><span aria-hidden="true">' + theme.glyph + '</span>' + theme.title + '</div>' +
      '</div>' +
      '<div>' +
      '<p class="q-section-label">我的当前状态 · 可不选</p>' +
      '<div class="chips" id="status-chips">' + chips + '</div>' +
      '</div>' +
      '<div>' +
      '<p class="q-section-label">我最想问的是 · 可不填</p>' +
      '<textarea class="q-input" id="q-text" maxlength="140" placeholder="把你真正想问的问题写下来……">' + esc(state.question) + '</textarea>' +
      '<p class="q-counter"><span id="q-count">' + state.question.length + '</span> / 140</p>' +
      '</div>' +
      '<button class="btn btn-primary btn-wide" id="btn-ritual" type="button">进入占卜仪式</button>' +
      '</div>';
  }

  /* ---------------- 牌阵选择 ---------------- */

  function renderSpread() {
    if (!state.spreadId) state.spreadId = "five";
    var opts = YTM.data.spreads.map(function (s) {
      var dots = "";
      for (var i = 0; i < s.count; i++) {
        dots += '<span class="preview-dot' + (s.count === 5 ? " small" : "") + '"></span>';
      }
      return '<button class="spread-option' + (state.spreadId === s.id ? " selected" : "") + '" type="button" data-spread-id="' + s.id + '">' +
        '<span class="spread-preview" aria-hidden="true">' + dots + '</span>' +
        '<span class="spread-option-body">' +
        '<span class="spread-option-name">' + s.name +
        '<span class="spread-option-alias">' + s.alias + '</span>' +
        (s.id === "five" ? '<span class="badge-recommend">推荐</span>' : "") +
        '</span>' +
        '<span class="spread-option-desc">' + s.desc + '</span>' +
        '</span>' +
        '</button>';
    }).join("");
    $("screen-spread").innerHTML =
      '<div class="screen-body">' +
      '<button class="btn-back" type="button" data-nav="question">返回</button>' +
      '<div class="screen-head">' +
      '<h1 class="screen-title">选择牌阵</h1>' +
      '<p class="screen-subtitle">牌阵决定这次命运展开的方式</p>' +
      '</div>' +
      '<div class="spread-options" id="spread-options">' + opts + '</div>' +
      '<button class="btn btn-primary btn-wide" id="btn-deal" type="button">开始抽牌</button>' +
      '</div>';
  }

  /* ---------------- 抽牌仪式 ---------------- */

  function allFlipped() {
    var cards = document.querySelectorAll("#draw-spread .spread-card");
    for (var i = 0; i < cards.length; i++) {
      if (!cards[i].classList.contains("flipped")) return false;
    }
    return true;
  }

  function showDetail(idx) {
    var p = state.result && state.result.perCard ? state.result.perCard[idx] : null;
    var panel = $("card-detail");
    if (!p || !panel) return; /* 动画期间离开页面时安全退出 */
    var lines = p.lines.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("");
    panel.hidden = false;
    panel.innerHTML =
      '<div class="card-detail-head">' +
      '<span class="card-detail-position">' + esc(p.label) + '</span>' +
      '<span class="card-detail-name">' + esc(p.name) + '</span>' +
      '<span class="card-detail-orient' + (p.reversed ? " reversed" : "") + '">' + p.orientationLabel + '</span>' +
      '</div>' +
      '<p class="card-detail-lead">' + esc(p.lead) + '</p>' +
      '<p class="card-detail-core">' + esc(p.core) + '</p>' +
      '<p class="card-detail-context">' + esc(p.contextText) + '</p>' +
      '<ul class="card-detail-lines">' + lines + '</ul>' +
      '<p class="card-detail-advice">' + esc(p.adviceText) + '</p>';
  }

  function renderDraw() {
    var reading = state.reading;
    drawBusy = false;
    var slots = reading.cards.map(function (entry, i) {
      return '<div class="card-slot" style="animation: rise-in 0.55s var(--ease-out) both; animation-delay:' + (i * 90) + 'ms">' +
        '<div class="card-scene">' +
        '<div class="spread-card" data-idx="' + i + '" role="button" tabindex="0" aria-label="翻开第 ' + (i + 1) + ' 张牌：' + esc(entry.position.label) + '">' +
        '<div class="card-face card-back">' + YTM.ui.cards.cardBackSVG(i) + '</div>' +
        '<div class="card-face card-front">' + YTM.ui.cards.cardFaceSVG(entry.card, entry.reversed) + '</div>' +
        '</div>' +
        '</div>' +
        '<span class="card-pos-label">' + esc(entry.position.label) + '</span>' +
        '<span class="card-pos-desc">' + esc(entry.position.desc) + '</span>' +
        '</div>';
    }).join("");

    $("screen-draw").innerHTML =
      '<div class="screen-body">' +
      '<button class="btn-back" type="button" data-nav="spread">返回</button>' +
      '<div class="draw-head">' +
      '<div class="draw-ritual-line">占卜仪式 · ' + esc(reading.spread.alias) + '</div>' +
      '<h1 class="screen-title">' + esc(reading.theme.title) + '</h1>' +
      '</div>' +
      '<div id="draw-spread" class="spread spread--' + reading.spread.id + '">' + slots + '</div>' +
      '<p id="draw-hint" class="draw-hint">轻触卡牌，依次翻开' +
      (reading.spread.count > 3 ? '（牌阵可左右滑动）' : '') +
      '</p>' +
      '<div id="card-detail" class="card-detail" hidden></div>' +
      '<div class="draw-actions">' +
      '<button class="btn btn-primary btn-wide" id="btn-result" type="button" hidden>查看完整解读</button>' +
      '<button class="btn btn-ghost btn-wide" id="btn-redraw" type="button" hidden>换一组牌</button>' +
      '</div>' +
      '</div>';
  }

  function startReading() {
    if (navLock) return;
    drawGen++;
    state.reading = YTM.game.createReading({
      spreadId: state.spreadId,
      themeId: state.themeId,
      status: state.status,
      question: state.question
    });
    state.result = YTM.game.buildResult(state.reading);
    state.reading._saved = false;
    renderDraw();
    nav("draw");
    YTM.ui.sound.play("draw");
  }

  function onCardClick(cardEl) {
    if (drawBusy || cardEl.classList.contains("flipped")) return;
    drawBusy = true;
    var gen = drawGen;
    var idx = parseInt(cardEl.getAttribute("data-idx"), 10);
    YTM.ui.sound.play("flip");
    cardEl.classList.add("flipped");
    setTimeout(function () {
      if (gen !== drawGen) return; /* 本次抽牌已被替换 */
      if (!document.getElementById("draw-spread")) return; /* 已离开抽牌页 */
      drawBusy = false;
      showDetail(idx);
      YTM.ui.sound.play("reveal");
      if (allFlipped()) {
        var hint = $("draw-hint");
        if (hint) {
          hint.textContent = "命运已全部展开";
          hint.classList.add("done");
        }
        var btnResult = $("btn-result");
        var btnRedraw = $("btn-redraw");
        if (btnResult) btnResult.hidden = false;
        if (btnRedraw) btnRedraw.hidden = false;
        YTM.ui.sound.play("result");
      }
    }, 620);
  }

  /* ---------------- 结果页 ---------------- */

  function saveCurrentReading() {
    if (state.reading && !state.reading._saved) {
      var entry = YTM.ui.storage.addReading(state.reading, state.result);
      state.reading._saved = true;
      /* 已配置云端时写入云端（登录按账号、访客按同步码；失败静默，本地记录不受影响） */
      if (YTM.backend && YTM.backend.api && YTM.backend.api.hasCloud() &&
          (YTM.backend.api.user() || YTM.backend.api.getSyncCode())) {
        YTM.backend.api.saveReading(entry).catch(function () {});
      }
    }
  }

  function renderResult() {
    var r = state.result;
    var summary = r.spreadSummary.map(function (s) {
      return '<div class="summary-item">' +
        '<div class="sum-pos">' + esc(s.label) + '</div>' +
        '<div class="sum-name">' + esc(s.name) + '</div>' +
        '<div class="sum-kw">' + esc(s.keywordWord) + '</div>' +
        (s.reversed ? '<span class="sum-rev">逆位</span>' : "") +
        '</div>';
    }).join("");
    var perCardHtml = r.perCard.map(function (pc) {
      var lines = pc.lines.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("");
      return '<div class="percard">' +
        '<div class="percard-head">' +
        '<span class="card-detail-position">' + esc(pc.label) + '</span>' +
        '<span class="card-detail-name">' + esc(pc.name) + '</span>' +
        '<span class="card-detail-orient' + (pc.reversed ? " reversed" : "") + '">' + pc.orientationLabel + '</span>' +
        '</div>' +
        '<p class="card-detail-lead">' + esc(pc.lead) + '</p>' +
        '<p class="card-detail-core">' + esc(pc.core) + '</p>' +
        '<p class="card-detail-context">' + esc(pc.contextText) + '</p>' +
        '<ul class="card-detail-lines">' + lines + '</ul>' +
        '<p class="card-detail-advice">' + esc(pc.adviceText) + '</p>' +
        '</div>';
    }).join("");

    var portrait = r.portrait.map(function (p) {
      var t = p.replace(/「([^」]+)」/g, "「<strong>$1</strong>」");
      return "<p>" + t + "</p>";
    }).join("");
    var tips = r.tips.map(function (t, i) {
      return '<div class="tip-item reveal-item" style="animation-delay:' + (i * 120) + 'ms">' + esc(t) + '</div>';
    }).join("");

    var statusLine = state.reading.status ? '<p class="result-status u-center u-small u-dim">此刻的你 · ' + esc(state.reading.status) + '</p>' : "";
    var questionLine = state.reading.question
      ? '<p class="result-question u-center u-small u-dim">你问的是：「<span id="q-echo"></span>」</p>'
      : "";

    $("screen-result").innerHTML =
      '<div class="screen-body">' +
      '<div class="result-keyword reveal-item" style="animation-delay:0ms">' +
      '<div class="keyword-label">你的研途关键词</div>' +
      '<div class="keyword-word"><span class="kw-bracket">「</span>' + esc(r.keyword.word) + '<span class="kw-bracket">」</span></div>' +
      '<div class="keyword-line">' + esc(r.keyword.line) + '</div>' +
      '</div>' +
      statusLine + questionLine +
      '<section class="result-section reveal-item" style="animation-delay:120ms">' +
      '<h2>命运牌阵 · ' + esc(r.spreadName) + '</h2>' +
      '<div class="summary-grid">' + summary + '</div>' +
      '</section>' +
      '<section class="result-section reveal-item" style="animation-delay:220ms">' +
      '<h2>逐牌详解</h2>' +
      '<div class="percard-list">' + perCardHtml + '</div>' +
      '</section>' +
      '<section class="result-section reveal-item" style="animation-delay:320ms">' +
      '<h2>你的保研画像</h2>' +
      '<div class="portrait">' + portrait + '</div>' +
      '</section>' +
      '<section class="result-section reveal-item" style="animation-delay:420ms">' +
      '<h2>命运提示</h2>' +
      '<div>' + tips + '</div>' +
      '</section>' +
      '<section class="result-section reveal-item" style="animation-delay:520ms">' +
      '<h2>给此刻的你</h2>' +
      '<div class="advice-box">' +
      '<div class="advice-label">行动建议</div>' +
      '<div class="advice-text">' + esc(r.advice) + '</div>' +
      '</div>' +
      '</section>' +
      '<div class="result-actions reveal-item" style="animation-delay:620ms">' +
      '<button class="btn btn-primary btn-wide" id="btn-share-open" type="button">生成我的研途命运卡</button>' +
      '<button class="btn btn-ghost btn-wide" id="btn-again" type="button">再问一次</button>' +
      '<button class="text-link" id="btn-home" type="button">回到首页</button>' +
      '</div>' +
      '<p class="result-disclaimer">' + esc(r.disclaimer) + '</p>' +
      '</div>';

    var qEcho = $("q-echo");
    if (qEcho) qEcho.textContent = state.reading.question;
    saveCurrentReading();
  }

  /* ---------------- 弹窗 ---------------- */

  function openModal(id) {
    var m = $(id);
    if (m) m.hidden = false;
  }

  function closeModal(id) {
    var m = $(id);
    if (m) m.hidden = true;
  }

  var toastTimer = null;
  function toast(msg) {
    var old = $("ytm-toast");
    if (old) old.remove();
    var el = document.createElement("div");
    el.id = "ytm-toast";
    el.textContent = msg;
    el.style.cssText =
      "position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 84px);transform:translateX(-50%);" +
      "z-index:99;padding:10px 22px;border-radius:999px;border:1px solid rgba(201,164,92,.5);" +
      "background:rgba(11,11,28,.92);color:#e8cf8f;font-size:.85rem;letter-spacing:.08em;" +
      "box-shadow:0 8px 30px rgba(0,0,0,.5);animation:rise-in .3s var(--ease-out) both;";
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.style.transition = "opacity .4s";
      el.style.opacity = "0";
      setTimeout(function () { el.remove(); }, 420);
    }, 2200);
  }

  /* ---------------- 分享 ---------------- */

  function openShare() {
    if (!state.result) return;
    openModal("modal-share");
    var canvas = $("share-canvas");
    YTM.ui.share.buildShareCard(canvas, state.result, state.reading ? state.reading.seed : 1);
    var copyBtn = $("btn-share-copy");
    if (copyBtn) {
      copyBtn.hidden = !(navigator.clipboard && typeof global.ClipboardItem === "function");
    }
  }

  /* ---------------- 命运簿 ---------------- */

  function fmtTime(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    return (d.getMonth() + 1) + "月" + d.getDate() + "日 " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function renderHistory() {
    var list = $("history-list");
    var items = YTM.ui.storage.getHistory();
    if (!items.length) {
      list.innerHTML = '<p class="history-empty">命运簿还是空的。<br>去抽一次牌吧。</p>';
      return;
    }
    list.innerHTML = items.map(function (e) {
      if (!e || !e.result || !e.reading) return "";
      return '<button class="history-item" type="button" data-ts="' + e.ts + '">' +
        '<span class="history-item-main">' +
        '<span class="history-item-title">' + esc(e.themeTitle || "占卜") + ' · ' + esc(e.spreadName || "") + '</span>' +
        '<span class="history-item-meta">' + fmtTime(e.ts) + ' · 命运牌 ' + esc(e.finalCardName || "？") + '</span>' +
        '</span>' +
        '<span class="history-item-kw">' + esc(e.keyword || "？") + '</span>' +
        '</button>';
    }).join("");
  }

  function openHistory() {
    renderHistory();
    renderHistoryActions();
    renderHistoryTabs("list");
    openModal("modal-history");
  }

  /* ---------------- 研途图鉴（集卡） ---------------- */

  function collectionFromHistory() {
    var found = {};
    var items = YTM.ui.storage.getHistory();
    for (var i = 0; i < items.length; i++) {
      var reading = items[i].reading;
      if (!reading || !reading.cards) continue;
      for (var j = 0; j < reading.cards.length; j++) {
        found[reading.cards[j].card.id] = true;
      }
    }
    return found;
  }

  function renderCollection() {
    var body = $("collection-body");
    if (!body) return;
    var found = collectionFromHistory();
    var cards = YTM.data.cards;
    var count = 0;
    for (var i = 0; i < cards.length; i++) if (found[cards[i].id]) count++;
    var done = count === cards.length;
    var grid = cards.map(function (c) {
      var got = !!found[c.id];
      return '<div class="collection-item' + (got ? " got" : "") + '">' +
        '<span class="collection-swatch" style="background:linear-gradient(135deg,' + c.palette[0] + ',' + c.palette[1] + ')"></span>' +
        '<span class="collection-name">' + (got ? esc(c.name) : "？") + '</span>' +
        '<span class="collection-kw">' + (got ? esc(c.keyword.u) : "未收集") + '</span>' +
        '</div>';
    }).join("");
    body.innerHTML =
      '<p class="collection-progress">收集进度 <span class="u-gold">' + count + ' / ' + cards.length + '</span></p>' +
      '<div class="collection-bar"><div class="collection-bar-fill" style="width:' + Math.round(count / cards.length * 100) + '%"></div></div>' +
      (done ? '<p class="collection-badge">✦ 秘典之证 · 二十二张大阿卡纳已全部收集 ✦</p>' : '') +
      '<div class="collection-grid">' + grid + '</div>' +
      '<p class="collection-hint">每次占卜抽到的牌都会进入图鉴 · ' +
      (YTM.backend.api.user() || YTM.backend.api.getSyncCode() ? "云端同步已开启" : "当前为本地记录") + '</p>';
  }

  /* ---------------- 命运簿操作区 / 标签页 ---------------- */

  function renderHistoryActions() {
    var box = $("history-actions");
    if (!box) return;
    var user = YTM.backend.api.user();
    var code = YTM.backend.api.getSyncCode();
    var syncLabel = user
      ? "已登录 · " + esc(user.username) + " · 按账号云同步"
      : (code ? "访客模式 · 同步码 " + esc(code) : "云同步未配置（可选，见 README）");
    box.innerHTML =
      '<p class="history-sync-line">' + syncLabel + '</p>' +
      '<button id="btn-account-open" class="history-account-btn" type="button">' +
      (user ? "账户与同步" : "登录 / 云同步") + '</button>' +
      '<button id="btn-history-clear" class="history-clear" type="button">清空命运簿</button>';
  }

  function renderHistoryTabs(active) {
    var tabs = document.querySelectorAll("#history-tabs .history-tab");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle("selected", tabs[i].getAttribute("data-tab") === active);
    }
    var list = $("history-list");
    var coll = $("collection-body");
    if (list) list.hidden = active !== "list";
    if (coll) coll.hidden = active !== "collection";
    if (active === "collection") renderCollection();
  }

  /* ---------------- 云同步设置（账号 + 同步码） ---------------- */

  function renderSync(state) {
    var body = $("account-body");
    if (!body) return;
    if (!YTM.backend.api.isCloud()) {
      body.innerHTML =
        '<p class="account-note">云同步尚未配置。它是免费且可选的：</p>' +
        '<ol class="account-steps">' +
        '<li>mp.weixin.qq.com 注册一个微信小程序（个人主体，免费）</li>' +
        '<li>微信开发者工具 → 导入小程序 → 点「云开发」开通环境（地域选上海）</li>' +
        '<li>云开发控制台创建集合 wishes / lights / readings / users，权限用自定义规则 {"read":true,"write":true}</li>' +
        '<li>云开发控制台 → 云函数 → 新建云函数「auth」，粘贴 scripts/cloudfunctions/auth 下的两个文件并部署</li>' +
        '<li>「设置 → 安全配置 → WEB 安全域名」加入你的前端域名</li>' +
        '<li>把环境 ID 填入 src/config.backend.js</li>' +
        '</ol>' +
        '<p class="account-note dim">不配置也完全不影响游戏本身，命运簿照常保存在本机。</p>';
      return;
    }
    if (state && state.username) {
      body.innerHTML =
        '<p class="account-user">当前账户：<span class="u-gold">' + esc(state.username) + '</span></p>' +
        '<div class="account-actions">' +
        '<button id="btn-sync" class="btn btn-primary btn-wide" type="button">立即同步</button>' +
        '<button id="btn-logout" class="btn btn-ghost btn-wide" type="button">退出登录</button>' +
        '</div>' +
        '<p class="account-note dim">登录状态下，命运簿与图鉴自动按账号同步——换任何设备登录同一账号，数据都在。</p>';
      return;
    }
    var code = YTM.backend.api.getSyncCode();
    body.innerHTML =
      '<div class="account-form">' +
      '<input id="account-name" class="account-input" type="text" maxlength="16" placeholder="用户名（2-16 位）" autocomplete="username">' +
      '<input id="account-pass" class="account-input" type="password" placeholder="密码（6-32 位）" autocomplete="current-password">' +
      '<p id="account-error" class="account-error" hidden></p>' +
      '<div class="account-actions">' +
      '<button id="btn-login" class="btn btn-primary btn-wide" type="button">登录</button>' +
      '<button id="btn-register" class="btn btn-ghost btn-wide" type="button">注册新账号</button>' +
      '</div>' +
      '</div>' +
      '<p class="history-sync-line">访客模式 · 同步码 ' + esc(code) + '</p>' +
      '<div class="account-form">' +
      '<input id="sync-input" class="account-input" type="text" maxlength="8" placeholder="输入其他设备的同步码绑定" autocomplete="off">' +
      '<div class="account-actions">' +
      '<button id="btn-bind" class="btn btn-ghost btn-wide" type="button">绑定同步码</button>' +
      '<button id="btn-reset" class="text-link" type="button">更换我的同步码</button>' +
      '</div>' +
      '</div>' +
      '<p class="account-note dim">注册账号后自动按账号同步；不登录也可用同步码跨设备（像 Wi-Fi 密码一样分享）。</p>';
  }

  function openAccount() {
    var body = $("account-body");
    if (body) body.innerHTML = '<p class="account-note dim">检查登录状态…</p>';
    openModal("modal-account");
    YTM.backend.api.loginState().then(function (state) {
      renderSync(state);
    }).catch(function () {
      renderSync(null);
    });
  }

  function submitAccount(kind, ctx) {
    ctx = ctx || "modal";
    var prefix = ctx === "gate" ? "gate-" : "account-";
    var nameEl = $(prefix + "name");
    var passEl = $(prefix + "pass");
    var errEl = $(prefix + "error");
    var name = nameEl ? nameEl.value.trim() : "";
    var pass = passEl ? passEl.value : "";
    var showErr = function (msg) {
      if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
    };
    if (!/^[\w\u4e00-\u9fa5-]{2,16}$/.test(name)) { showErr("用户名需 2-16 位（字母/数字/中文/下划线）"); return; }
    if (pass.length < 6 || pass.length > 32) { showErr("密码需 6-32 位"); return; }
    var btn = ctx === "gate"
      ? (kind === "login" ? $("btn-gate-login") : $("btn-gate-register"))
      : (kind === "login" ? $("btn-login") : $("btn-register"));
    if (btn) { btn.disabled = true; btn.textContent = kind === "login" ? "登录中…" : "注册中…"; }
    var p = kind === "login" ? YTM.backend.api.login(name, pass) : YTM.backend.api.register(name, pass);
    p.then(function () {
      toast(kind === "login" ? "登录成功" : "注册成功，已自动登录");
      renderHistoryActions();
      /* 管理员 Yaya：直接进入管理台 */
      if (YTM.backend.api.isAdmin()) {
        if (ctx !== "gate") closeModal("modal-account");
        renderAdmin();
        nav("admin");
        return;
      }
      if (ctx === "gate") {
        renderGate();
        nav("theme");
        syncCloud();
      } else {
        openAccount();
        syncCloud();
      }
    }).catch(function (err) {
      var msg = err && err.message ? err.message : "操作失败";
      if (/Function not found|FUNCTION_NOT_FOUND|ResourceNotFound|云函数调用失败|未就绪/.test(msg)) {
        msg = "账号功能暂不可用：云函数未部署。可先匿名进入，或联系开发者。";
      }
      showErr(msg);
      if (btn) { btn.disabled = false; btn.textContent = kind === "login" ? "登录" : "注册新账号"; }
    });
  }

  function bindSync() {
    var input = $("sync-input");
    var errEl = $("account-error");
    var code = input ? input.value.trim() : "";
    if (!/^[A-Za-z0-9]{8}$/.test(code)) {
      if (errEl) { errEl.textContent = "同步码是 8 位字母数字"; errEl.hidden = false; }
      return;
    }
    YTM.backend.api.bindSyncCode(code).then(function () {
      toast("已绑定同步码 " + code + "，开始同步");
      renderSync();
      renderHistoryActions();
      syncCloud();
    }).catch(function (err) {
      if (errEl) { errEl.textContent = err && err.message ? err.message : "绑定失败"; errEl.hidden = false; }
    });
  }

  function resetSync() {
    YTM.backend.api.resetSyncCode().then(function (code) {
      toast("已生成新同步码 " + code);
      renderSync();
      renderHistoryActions();
    });
  }

  function syncCloud() {
    if (!YTM.backend.api.hasCloud()) return;
    if (!YTM.backend.api.user() && !YTM.backend.api.getSyncCode()) return;
    var btn = $("btn-sync");
    if (btn) { btn.disabled = true; btn.textContent = "同步中…"; }
    var local = YTM.ui.storage.getHistory();
    YTM.backend.api.listReadings(50).then(function (cloud) {
      var cloudSeeds = {};
      for (var i = 0; i < cloud.length; i++) cloudSeeds[cloud[i].seed] = true;
      var pushes = local.filter(function (e) { return !cloudSeeds[e.seed]; })
        .map(function (e) { return YTM.backend.api.saveReading(e).catch(function () {}); });
      return Promise.all(pushes).then(function () {
        return YTM.backend.api.listReadings(50);
      });
    }).then(function (cloudAll) {
      var merged = local.slice();
      cloudAll.forEach(function (ce) {
        if (!merged.some(function (le) { return le.seed === ce.seed; })) merged.push(ce);
      });
      merged.sort(function (a, b) { return b.ts - a.ts; });
      merged = merged.slice(0, 30);
      YTM.ui.storage.clear();
      merged.forEach(function (e) { YTM.ui.storage.addReading(e.reading, e.result); });
      toast("同步完成：共 " + merged.length + " 条命运记录");
      renderHistory();
      renderCollection();
      renderHistoryActions();
      if (btn) { btn.disabled = false; btn.textContent = "立即同步"; }
    }).catch(function (err) {
      toast("同步失败：" + (err && err.message ? err.message : "网络异常"));
      if (btn) { btn.disabled = false; btn.textContent = "立即同步"; }
    });
  }

  /* ---------------- 心事墙 ---------------- */

  var litIds = [];
  function loadLit() {
    try { litIds = JSON.parse(localStorage.getItem("ytm_lit_cloud") || "[]"); }
    catch (e) { litIds = []; }
  }
  function saveLit() {
    try { localStorage.setItem("ytm_lit_cloud", JSON.stringify(litIds)); }
    catch (e) { /* 忽略 */ }
  }

  function renderWish(list) {
    var body = $("wish-body");
    if (!body) return;
    var mode = YTM.backend.api.mode();
    var banner = mode === "demo"
      ? '<p class="wish-banner">未连接云端 · 当前为演示模式：你看到的是示例心事。配置云服务（免费）后，所有玩家的心事都会显示在这里。</p>'
      : "";
    var items = (list || []).map(function (w) {
      var lit = litIds.indexOf(w.id) !== -1 || w.lit;
      return '<div class="wish-item">' +
        '<p class="wish-text">' + esc(w.text) + '</p>' +
        '<p class="wish-meta"><span class="u-gold">' + esc(w.keyword) + '</span>' +
        (w.mine ? ' · <span class="wish-mine">我的</span>' : '') +
        ' · ✦ ' + w.lights + '</p>' +
        '<button class="wish-light' + (lit || w.mine ? " lit" : "") + '" type="button" data-wish-id="' + esc(w.id) + '"' +
        (lit || w.mine ? " disabled" : "") + '>' + (lit ? "已点亮" : "点亮") + '</button>' +
        '</div>';
    }).join("");
    body.innerHTML = banner +
      '<div class="wish-form">' +
      '<textarea id="wish-text" class="q-input" maxlength="140" placeholder="匿名写下此刻的心事……"></textarea>' +
      '<p class="q-counter"><span id="wish-count">0</span> / 140</p>' +
      '<button id="btn-wish-post" class="btn btn-primary btn-wide" type="button">匿名投入心事</button>' +
      '</div>' +
      '<div id="wish-list" class="wish-list">' + (items || '<p class="history-empty">心事墙还空着。</p>') + '</div>' +
      '<button id="btn-wish-refresh" class="btn btn-ghost btn-wide" type="button">刷新</button>';
  }

  function openWish() {
    loadLit();
    renderWish([]);
    openModal("modal-wish");
    YTM.backend.api.listWishes(20).then(function (list) {
      renderWish(list);
    }).catch(function () {
      renderWish([]);
    });
  }

  function postWish() {
    var ta = $("wish-text");
    var text = ta ? ta.value.trim() : "";
    if (!text) { toast("先写点什么吧"); return; }
    var btn = $("btn-wish-post");
    if (btn) btn.disabled = true;
    YTM.backend.api.postWish(text, state.result ? state.result.keyword.word : "研途")
      .then(function () {
        toast("心事已投入墙上");
        openWish();
      })
      .catch(function (err) {
        toast("提交失败：" + (err && err.message ? err.message : "网络异常"));
        if (btn) btn.disabled = false;
      });
  }

  function lightWish(id) {
    YTM.backend.api.lightWish(id).then(function () {
      litIds.push(id);
      saveLit();
      toast("已点亮 ✦");
      YTM.backend.api.listWishes(20).then(renderWish).catch(function () {});
    }).catch(function (err) {
      toast(err && err.message === "已点亮" ? "已经点亮过啦" : "点亮失败，稍后再试");
    });
  }

  /* ---------------- 全局事件 ---------------- */

  function wireGlobal() {
    /* 页面导航按钮（返回等） */
    $("screens").addEventListener("click", function (e) {
      var navBtn = e.target.closest("[data-nav]");
      if (navBtn) {
        YTM.ui.sound.play("click");
        nav(navBtn.getAttribute("data-nav"));
        return;
      }
      var startBtn = e.target.closest("#btn-start");
      if (startBtn) {
        YTM.ui.sound.play("click");
        /* 已配置云端：先过「研途之门前」身份选择；单机模式直接进主题 */
        if (YTM.backend.api.isCloud()) {
          renderGate();
          nav("gate");
        } else {
          nav("theme");
        }
        return;
      }
      if (e.target.closest("#btn-gate-anon")) {
        YTM.ui.sound.play("click");
        nav("theme");
        return;
      }
      if (e.target.closest("#btn-gate-enter")) {
        YTM.ui.sound.play("click");
        nav("theme");
        return;
      }
      if (e.target.closest("#btn-gate-login")) {
        YTM.ui.sound.play("click");
        submitAccount("login", "gate");
        return;
      }
      if (e.target.closest("#btn-gate-register")) {
        YTM.ui.sound.play("click");
        submitAccount("register", "gate");
        return;
      }
      if (e.target.closest("#btn-gate-logout")) {
        YTM.backend.api.logout().then(function () {
          toast("已退出登录");
          renderGate();
          renderHistoryActions();
        }).catch(function () {
          toast("退出失败，稍后再试");
        });
        return;
      }
      if (e.target.closest("#btn-admin-refresh")) {
        loadAdminData();
        return;
      }
      if (e.target.closest("#btn-admin-play")) {
        YTM.ui.sound.play("click");
        nav("theme");
        return;
      }
      if (e.target.closest("#btn-admin-logout")) {
        YTM.backend.api.logout().then(function () {
          toast("已退出登录");
          renderGate();
          nav("home");
        }).catch(function () {
          toast("退出失败，稍后再试");
        });
        return;
      }
      var adminDel = e.target.closest(".admin-del");
      if (adminDel) {
        YTM.backend.api.adminDeleteWish(adminDel.getAttribute("data-wish-id")).then(function () {
          toast("心事已删除");
          loadAdminData();
        }).catch(function (err) {
          toast("删除失败：" + (err && err.message ? err.message : "未知错误"));
        });
        return;
      }
      var themeCard = e.target.closest("[data-theme-id]");
      if (themeCard) {
        YTM.ui.sound.play("click");
        state.themeId = themeCard.getAttribute("data-theme-id");
        renderQuestion();
        nav("question");
        return;
      }
      var chip = e.target.closest("[data-status]");
      if (chip) {
        var s = chip.getAttribute("data-status");
        state.status = state.status === s ? null : s;
        var chips = document.querySelectorAll("#status-chips .chip");
        for (var i = 0; i < chips.length; i++) {
          chips[i].classList.toggle("selected", chips[i].getAttribute("data-status") === state.status);
        }
        return;
      }
      var spreadOpt = e.target.closest("[data-spread-id]");
      if (spreadOpt) {
        state.spreadId = spreadOpt.getAttribute("data-spread-id");
        var opts = document.querySelectorAll(".spread-option");
        for (var j = 0; j < opts.length; j++) {
          opts[j].classList.toggle("selected", opts[j].getAttribute("data-spread-id") === state.spreadId);
        }
        return;
      }
      if (e.target.closest("#btn-ritual")) {
        YTM.ui.sound.play("click");
        nav("spread");
        return;
      }
      if (e.target.closest("#btn-deal")) {
        YTM.ui.sound.play("click");
        startReading();
        return;
      }
      if (e.target.closest("#btn-result")) {
        YTM.ui.sound.play("click");
        renderResult();
        nav("result");
        return;
      }
      if (e.target.closest("#btn-redraw")) {
        var redrawBtn = e.target.closest("#btn-redraw");
        redrawBtn.disabled = true; /* 防双击重抽 */
        YTM.ui.sound.play("draw");
        startReading();
        return;
      }
      if (e.target.closest("#btn-share-open")) {
        YTM.ui.sound.play("click");
        openShare();
        return;
      }
      if (e.target.closest("#btn-again")) {
        YTM.ui.sound.play("click");
        state.themeId = null;
        state.status = null;
        state.question = "";
        state.reading = null;
        state.result = null;
        renderTheme();
        nav("theme");
        return;
      }
      if (e.target.closest("#btn-home")) {
        YTM.ui.sound.play("click");
        nav("home");
        return;
      }
    });

    /* 抽牌：翻牌（委托到常驻的 screen-draw 容器，避免重渲染后监听丢失） */
    $("screen-draw").addEventListener("click", function (e) {
      var cardEl = e.target.closest(".spread-card");
      if (cardEl) onCardClick(cardEl);
    });

    /* 抽牌：键盘翻牌（Enter / Space） */
    $("screen-draw").addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var cardEl = e.target.closest(".spread-card");
      if (cardEl) {
        e.preventDefault();
        onCardClick(cardEl);
      }
    });

    /* 问题输入 */
    $("screen-question").addEventListener("input", function (e) {
      if (e.target && e.target.id === "q-text") {
        state.question = e.target.value;
        var counter = $("q-count");
        if (counter) counter.textContent = state.question.length;
      }
    });

    /* 顶栏 */
    $("btn-sound").addEventListener("click", function () {
      var on = !YTM.ui.sound.isEnabled();
      YTM.ui.sound.setEnabled(on);
      $("btn-sound").classList.toggle("is-muted", !on);
      if (on) YTM.ui.sound.play("click");
    });

    $("btn-history").addEventListener("click", function () {
      YTM.ui.sound.play("click");
      openHistory();
    });

    $("btn-wish").addEventListener("click", function () {
      YTM.ui.sound.play("click");
      openWish();
    });

    /* 弹窗关闭（背景与关闭按钮） */
    document.addEventListener("click", function (e) {
      var closer = e.target.closest("[data-close]");
      if (closer) {
        closeModal(closer.getAttribute("data-close"));
      }
      var tab = e.target.closest("#history-tabs .history-tab");
      if (tab) {
        renderHistoryTabs(tab.getAttribute("data-tab"));
        return;
      }
      if (e.target.closest("#btn-account-open")) { openAccount(); return; }
      if (e.target.closest("#btn-login")) { submitAccount("login"); return; }
      if (e.target.closest("#btn-register")) { submitAccount("register"); return; }
      if (e.target.closest("#btn-logout")) {
        YTM.backend.api.logout().then(function () {
          toast("已退出登录");
          renderSync(null);
          renderHistoryActions();
        }).catch(function () {
          toast("退出失败，稍后再试");
        });
        return;
      }
      if (e.target.closest("#btn-bind")) { bindSync(); return; }
      if (e.target.closest("#btn-reset")) { resetSync(); return; }
      if (e.target.closest("#btn-sync")) { syncCloud(); return; }
      if (e.target.closest("#btn-wish-post")) { postWish(); return; }
      if (e.target.closest("#btn-wish-refresh")) { openWish(); return; }
      var lightBtn = e.target.closest(".wish-light");
      if (lightBtn) {
        lightWish(lightBtn.getAttribute("data-wish-id"));
        return;
      }
      var historyItem = e.target.closest("#history-list .history-item");
      if (historyItem) {
        var ts = parseInt(historyItem.getAttribute("data-ts"), 10);
        var items = YTM.ui.storage.getHistory();
        for (var i = 0; i < items.length; i++) {
          if (items[i].ts === ts) {
            state.reading = items[i].reading;
            state.result = items[i].result;
            state.reading._saved = true;
            closeModal("modal-history");
            renderResult();
            nav("result");
            break;
          }
        }
        return;
      }
      if (e.target.closest("#btn-history-clear")) {
        YTM.ui.storage.clear();
        renderHistory();
        renderCollection();
        return;
      }
    });

    /* 心事墙字数统计 */
    document.addEventListener("input", function (e) {
      if (e.target && e.target.id === "wish-text") {
        var c = $("wish-count");
        if (c) c.textContent = e.target.value.length;
      }
    });

    /* 分享操作 */
    $("btn-share-download").addEventListener("click", function () {
      YTM.ui.sound.play("click");
      YTM.ui.share.download($("share-canvas"));
      toast("图片已开始下载");
    });

    $("btn-share-copy").addEventListener("click", function () {
      YTM.ui.sound.play("click");
      YTM.ui.share.copy($("share-canvas")).then(function () {
        toast("已复制到剪贴板，去粘贴吧");
      }).catch(function () {
        toast("当前浏览器不支持复制，请长按保存");
      });
    });

    /* Esc 关闭弹窗 */
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        var modals = document.querySelectorAll(".modal:not([hidden])");
        for (var i = 0; i < modals.length; i++) modals[i].hidden = true;
      }
    });

    /* 首次交互解锁音频并预加载音效文件 */
    var unlock = function () {
      YTM.ui.sound.unlock();
      YTM.ui.sound.preload();
    };
    document.addEventListener("pointerdown", unlock, { once: true, passive: true });
  }

  /* ---------------- 启动 ---------------- */

  function showFatal(err) {
    var host = $("screens");
    host.innerHTML =
      '<div class="screen active" style="display:block"><div class="screen-body">' +
      '<h1 class="screen-title">命运之门暂时无法开启</h1>' +
      '<p class="screen-subtitle">页面资源加载异常，请刷新重试。</p>' +
      '<p class="u-center u-dim u-small" style="margin-top:16px">' + esc(err && err.message ? err.message : String(err)) + '</p>' +
      '</div></div>';
  }

  function boot() {
    try {
      if (!YTM.data || !YTM.data.cards || YTM.data.cards.length < 5) {
        throw new Error("卡牌数据加载失败");
      }
      if (!YTM.data.spreads || !YTM.data.spreads.length) {
        throw new Error("牌阵数据加载失败");
      }
      YTM.ui.sound.init();
      $("btn-sound").classList.toggle("is-muted", !YTM.ui.sound.isEnabled());
      YTM.ui.starfield.init($("starfield"));
      renderHome();
      renderTheme();
      renderSpread();
      wireGlobal();
      /* 启动时刷新登录态：会话失效则清除本地记忆 */
      YTM.backend.api.refreshAuthState().catch(function () {});
      nav("home");
    } catch (err) {
      if (global.console && console.error) console.error(err);
      showFatal(err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
