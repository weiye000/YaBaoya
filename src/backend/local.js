/* ============================================================
   研途秘典 · 本地后端适配器（单机 / 演示模式）
   未配置 CloudBase 时的默认实现：
   - 图鉴：由本地命运簿计算（照常可用）
   - 命运簿：localStorage（照常可用）
   - 心事墙：演示模式，展示示例数据 + 明确提示
   ============================================================ */
(function (global) {
  "use strict";
  var YTM = global.YTM = global.YTM || {};
  YTM.backend = YTM.backend || {};
  YTM.backend.impl = YTM.backend.impl || {};

  var WISH_KEY = "ytm_wishes";
  var LIGHT_KEY = "ytm_lights";

  var DEMO_WISHES = [
    { id: "demo-1", text: "夏令营被拒了两次，突然不知道自己还行不行。", keyword: "等待", lights: 132, mine: false },
    { id: "demo-2", text: "绩点刚好卡在边缘，每天都在算小数点后两位。", keyword: "焦虑", lights: 98, mine: false },
    { id: "demo-3", text: "祝看到这条的你，最后都能去想去的地方。", keyword: "希望", lights: 207, mine: false }
  ];

  function load(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* 忽略 */ }
  }

  YTM.backend.impl.local = {
    mode: "demo",

    ready: function () { return Promise.resolve(true); },

    hasCloud: function () { return false; },
    getSyncCode: function () { return null; },
    bindSyncCode: function () { return Promise.reject(new Error("demo")); },
    resetSyncCode: function () { return Promise.resolve(); },

    user: function () { return null; },
    loginState: function () { return Promise.resolve(null); },
    login: function () { return Promise.reject(new Error("demo")); },
    register: function () { return Promise.reject(new Error("demo")); },
    logout: function () { return Promise.resolve(); },
    isAdmin: function () { return false; },
    adminStats: function () { return Promise.reject(new Error("demo")); },
    adminDeleteWish: function () { return Promise.reject(new Error("demo")); },
    refreshAuthState: function () { return Promise.resolve(null); },

    listReadings: function () { return Promise.resolve([]); },
    saveReading: function () { return Promise.resolve(null); },

    postWish: function (text, keyword) {
      var wishes = load(WISH_KEY, []);
      var w = {
        id: "local-" + Date.now(),
        ts: Date.now(),
        text: text,
        keyword: keyword || "心事",
        lights: 0,
        mine: true
      };
      wishes.unshift(w);
      save(WISH_KEY, wishes.slice(0, 50));
      return Promise.resolve(w);
    },

    listWishes: function () {
      var mine = load(WISH_KEY, []);
      var lit = load(LIGHT_KEY, []);
      var all = DEMO_WISHES.map(function (d) {
        return { id: d.id, text: d.text, keyword: d.keyword, lights: d.lights, mine: false, lit: lit.indexOf(d.id) !== -1 };
      }).concat(mine.map(function (m) {
        return { id: m.id, text: m.text, keyword: m.keyword, lights: m.lights, mine: true, lit: lit.indexOf(m.id) !== -1 };
      }));
      return Promise.resolve(all);
    },

    lightWish: function (id) {
      var lit = load(LIGHT_KEY, []);
      if (lit.indexOf(id) !== -1) return Promise.reject(new Error("已点亮"));
      lit.push(id);
      save(LIGHT_KEY, lit);
      return Promise.resolve();
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
