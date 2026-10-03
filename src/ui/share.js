/* ============================================================
   研途秘典 · 研途命运卡（Canvas 分享图 1080×1440）
   设计概念「命运星图」：顶部枢纽星发出一张命运扇面——
   本次占卜抽到的【全部】卡牌沿星轨展开，星线相连，
   每张牌下方标注牌阵位置与牌名/正逆位/关键词。
   与结果页的线性排版完全不同：这里是星座、扇形、发牌仪式感。
   ============================================================ */
(function (global) {
  "use strict";
  var YTM = global.YTM = global.YTM || {};
  YTM.ui = YTM.ui || {};

  var W = 1080, H = 1440;
  var GOLD = "201,164,92";
  var SERIF = "'Noto Serif SC','Songti SC',serif";
  var ROMANS = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
    "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI"];

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawSpaced(ctx, text, cx, y, spacing) {
    var total = 0, i;
    var widths = [];
    for (i = 0; i < text.length; i++) {
      var w = ctx.measureText(text[i]).width;
      widths.push(w);
      total += w;
    }
    total += spacing * (text.length - 1);
    var x = cx - total / 2;
    for (i = 0; i < text.length; i++) {
      ctx.fillText(text[i], x + widths[i] / 2, y);
      x += widths[i] + spacing;
    }
  }

  function measureSpaced(ctx, text, spacing) {
    var total = 0;
    for (var i = 0; i < text.length; i++) {
      total += ctx.measureText(text[i]).width;
      if (i > 0) total += spacing;
    }
    return total;
  }

  function wrapText(ctx, text, maxWidth) {
    var lines = [];
    var cur = "";
    for (var i = 0; i < text.length; i++) {
      var test = cur + text[i];
      if (ctx.measureText(test).width > maxWidth && cur) {
        lines.push(cur);
        cur = text[i];
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  /* 异步加载图片；失败或无 Image 环境时返回 null（走星图兜底） */
  function loadImg(src) {
    return new Promise(function (resolve) {
      var Img = global.Image;
      if (!Img) { resolve(null); return; }
      var img = new Img();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  /* 按目标区域 cover 裁剪绘制图片 */
  function drawCoverImage(ctx, img, cx, cy, w, h) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    var scale = Math.max(w / iw, h / ih);
    var sw = w / scale, sh = h / scale;
    var sx = (iw - sw) / 2, sy = (ih - sh) / 2;
    ctx.save();
    rr(ctx, cx - w / 2, cy - h / 2, w, h, 16);
    ctx.clip();
    ctx.drawImage(img, sx, sy, sw, sh, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  }

  /* 绘制一张卡（cx,cy 为中心；plate=false 时只画插画+边框+逆位徽章，不画牌名底牌）
     ——小尺寸扇形卡用无名牌，牌名放到卡下方标注里，保证可读性 */
  function drawMiniCard(ctx, card, reversed, cx, cy, w, h, artImg, plate) {
    var s = w / 270; /* 尺寸缩放系数 */
    var p = card.palette || ["#c9a45c", "#2a2a5e"];
    var grad = ctx.createLinearGradient(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
    grad.addColorStop(0, p[0]);
    grad.addColorStop(1, p[1]);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 34;
    ctx.fillStyle = grad;
    rr(ctx, cx - w / 2, cy - h / 2, w, h, 16);
    ctx.fill();
    ctx.restore();

    if (artImg) {
      drawCoverImage(ctx, artImg, cx, cy, w, h);
    } else {
      /* 星图兜底 */
      var sig = YTM.ui.cards.sigilPoints(card.no * 7919 + 17);
      var scale = (w * 0.56) / 96;
      ctx.save();
      ctx.translate(cx, cy - h * (plate ? 0.1 : 0.02));
      ctx.scale(scale, scale);
      ctx.strokeStyle = "rgba(232,207,143,0.55)";
      ctx.lineWidth = 1.6 / scale;
      var i, a, b;
      for (i = 0; i < sig.links.length; i++) {
        a = sig.pts[sig.links[i][0]]; b = sig.pts[sig.links[i][1]];
        ctx.beginPath();
        ctx.moveTo(a[0] - 48, a[1] - 48);
        ctx.lineTo(b[0] - 48, b[1] - 48);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(232,207,143,0.95)";
      for (i = 0; i < sig.pts.length; i++) {
        ctx.beginPath();
        ctx.arc(sig.pts[i][0] - 48, sig.pts[i][1] - 48, i === 0 ? 5 / scale : 2.6 / scale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    /* 逆位徽章 */
    if (reversed) {
      ctx.save();
      ctx.fillStyle = "#a63a32";
      rr(ctx, cx - w / 2 + 22 * s, cy - h / 2 + 30 * s, 84 * s, 38 * s, 8 * s);
      ctx.fill();
      ctx.fillStyle = "#f2e6d0";
      ctx.font = Math.round(24 * s) + "px " + SERIF;
      ctx.textAlign = "center";
      ctx.fillText("逆位", cx - w / 2 + 64 * s, cy - h / 2 + 57 * s);
      ctx.restore();
    }

    /* 金色边框 */
    ctx.strokeStyle = "rgba(" + GOLD + ",0.9)";
    ctx.lineWidth = Math.max(2, 2.5 * s);
    rr(ctx, cx - w / 2, cy - h / 2, w, h, 16);
    ctx.stroke();

    if (plate !== false) {
      /* 底部名牌渐变 + 牌名/关键词（仅大卡使用） */
      var plateGrad = ctx.createLinearGradient(0, cy + h * 0.18, 0, cy + h / 2);
      plateGrad.addColorStop(0, "rgba(11,11,28,0)");
      plateGrad.addColorStop(0.5, "rgba(11,11,28,0.8)");
      plateGrad.addColorStop(1, "rgba(11,11,28,0.96)");
      ctx.fillStyle = plateGrad;
      ctx.fillRect(cx - w / 2, cy + h * 0.18, w, h * 0.32);
      ctx.fillStyle = "#e9e4d8";
      ctx.font = "500 " + Math.round(46 * s) + "px " + SERIF;
      ctx.textAlign = "center";
      ctx.fillText(card.name, cx, cy + h / 2 - 64 * s);
      ctx.fillStyle = "rgba(232,207,143,0.9)";
      ctx.font = Math.round(26 * s) + "px " + SERIF;
      var kw = card.keyword ? card.keyword[reversed ? "r" : "u"] : "";
      ctx.fillText(kw, cx, cy + h / 2 - 22 * s);
    }
  }

  /* 枢纽星 → 卡牌顶缘的星线 */
  function drawHubLine(ctx, hubX, hubY, x2, y2) {
    ctx.strokeStyle = "rgba(" + GOLD + ",0.32)";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 7]);
    ctx.beginPath();
    ctx.moveTo(hubX, hubY);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(232,207,143,0.75)";
    ctx.beginPath();
    ctx.arc(x2, y2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  /* 枢纽星（四芒星 + 光环） */
  function drawHubStar(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = "rgba(232,207,143,0.16)";
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(" + GOLD + ",0.5)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(232,207,143,0.95)";
    ctx.beginPath();
    ctx.moveTo(0, -16); ctx.lineTo(5, -5); ctx.lineTo(16, 0); ctx.lineTo(5, 5);
    ctx.lineTo(0, 16); ctx.lineTo(-5, 5); ctx.lineTo(-16, 0); ctx.lineTo(-5, -5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* 卡下方双行标注：位置 / 牌名 · 正逆位 · 关键词 */
  function drawCardLabels(ctx, card, x, y) {
    ctx.textAlign = "center";
    if (card.label) {
      ctx.fillStyle = "rgba(" + GOLD + ",0.95)";
      ctx.font = "26px " + SERIF;
      drawSpaced(ctx, card.label, x, y, 6);
    }
    ctx.fillStyle = "rgba(182,174,159,0.95)";
    ctx.font = "22px " + SERIF;
    var kw = card.keyword ? card.keyword[card.reversed ? "r" : "u"] : "";
    ctx.fillText(
      card.name + " · " + (card.reversed ? "逆位" : "正位") + " · " + kw,
      x, y + 34);
  }

  /* ---------------- 命运星图（全部卡牌） ---------------- */

  function drawStarChart(ctx, cards, imgs) {
    var n = cards.length;
    var hubX = W / 2, hubY = 545;
    var i, k;

    if (n === 1) {
      var c = cards[0];
      var cw = 290, chh = 483, ccx = W / 2, ccy = 840;
      /* 星环与八向节点 */
      ctx.strokeStyle = "rgba(" + GOLD + ",0.18)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 9]);
      ctx.beginPath();
      ctx.arc(ccx, ccy, 330, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      for (k = 0; k < 8; k++) {
        var a8 = (k / 8) * Math.PI * 2 + Math.PI / 8;
        ctx.fillStyle = "rgba(232,207,143,0.45)";
        ctx.beginPath();
        ctx.arc(ccx + Math.cos(a8) * 330, ccy + Math.sin(a8) * 330, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      drawHubLine(ctx, hubX, hubY, ccx, ccy - chh / 2);
      ctx.save();
      drawMiniCard(ctx, c, c.reversed, ccx, ccy, cw, chh, imgs[0], true);
      ctx.restore();
      drawCardLabels(ctx, c, ccx, ccy + chh / 2 + 46);
    } else {
      var R = n === 5 ? 430 : 420;
      var maxAng = n === 5 ? 52 : 28;
      var cwF = n === 5 ? 140 : 190;
      var chhF = Math.round(cwF * 5 / 3);

      /* 星轨（仅扇形区域） */
      var spread = (maxAng * Math.PI) / 180;
      ctx.strokeStyle = "rgba(" + GOLD + ",0.14)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 10]);
      ctx.beginPath();
      ctx.arc(hubX, hubY, R, Math.PI / 2 - spread, Math.PI / 2 + spread);
      ctx.stroke();
      ctx.setLineDash([]);

      var metas = [];
      for (i = 0; i < n; i++) {
        var frac = (i - (n - 1) / 2) / ((n - 1) / 2);
        var ang = frac * maxAng * Math.PI / 180;
        var cx = hubX + Math.sin(ang) * R;
        var cy = hubY + Math.cos(ang) * R;
        var topX = cx - Math.sin(ang) * chhF / 2;
        var topY = cy - Math.cos(ang) * chhF / 2;
        metas.push({ card: cards[i], img: imgs[i], cx: cx, cy: cy, ang: ang });
        drawHubLine(ctx, hubX, hubY, topX, topY);
      }

      for (i = 0; i < metas.length; i++) {
        var m = metas[i];
        ctx.save();
        ctx.translate(m.cx, m.cy);
        ctx.rotate(m.ang);
        drawMiniCard(ctx, m.card, m.card.reversed, 0, 0, cwF, chhF, m.img, false);
        ctx.restore();
        var downExt = Math.abs(chhF / 2 * Math.cos(m.ang)) + Math.abs(cwF / 2 * Math.sin(m.ang));
        drawCardLabels(ctx, m.card, m.cx, m.cy + downExt + 40);
      }
    }

    drawHubStar(ctx, hubX, hubY);
  }

  /* ---------------- 组装分享卡 ---------------- */

  function buildShareCard(canvas, result, seed) {
    if (!canvas) return Promise.resolve();
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");
    var rng = YTM.game.random.mulberry32((seed || 1) >>> 0);

    /* 背景 */
    var bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#141433");
    bg.addColorStop(0.5, "#0a0a1a");
    bg.addColorStop(1, "#150f2c");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* 星空 */
    var i;
    for (i = 0; i < 120; i++) {
      var x = rng() * W, y = rng() * H;
      var roll = rng();
      ctx.fillStyle = roll < 0.25
        ? "rgba(232,207,143," + (0.15 + rng() * 0.5).toFixed(2) + ")"
        : "rgba(223,228,242," + (0.1 + rng() * 0.35).toFixed(2) + ")";
      ctx.beginPath();
      ctx.arc(x, y, roll < 0.85 ? rng() * 1.6 + 0.6 : rng() * 3 + 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    /* 暗金双框 */
    ctx.strokeStyle = "rgba(" + GOLD + ",0.85)";
    ctx.lineWidth = 4;
    rr(ctx, 40, 40, W - 80, H - 80, 24);
    ctx.stroke();
    ctx.strokeStyle = "rgba(" + GOLD + ",0.4)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 9]);
    rr(ctx, 58, 58, W - 116, H - 116, 16);
    ctx.stroke();
    ctx.setLineDash([]);

    /* 四角菱形 */
    var corners = [[58, 58], [W - 58, 58], [58, H - 58], [W - 58, H - 58]];
    ctx.fillStyle = "rgba(" + GOLD + ",0.8)";
    for (i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(corners[i][0], corners[i][1]);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-7, -7, 14, 14);
      ctx.restore();
    }

    ctx.textAlign = "center";

    /* 标题区 */
    ctx.fillStyle = "#e9e4d8";
    ctx.font = "600 66px " + SERIF;
    drawSpaced(ctx, "研途秘典", W / 2, 150, 20);
    ctx.fillStyle = "rgba(182,174,159,0.95)";
    ctx.font = "26px " + SERIF;
    ctx.fillText("你的保研之路，究竟会通向哪里？", W / 2, 204);

    /* 本次占卜信息胶囊 */
    var chipText = result.themeTitle + "  ·  " + result.spreadName;
    ctx.font = "24px " + SERIF;
    var chipW = measureSpaced(ctx, chipText, 0) + 64;
    ctx.fillStyle = "rgba(201,164,92,0.08)";
    ctx.strokeStyle = "rgba(" + GOLD + ",0.5)";
    ctx.lineWidth = 1.2;
    rr(ctx, W / 2 - chipW / 2, 224, chipW, 46, 23);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(232,207,143,0.95)";
    ctx.fillText(chipText, W / 2, 255);

    /* 分隔 */
    ctx.fillStyle = "rgba(" + GOLD + ",0.8)";
    ctx.font = "24px serif";
    ctx.fillText("✦", W / 2, 306);
    ctx.strokeStyle = "rgba(" + GOLD + ",0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 230, 301);
    ctx.lineTo(W / 2 - 56, 301);
    ctx.moveTo(W / 2 + 56, 301);
    ctx.lineTo(W / 2 + 230, 301);
    ctx.stroke();

    /* 关键词区 */
    ctx.fillStyle = "rgba(" + GOLD + ",0.95)";
    ctx.font = "26px " + SERIF;
    drawSpaced(ctx, "我 的 命 运 关 键 词", W / 2, 360, 10);
    var word = result.keyword.word || "";
    ctx.save();
    ctx.shadowColor = "rgba(232,207,143,0.55)";
    ctx.shadowBlur = 32;
    ctx.fillStyle = "#e8cf8f";
    ctx.font = "700 100px " + SERIF;
    drawSpaced(ctx, "「" + word + "」", W / 2 - 140, 452, 8);
    ctx.restore();
    var kwLines = wrapText(ctx, result.keyword.line, 820);
    ctx.fillStyle = "rgba(182,174,159,0.9)";
    ctx.font = "22px " + SERIF;
    for (i = 0; i < kwLines.length; i++) {
      ctx.fillText(kwLines[i], W / 2, 500 + i * 34);
    }

    /* 印章（关键词首字） */
    ctx.save();
    ctx.translate(W / 2 + 250, 418);
    ctx.rotate(-0.09);
    ctx.fillStyle = "rgba(166,58,50,0.95)";
    rr(ctx, -54, -54, 108, 108, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(242,230,208,0.85)";
    ctx.lineWidth = 3;
    rr(ctx, -46, -46, 92, 92, 9);
    ctx.stroke();
    ctx.fillStyle = "#f2e6d0";
    ctx.font = "600 56px " + SERIF;
    ctx.fillText(word[0], 0, 21);
    ctx.restore();

    /* 底部传播语（先画，星图随后异步补绘） */
    ctx.fillStyle = "rgba(" + GOLD + ",0.8)";
    ctx.font = "24px serif";
    ctx.fillText("✦", W / 2, 1250);
    ctx.strokeStyle = "rgba(" + GOLD + ",0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 230, 1245);
    ctx.lineTo(W / 2 - 56, 1245);
    ctx.moveTo(W / 2 + 56, 1245);
    ctx.lineTo(W / 2 + 230, 1245);
    ctx.stroke();
    ctx.fillStyle = "rgba(233,228,216,0.92)";
    ctx.font = "600 34px " + SERIF;
    ctx.fillText("「你抽到的是什么？」", W / 2, 1312);
    ctx.fillStyle = "rgba(182,174,159,0.6)";
    ctx.font = "20px " + SERIF;
    drawSpaced(ctx, "研途秘典 · 保研占卜小游戏", W / 2, 1352, 4);
    ctx.fillStyle = "rgba(182,174,159,0.38)";
    ctx.font = "16px " + SERIF;
    ctx.fillText("本结果仅供娱乐，不构成升学预测", W / 2, 1378);

    /* 命运星图：全部卡牌异步加载插画后绘制（失败自动回落星图） */
    var cards = (result.drawn && result.drawn.length) ? result.drawn : [result.finalCard];
    var ids = cards.map(function (c) { return c.id || "fool"; });
    return Promise.all(ids.map(function (id) { return loadImg("assets/cards/" + id + ".jpg"); }))
      .then(function (imgs) {
        drawStarChart(ctx, cards, imgs);
      });
  }

  function download(canvas) {
    if (!canvas || typeof canvas.toBlob !== "function") return;
    canvas.toBlob(function (blob) {
      if (!blob) return;
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "研途命运卡.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }, "image/png");
  }

  /* 复制到剪贴板；不支持时返回 rejected Promise，由调用方隐藏按钮 */
  function copy(canvas) {
    return new Promise(function (resolve, reject) {
      if (!canvas || !navigator.clipboard || typeof window.ClipboardItem !== "function") {
        reject(new Error("unsupported"));
        return;
      }
      canvas.toBlob(function (blob) {
        if (!blob) { reject(new Error("blob failed")); return; }
        navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })])
          .then(resolve)
          .catch(reject);
      }, "image/png");
    });
  }

  YTM.ui.share = {
    buildShareCard: buildShareCard,
    download: download,
    copy: copy
  };
})(typeof window !== "undefined" ? window : globalThis);
