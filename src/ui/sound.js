/* ============================================================
   研途秘典 · 音效（WebAudio 合成，无需音频文件）
   默认静音；右上角开关切换，偏好存入 localStorage。
   如需替换为真实音频，请见 assets/sounds/README.md。
   ============================================================ */
(function (global) {
  "use strict";
  var YTM = global.YTM = global.YTM || {};
  YTM.ui = YTM.ui || {};

  var ctx = null, master = null, enabled = false;
  var KEY = "ytm_sound";

  function ensure() {
    if (!ctx) {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") {
      try { ctx.resume(); } catch (e) { /* 忽略 */ }
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, delay, glideTo) {
    var c = ensure();
    if (!c) return;
    var t0 = c.currentTime + (delay || 0);
    var o = c.createOscillator();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.1, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function swoosh() {
    var c = ensure();
    if (!c) return;
    var dur = 0.3, t0 = c.currentTime;
    var buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource();
    src.buffer = buf;
    var f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(320, t0);
    f.frequency.exponentialRampToValueAtTime(1900, t0 + dur * 0.6);
    f.frequency.exponentialRampToValueAtTime(420, t0 + dur);
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  function play(name) {
    if (!enabled) return;
    try {
      switch (name) {
        case "click":
          tone(680, 0.06, "sine", 0.07);
          tone(1020, 0.05, "sine", 0.05, 0.03);
          break;
        case "draw":
          swoosh();
          break;
        case "flip":
          tone(300, 0.08, "triangle", 0.1);
          tone(190, 0.1, "triangle", 0.09, 0.07);
          break;
        case "reveal":
          tone(880, 0.6, "sine", 0.08, 0, 660);
          tone(1318, 0.7, "sine", 0.06, 0.09, 990);
          break;
        case "result":
          tone(523.25, 0.3, "sine", 0.08, 0);
          tone(659.25, 0.3, "sine", 0.08, 0.1);
          tone(783.99, 0.35, "sine", 0.08, 0.2);
          tone(1046.5, 0.6, "sine", 0.07, 0.3);
          break;
        default:
          break;
      }
    } catch (e) {
      /* 音频上下文创建失败等边缘情况：静默降级，绝不影响游戏流程 */
    }
  }

  function setEnabled(v) {
    enabled = !!v;
    try { global.localStorage.setItem(KEY, enabled ? "1" : "0"); } catch (e) { /* 忽略 */ }
  }

  function isEnabled() { return enabled; }

  function init() {
    try { enabled = global.localStorage.getItem(KEY) === "1"; } catch (e) { enabled = false; }
  }

  YTM.ui.sound = {
    init: init,
    play: play,
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    unlock: ensure
  };
})(typeof window !== "undefined" ? window : globalThis);
