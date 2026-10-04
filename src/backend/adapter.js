/* ============================================================
   研途秘典 · 后端统一接口
   根据 config.backend 自动选择：
   - provider="worker" → Cloudflare Worker 云端模式（推荐）
   - 填了 envId → CloudBase 云端模式（旧方案，保留兼容）
   - 都未配置 → 本地演示模式（游戏照常单机运行）
   游戏核心代码只与本文件交互，不感知具体后端。
   ============================================================ */
(function (global) {
  "use strict";
  var YTM = global.YTM = global.YTM || {};

  function deviceId() {
    /* 优先使用适配器自己的设备标识（如 Worker 后端由服务端签发） */
    try {
      var im = impl();
      if (im && typeof im.deviceId === "function") return im.deviceId();
    } catch (e) { /* 回退到本地 UUID */ }
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
    if (cfg.provider === "worker" && YTM.backend.impl.worker) return YTM.backend.impl.worker;
    if (cfg.envId && YTM.backend.impl.cloudbase) return YTM.backend.impl.cloudbase;
    return YTM.backend.impl.local;
  }

  var api = {
    deviceId: deviceId,

    /* 是否已配置云端（Worker 模式恒为 true；CloudBase 模式看 envId） */
    isCloud: function () {
      var cfg = (YTM.config && YTM.config.backend) || {};
      if (cfg.provider === "worker") return true;
      return !!cfg.envId;
    },

    /* "cloud" | "demo" */
    mode: function () { return impl().mode(); },

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

    /* 登录态刷新（会话失效时清除本地记忆） */
    refreshAuthState: function () { return impl().refreshAuthState(); },

    saveReading: function (entry) { return impl().saveReading(entry); },
    listReadings: function (limit) { return impl().listReadings(limit); },

    postWish: function (text, keyword) { return impl().postWish(text, keyword); },
    listWishes: function (limit) { return impl().listWishes(limit); },
    lightWish: function (id) { return impl().lightWish(id); }
  };

  YTM.backend.api = api;
})(typeof window !== "undefined" ? window : globalThis);
