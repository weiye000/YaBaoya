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
      '<button class="btn-back" type="button" data-nav="home">返回</button>' +
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
      YTM.ui.storage.addReading(state.reading, state.result);
      state.reading._saved = true;
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
    openModal("modal-history");
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
        nav("theme");
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

    /* 弹窗关闭（背景与关闭按钮） */
    document.addEventListener("click", function (e) {
      var closer = e.target.closest("[data-close]");
      if (closer) {
        closeModal(closer.getAttribute("data-close"));
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
        return;
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

  /* 命运簿底部清空按钮 */
  function ensureHistoryClearBtn() {
    var list = $("history-list");
    if (!list) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "btn-history-clear";
    btn.className = "history-clear";
    btn.textContent = "清空命运簿";
    list.after(btn);
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
      ensureHistoryClearBtn();
      renderHome();
      renderTheme();
      renderSpread();
      wireGlobal();
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
