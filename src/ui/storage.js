/* ============================================================
   研途秘典 · 命运簿（本地历史记录）
   localStorage 保存最近 30 次占卜，可随时回看完整结果。
   ============================================================ */
(function (global) {
  "use strict";
  var YTM = global.YTM = global.YTM || {};
  YTM.ui = YTM.ui || {};

  var KEY = "ytm_history";
  var MAX = 30;

  function load() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function persist(arr) {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(arr));
    } catch (e) {
      /* 存储已满或不可用：静默失败，不影响游戏 */
    }
  }

  function addReading(reading, result) {
    if (!reading || !result) return;
    var entry = {
      ts: reading.ts,
      seed: reading.seed,
      themeId: reading.theme.id,
      themeTitle: reading.theme.title,
      spreadId: reading.spread.id,
      spreadName: reading.spread.name,
      keyword: result.keyword.word,
      finalCardName: result.finalCard.name,
      reading: reading,
      result: result
    };
    var arr = load();
    arr = arr.filter(function (e) { return e && e.ts !== entry.ts; });
    arr.unshift(entry);
    arr = arr.slice(0, MAX);
    persist(arr);
    return entry;
  }

  function getHistory() { return load(); }

  function removeByTs(ts) {
    var arr = load().filter(function (e) { return e.ts !== ts; });
    persist(arr);
  }

  function clear() {
    try { global.localStorage.removeItem(KEY); } catch (e) { /* 忽略 */ }
  }

  YTM.ui.storage = {
    addReading: addReading,
    getHistory: getHistory,
    removeByTs: removeByTs,
    clear: clear
  };
})(typeof window !== "undefined" ? window : globalThis);
