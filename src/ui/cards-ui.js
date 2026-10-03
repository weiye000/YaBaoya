/* ============================================================
   研途秘典 · 卡面渲染（程序化 SVG，零图片资源）
   - 每张牌的「星图徽记」由卡牌编号作为种子程序化生成，22 张各不同
   - 牌背：靛蓝底 + 暗金晶格 + 八芒星法阵
   ============================================================ */
(function (global) {
  "use strict";
  var YTM = global.YTM = global.YTM || {};
  YTM.ui = YTM.ui || {};

  var GOLD = "#c9a45c";
  var GOLD_2 = "#e8cf8f";
  var INK = "#e9e4d8";

  /* 星图徽记：以种子生成星座点与连线（中心 48,48，范围 96×96） */
  function sigilPoints(seed) {
    var r = YTM.game.random.mulberry32(seed >>> 0);
    var n = 7 + Math.floor(r() * 2);
    var pts = [];
    var i, j;
    for (i = 0; i < n; i++) {
      var ang = (i / n) * Math.PI * 2 + r() * 0.6;
      var rad = 27 + r() * 16;
      pts.push([48 + Math.cos(ang) * rad, 48 + Math.sin(ang) * rad]);
    }
    var links = [];
    for (i = 0; i < n; i++) {
      var dists = [];
      for (j = 0; j < n; j++) {
        if (j === i) continue;
        var dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1];
        dists.push({ j: j, d: dx * dx + dy * dy });
      }
      dists.sort(function (a, b) { return a.d - b.d; });
      var want = 1 + Math.floor(r() * 2);
      for (var k = 0; k < Math.min(want, dists.length); k++) {
        var pair = [Math.min(i, dists[k].j), Math.max(i, dists[k].j)];
        var dup = links.some(function (l) { return l[0] === pair[0] && l[1] === pair[1]; });
        if (!dup) links.push(pair);
      }
    }
    return { pts: pts, links: links };
  }

  function sigilSVG(seed, color) {
    var s = sigilPoints(seed);
    var parts = [
      '<circle cx="48" cy="48" r="45" fill="none" stroke="' + color + '" stroke-opacity="0.25" stroke-width="1" stroke-dasharray="2 5"/>'
    ];
    for (var i = 0; i < s.links.length; i++) {
      var a = s.pts[s.links[i][0]], b = s.pts[s.links[i][1]];
      parts.push('<line x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) +
        '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) +
        '" stroke="' + color + '" stroke-opacity="0.5" stroke-width="0.9"/>');
    }
    for (var j = 0; j < s.pts.length; j++) {
      var p = s.pts[j];
      if (j === 0) {
        parts.push('<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.6" fill="' + color + '"/>');
        parts.push('<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="5.5" fill="none" stroke="' + color + '" stroke-opacity="0.45" stroke-width="0.8"/>');
      } else {
        parts.push('<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="1.4" fill="' + color + '"/>');
      }
    }
    return parts.join("");
  }

  /* 牌面 SVG（240 × 400）：真实插画 + 程序化星图兜底 */
  function cardFaceSVG(card, reversed) {
    var p = card.palette || [GOLD, "#2a2a5e"];
    var kw = card.keyword[reversed ? "r" : "u"];
    var gid = "ytm-grad-" + card.id;
    var pid = "ytm-plate-" + card.id;
    var badge = reversed
      ? '<g><rect x="24" y="30" width="46" height="21" rx="5" fill="#a63a32"/>' +
        '<text x="47" y="45" text-anchor="middle" font-size="12" fill="#f2e6d0" letter-spacing="2" font-family="serif">逆位</text></g>'
      : "";
    return '<svg viewBox="0 0 240 400" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' +
      '<linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + p[0] + '" stop-opacity="0.92"/>' +
      '<stop offset="1" stop-color="' + p[1] + '" stop-opacity="1"/></linearGradient>' +
      '<linearGradient id="' + pid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#0b0b1c" stop-opacity="0"/>' +
      '<stop offset="0.45" stop-color="#0b0b1c" stop-opacity="0.72"/>' +
      '<stop offset="1" stop-color="#0b0b1c" stop-opacity="0.96"/></linearGradient>' +
      '</defs>' +
      '<rect x="8" y="8" width="224" height="384" rx="16" fill="url(#' + gid + ')"/>' +
      /* 星图兜底：插画加载失败时可见 */
      '<g transform="translate(72 106)">' + sigilSVG(card.no * 7919 + 17, GOLD_2) + '</g>' +
      /* 真实插画（按内框比例裁剪填充） */
      '<image href="assets/cards/' + card.id + '.jpg" x="16" y="16" width="208" height="368" preserveAspectRatio="xMidYMid slice"/>' +
      /* 底部名牌（保证牌名与关键词可读） */
      '<rect x="16" y="268" width="208" height="116" fill="url(#' + pid + ')"/>' +
      '<rect x="8" y="8" width="224" height="384" rx="16" fill="none" stroke="' + GOLD + '" stroke-opacity="0.9" stroke-width="1.2"/>' +
      '<rect x="16" y="16" width="208" height="368" rx="11" fill="none" stroke="' + GOLD + '" stroke-opacity="0.35" stroke-width="0.8" stroke-dasharray="3 4"/>' +
      badge +
      '<text x="120" y="330" text-anchor="middle" font-size="27" fill="' + INK + '" letter-spacing="5" font-family="\'Noto Serif SC\',\'Songti SC\',serif">' + card.name + '</text>' +
      '<text x="120" y="364" text-anchor="middle" font-size="13" fill="' + GOLD_2 + '" letter-spacing="8" font-family="\'Noto Serif SC\',\'Songti SC\',serif">' + kw + '</text>' +
      '</svg>';
  }

  /* 牌背 SVG（240 × 400）；uid 用于避免同页多张牌背出现重复 SVG id */
  function cardBackSVG(uid) {
    var u = uid == null ? "0" : String(uid);
    return '<svg viewBox="0 0 240 400" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' +
      '<linearGradient id="ytm-back-g-' + u + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#1d1d44"/><stop offset="1" stop-color="#0c0c1e"/></linearGradient>' +
      '<pattern id="ytm-lattice-' + u + '" width="22" height="22" patternUnits="userSpaceOnUse">' +
      '<path d="M0 11 L22 11 M11 0 L11 22 M0 0 L22 22 M22 0 L0 22" stroke="' + GOLD + '" stroke-opacity="0.1" stroke-width="0.7"/></pattern>' +
      '</defs>' +
      '<rect x="8" y="8" width="224" height="384" rx="16" fill="url(#ytm-back-g-' + u + ')"/>' +
      '<rect x="8" y="8" width="224" height="384" rx="16" fill="none" stroke="' + GOLD + '" stroke-opacity="0.85" stroke-width="1.2"/>' +
      '<rect x="16" y="16" width="208" height="368" rx="11" fill="url(#ytm-lattice-' + u + ')"/>' +
      '<rect x="16" y="16" width="208" height="368" rx="11" fill="none" stroke="' + GOLD + '" stroke-opacity="0.3" stroke-width="0.8"/>' +
      '<g transform="translate(120 168)" fill="none" stroke="' + GOLD + '" stroke-opacity="0.55">' +
      '<circle r="56" stroke-width="0.9" stroke-dasharray="3 6"/>' +
      '<circle r="44" stroke-width="0.7"/>' +
      '<rect x="-44" y="-44" width="88" height="88" stroke-width="0.7"/>' +
      '<rect x="-31" y="-31" width="62" height="62" stroke-width="0.7" transform="rotate(45)"/>' +
      '<circle r="20" stroke-width="0.7" stroke-dasharray="2 4"/></g>' +
      '<circle cx="120" cy="168" r="7" fill="' + GOLD_2 + '" fill-opacity="0.85"/>' +
      '<text x="120" y="300" text-anchor="middle" font-size="20" fill="' + GOLD_2 + '" letter-spacing="6" font-family="\'Noto Serif SC\',\'Songti SC\',serif">研</text>' +
      '<text x="120" y="330" text-anchor="middle" font-size="10" fill="' + GOLD + '" fill-opacity="0.7" letter-spacing="5" font-family="\'Noto Serif SC\',serif">研 途 秘 典</text>' +
      '</svg>';
  }

  YTM.ui.cards = {
    cardFaceSVG: cardFaceSVG,
    cardBackSVG: cardBackSVG,
    sigilPoints: sigilPoints,
    sigilSVG: sigilSVG
  };
})(typeof window !== "undefined" ? window : globalThis);
