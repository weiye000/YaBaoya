/* ============================================================
   研途秘典 · 星空粒子背景
   Canvas 双圈辉光星点，缓慢漂移 + 闪烁；低性能设备自动降级
   ============================================================ */
(function (global) {
  "use strict";
  var YTM = global.YTM = global.YTM || {};
  YTM.ui = YTM.ui || {};

  var COLORS = {
    white: "223,228,242",
    gold: "232,207,143",
    violet: "139,123,216"
  };

  function init(canvas) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var reduceMotion = false;
    try {
      reduceMotion = global.matchMedia &&
        global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) { /* 忽略 */ }

    var stars = [];
    var W = 0, H = 0, dpr = 1, raf = 0, last = 0, running = false;

    function resize() {
      dpr = Math.min(global.devicePixelRatio || 1, 2);
      W = canvas.clientWidth || global.innerWidth;
      H = canvas.clientHeight || global.innerHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function seed() {
      stars.length = 0;
      var n = Math.min(200, Math.max(70, Math.floor((W * H) / 7000)));
      for (var i = 0; i < n; i++) {
        var layer = Math.random();
        var color;
        var roll = Math.random();
        if (roll < 0.14) color = "gold";
        else if (roll < 0.32) color = "violet";
        else color = "white";
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: layer < 0.85 ? Math.random() * 0.8 + 0.3 : Math.random() * 1.5 + 0.9,
          a: Math.random() * 0.45 + 0.22,
          tw: Math.random() * Math.PI * 2,
          ts: 0.00035 + Math.random() * 0.0011,
          vx: 0.004 + layer * 0.013,
          big: layer >= 0.85,
          color: color
        });
      }
    }

    function drawStar(s) {
      var alpha = s.a * (0.62 + 0.38 * Math.sin(s.tw));
      ctx.fillStyle = "rgba(" + COLORS[s.color] + "," + alpha.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      if (s.big) {
        ctx.fillStyle = "rgba(" + COLORS[s.color] + "," + (alpha * 0.22).toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function frame(t) {
      raf = 0;
      if (document.hidden) { schedule(); return; }
      var dt = last ? Math.min(40, t - last) : 16;
      last = t;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        if (!reduceMotion) {
          s.x += s.vx * dt * 0.06;
          s.tw += s.ts * dt;
          if (s.x > W + 4) { s.x = -4; s.y = Math.random() * H; }
        }
        drawStar(s);
      }
      schedule();
    }

    function schedule() {
      if (!raf) raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      resize();
      schedule();
    }

    function stop() {
      running = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }

    global.addEventListener("resize", function () {
      if (running) resize();
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop();
      else if (!running) start();
    });

    start();
  }

  YTM.ui.starfield = { init: init };
})(typeof window !== "undefined" ? window : globalThis);
