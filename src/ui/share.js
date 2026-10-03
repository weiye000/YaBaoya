/* ============================================================
   研途秘典 · 研途命运卡（Canvas 分享图 1080×1440）
   纯 Canvas 绘制：星空底 + 暗金双框 + 关键词 + 印章 + 迷你卡面
   ============================================================ */
(function (global) {
  "use strict";
  var YTM = global.YTM = global.YTM || {};
  YTM.ui = YTM.ui || {};

  var W = 1080, H = 1440;
  var GOLD = "201,164,92";
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
    rr(ctx, cx - w / 2, cy - h / 2, w, h, 18);
    ctx.clip();
    ctx.drawImage(img, sx, sy, sw, sh, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  }

  function drawMiniCard(ctx, card, reversed, cx, cy, w, h, artImg) {
    var p = card.palette || ["#c9a45c", "#2a2a5e"];
    var grad = ctx.createLinearGradient(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
    grad.addColorStop(0, p[0]);
    grad.addColorStop(1, p[1]);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 40;
    ctx.fillStyle = grad;
    rr(ctx, cx - w / 2, cy - h / 2, w, h, 18);
    ctx.fill();
    ctx.restore();

    if (artImg) {
      /* 真实插画 */
      drawCoverImage(ctx, artImg, cx, cy, w, h);
    } else {
      /* 星图兜底 + 编号 */
      var s = YTM.ui.cards.sigilPoints(card.no * 7919 + 17);
      var scale = (w * 0.52) / 96;
      ctx.save();
      ctx.translate(cx, cy - h * 0.1);
      ctx.scale(scale, scale);
      ctx.strokeStyle = "rgba(232,207,143,0.55)";
      ctx.lineWidth = 1.6 / scale;
      var i, a, b;
      for (i = 0; i < s.links.length; i++) {
        a = s.pts[s.links[i][0]]; b = s.pts[s.links[i][1]];
        ctx.beginPath();
        ctx.moveTo(a[0] - 48, a[1] - 48);
        ctx.lineTo(b[0] - 48, b[1] - 48);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(232,207,143,0.95)";
      for (i = 0; i < s.pts.length; i++) {
        ctx.beginPath();
        ctx.arc(s.pts[i][0] - 48, s.pts[i][1] - 48, i === 0 ? 5 / scale : 2.6 / scale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = "rgba(232,207,143,0.95)";
      ctx.font = "22px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText(ROMANS[card.no] || String(card.no), cx, cy - h / 2 + 46);
    }

    /* 底部名牌渐变 */
    var plate = ctx.createLinearGradient(0, cy + h * 0.18, 0, cy + h / 2);
    plate.addColorStop(0, "rgba(11,11,28,0)");
    plate.addColorStop(0.5, "rgba(11,11,28,0.8)");
    plate.addColorStop(1, "rgba(11,11,28,0.96)");
    ctx.fillStyle = plate;
    ctx.fillRect(cx - w / 2, cy + h * 0.18, w, h * 0.32);

    /* 逆位徽章 */
    if (reversed) {
      ctx.save();
      ctx.fillStyle = "#a63a32";
      rr(ctx, cx - w / 2 + 22, cy - h / 2 + 30, 84, 38, 8);
      ctx.fill();
      ctx.fillStyle = "#f2e6d0";
      ctx.font = "24px 'Noto Serif SC','Songti SC',serif";
      ctx.fillText("逆位", cx - w / 2 + 64, cy - h / 2 + 57);
      ctx.restore();
    }

    /* 金色边框 */
    ctx.strokeStyle = "rgba(" + GOLD + ",0.9)";
    ctx.lineWidth = 2.5;
    rr(ctx, cx - w / 2, cy - h / 2, w, h, 18);
    ctx.stroke();
    ctx.strokeStyle = "rgba(" + GOLD + ",0.35)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 7]);
    rr(ctx, cx - w / 2 + 12, cy - h / 2 + 12, w - 24, h - 24, 12);
    ctx.stroke();
    ctx.setLineDash([]);

    /* 牌名与关键词 */
    ctx.fillStyle = "#e9e4d8";
    ctx.font = "500 46px 'Noto Serif SC','Songti SC',serif";
    ctx.textAlign = "center";
    ctx.fillText(card.name, cx, cy + h / 2 - 64);
    ctx.fillStyle = "rgba(232,207,143,0.9)";
    ctx.font = "26px 'Noto Serif SC','Songti SC',serif";
    ctx.fillText(card.keyword[reversed ? "r" : "u"], cx, cy + h / 2 - 22);
  }

  function buildShareCard(canvas, result, seed) {
    if (!canvas) return Promise.resolve();
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");
    var rng = YTM.game.random.mulberry32((seed || 1) >>> 0);

    /* 背景 */
    var bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#131330");
    bg.addColorStop(0.55, "#0a0a1a");
    bg.addColorStop(1, "#150f2c");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* 星空 */
    var i;
    for (i = 0; i < 110; i++) {
      var x = rng() * W, y = rng() * H;
      var rr2 = rng();
      var goldish = rr2 < 0.25;
      ctx.fillStyle = goldish
        ? "rgba(232,207,143," + (0.15 + rng() * 0.5).toFixed(2) + ")"
        : "rgba(223,228,242," + (0.1 + rng() * 0.35).toFixed(2) + ")";
      ctx.beginPath();
      ctx.arc(x, y, rr2 < 0.85 ? rng() * 1.6 + 0.6 : rng() * 3 + 1.6, 0, Math.PI * 2);
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

    /* 标题 */
    ctx.fillStyle = "#e9e4d8";
    ctx.font = "600 74px 'Noto Serif SC','Songti SC',serif";
    drawSpaced(ctx, "研途秘典", W / 2, 205, 22);
    ctx.fillStyle = "rgba(182,174,159,0.95)";
    ctx.font = "30px 'Noto Serif SC','Songti SC',serif";
    ctx.fillText("你的保研之路，究竟会通向哪里？", W / 2, 268);

    /* 分隔 */
    ctx.fillStyle = "rgba(" + GOLD + ",0.8)";
    ctx.font = "26px serif";
    ctx.fillText("✦", W / 2, 336);
    ctx.strokeStyle = "rgba(" + GOLD + ",0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 250, 331);
    ctx.lineTo(W / 2 - 60, 331);
    ctx.moveTo(W / 2 + 60, 331);
    ctx.lineTo(W / 2 + 250, 331);
    ctx.stroke();

    /* 关键词 */
    ctx.fillStyle = "rgba(" + GOLD + ",0.95)";
    ctx.font = "30px 'Noto Serif SC','Songti SC',serif";
    ctx.fillText("我 的 命 运 关 键 词", W / 2, 420);
    var word = result.keyword.word || "";
    ctx.save();
    ctx.shadowColor = "rgba(232,207,143,0.55)";
    ctx.shadowBlur = 34;
    ctx.fillStyle = "#e8cf8f";
    ctx.font = "700 130px 'Noto Serif SC','Songti SC',serif";
    /* 关键词整体左移，右侧留位给印章，避免压字 */
    drawSpaced(ctx, "「" + word + "」", W / 2 - 150, 545, 10);
    ctx.restore();

    /* 关键词释义 */
    var lines = wrapText(ctx, result.keyword.line, 860);
    ctx.fillStyle = "rgba(182,174,159,0.95)";
    ctx.font = "28px 'Noto Serif SC','Songti SC',serif";
    var ly = 610;
    for (i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], W / 2, ly + i * 42);
    }

    /* 印章（关键词首字，固定于关键词右侧） */
    ctx.save();
    ctx.translate(W / 2 + 250, 545);
    ctx.rotate(-0.09);
    ctx.fillStyle = "rgba(166,58,50,0.95)";
    rr(ctx, -62, -62, 124, 124, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(242,230,208,0.85)";
    ctx.lineWidth = 3;
    rr(ctx, -52, -52, 104, 104, 10);
    ctx.stroke();
    ctx.fillStyle = "#f2e6d0";
    ctx.font = "600 64px 'Noto Serif SC','Songti SC',serif";
    ctx.fillText(word[0], 0, 24);
    ctx.restore();

    /* 分隔 */
    ctx.fillStyle = "rgba(" + GOLD + ",0.8)";
    ctx.font = "26px serif";
    ctx.fillText("✦", W / 2, 705);
    ctx.strokeStyle = "rgba(" + GOLD + ",0.4)";
    ctx.beginPath();
    ctx.moveTo(W / 2 - 250, 700);
    ctx.lineTo(W / 2 - 60, 700);
    ctx.moveTo(W / 2 + 60, 700);
    ctx.lineTo(W / 2 + 250, 700);
    ctx.stroke();

    /* 今日命运牌 */
    ctx.fillStyle = "rgba(" + GOLD + ",0.95)";
    ctx.font = "30px 'Noto Serif SC','Songti SC',serif";
    ctx.fillText("今 日 命 运 牌", W / 2, 772);
    ctx.fillStyle = "rgba(232,207,143,0.95)";
    ctx.font = "30px 'Noto Serif SC','Songti SC',serif";
    ctx.fillText(
      result.finalCard.name + " · " + (result.finalCard.reversed ? "逆位" : "正位") + " · " + result.finalCard.keywordWord,
      W / 2, 1300);

    /* 底部传播语 */
    ctx.fillStyle = "rgba(233,228,216,0.92)";
    ctx.font = "600 32px 'Noto Serif SC','Songti SC',serif";
    ctx.fillText("「你抽到的是什么？」", W / 2, 1368);
    ctx.fillStyle = "rgba(182,174,159,0.6)";
    ctx.font = "22px 'Noto Serif SC','Songti SC',serif";
    ctx.fillText("研 途 秘 典 · 保研占卜小游戏", W / 2, 1398);

    /* 迷你命运牌：插画异步加载（失败自动回落星图），画完即补绘到同一画布 */
    var card = result.finalCard;
    var src = "assets/cards/" + (card.id || "fool") + ".jpg";
    return loadImg(src).then(function (img) {
      drawMiniCard(ctx, card, card.reversed, W / 2, 1030, 270, 450, img);
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
