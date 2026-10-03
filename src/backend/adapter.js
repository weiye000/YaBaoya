/* ============================================================
   研途秘典 · 后端统一接口
   根据 config.backend 自动选择：
   - 填了 envId → CloudBase 云端模式（匿名登录 + 同步码）
   - 未填 → 本地演示模式（游戏照常单机运行）
   游戏核心代码只与本文件交互，不感知具体后端。
   ============================================================ */
(function (global) {
  "use strict";
  var YTM = global.YTM = global.YTM || {};

  function deviceId() {
    try {
      var id = global.localStorage.getItem("ytm_device_id");
      if (!id) {
        id = (global.crypto && global.crypto.randomUUID)
          ? global.crypto.randomUUID()
          : "d-" + Date.now() + "-" + Math.floor(Math.random() * 1e6);
        global.localStorage.setItem("ytm_device_id", id);
      }
      return id;
    } catch (e) {
      return "d-unknown";
    }
  }

  function impl() {
    var cfg = (YTM.config && YTM.config.backend) || {};
    return cfg.envId ? YTM.backend.impl.cloudbase : YTM.backend.impl.local;
  }

  var api = {
    deviceId: deviceId,

    /* 是否已配置云端 */
    isCloud: function () {
      var cfg = (YTM.config && YTM.config.backend) || {};
      return !!cfg.envId;
    },

    /* "cloud" | "demo" */
    mode: function () { return impl().mode; },

    ready: function () { return impl().ready(); },

    /* 同步码（未登录访客的跨设备钥匙） */
    hasCloud: function () { return impl().hasCloud(); },
    getSyncCode: function () { return impl().getSyncCode(); },
    bindSyncCode: function (code) { return impl().bindSyncCode(code); },
    resetSyncCode: function () { return impl().resetSyncCode(); },

    /* 账号（自定义登录） */
    user: function () { return impl().user(); },
    loginState: function () { return impl().loginState(); },
    login: function (u, p) { return impl().login(u, p); },
    register: function (u, p) { return impl().register(u, p); },
    logout: function () { return impl().logout(); },

    /* 管理员（云端校验令牌） */
    isAdmin: function () { return impl().isAdmin(); },
    adminStats: function () { return impl().adminStats(); },
    adminDeleteWish: function (id) { return impl().adminDeleteWish(id); },

    saveReading: function (entry) { return impl().saveReading(entry); },
    listReadings: function (limit) { return impl().listReadings(limit); },

    postWish: function (text, keyword) { return impl().postWish(text, keyword); },
    listWishes: function (limit) { return impl().listWishes(limit); },
    lightWish: function (id) { return impl().lightWish(id); }
  };

  YTM.backend.api = api;
})(typeof window !== "undefined" ? window : globalThis);
