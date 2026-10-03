/* ============================================================
   研途秘典 · CloudBase 后端适配器（云端模式）
   同时兼容：
   - 腾讯云开发 CloudBase 环境：匿名登录（无感）
   - 微信云开发环境（小程序云开发，Web 端接入）：未登录模式
     —— 微信云开发环境通常不支持匿名登录，登录失败自动降级为
        未登录模式继续执行；此时集合权限需用自定义规则
        { "read": true, "write": true }（见 README）
   - SDK 按需动态加载（未配置时不加载，零开销）
   - 云命运簿：readings 集合，按 8 位「同步码」存取（同步码即隐私钥匙）
   - 心事墙：wishes 集合；点亮：lights 集合（_id 天然防重复）
   ============================================================ */
(function (global) {
  "use strict";
  var YTM = global.YTM = global.YTM || {};
  YTM.backend = YTM.backend || {};
  YTM.backend.impl = YTM.backend.impl || {};

  var app = null;
  var db = null;
  var auth = null;
  var ready = false;
  var loading = null;
  var SCRIPT = "https://static.cloudbase.net/cloudbase-js-sdk/latest/cloudbase.full.js";
  var CODE_KEY = "ytm_sync_code";

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("CloudBase SDK 加载失败，请检查网络")); };
      document.head.appendChild(s);
    });
  }

  /* 建立会话：匿名登录失败（微信云开发环境）自动降级为未登录模式 */
  function ensureSession() {
    return init(YTM.config.backend).then(function (ok) {
      if (!ok) throw new Error("云服务未就绪");
      return auth.getLoginState().then(function (state) {
        if (state) return state;
        return auth.anonymousAuthProvider().signIn();
      }).catch(function () {
        return null; /* 未登录模式：不登录也可读写（依赖集合公开读写规则） */
      });
    });
  }

  function init(cfg) {
    if (!cfg || !cfg.envId) return Promise.resolve(false);
    if (ready) return Promise.resolve(true);
    if (loading) return loading;
    loading = loadScript(SCRIPT).then(function () {
      var tcb = global.cloudbase;
      if (!tcb) throw new Error("SDK 未就绪");
      app = tcb.init({ env: cfg.envId });
      db = app.database();
      auth = app.auth({ persistence: "local" });
      ready = true;
      return true;
    }).catch(function (err) {
      console.error("[backend] CloudBase 初始化失败:", err);
      return false;
    });
    return loading;
  }

  /* 8 位同步码（去掉易混淆字符） */
  function newCode() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var code = "";
    for (var i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  function getSyncCode() {
    try {
      var code = global.localStorage.getItem(CODE_KEY);
      if (code) return code;
      code = newCode();
      global.localStorage.setItem(CODE_KEY, code);
      return code;
    } catch (e) {
      return "DEMO0000";
    }
  }

  function bindSyncCode(code) {
    code = String(code || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{8}$/.test(code)) return Promise.reject(new Error("同步码格式不对（8 位字母数字）"));
    try { global.localStorage.setItem(CODE_KEY, code); } catch (e) { /* 忽略 */ }
    return Promise.resolve(code);
  }

  function resetSyncCode() {
    try { global.localStorage.setItem(CODE_KEY, newCode()); } catch (e) { /* 忽略 */ }
    return Promise.resolve(getSyncCode());
  }

  /* 调用云函数 auth（注册/登录） */
  function callAuth(action, payload) {
    return ensureSession().then(function () {
      var data = { action: action };
      if (payload) {
        data.username = payload.username;
        data.password = payload.password;
      }
      return app.callFunction({ name: "auth", data: data });
    }).then(function (res) {
      var r = res && res.result;
      if (!r || r.code !== 0) {
        throw new Error((r && r.message) || "云函数调用失败");
      }
      return r;
    });
  }

  var USER_KEY = "ytm_username";

  function rememberUser(name) {
    try { global.localStorage.setItem(USER_KEY, String(name)); } catch (e) { /* 忽略 */ }
  }

  function forgetUser() {
    try { global.localStorage.removeItem(USER_KEY); } catch (e) { /* 忽略 */ }
  }

  function rememberedUser() {
    try { return global.localStorage.getItem(USER_KEY); } catch (e) { return null; }
  }

  YTM.backend.impl.cloudbase = {
    mode: "cloud",

    ready: function () {
      return init(YTM.config && YTM.config.backend);
    },

    hasCloud: function () { return true; },
    getSyncCode: getSyncCode,
    bindSyncCode: bindSyncCode,
    resetSyncCode: resetSyncCode,

    /* ---------------- 账号（自定义登录） ---------------- */

    login: function (username, password) {
      return callAuth("login", { username: username, password: password }).then(function (r) {
        return auth.customAuthProvider().signIn(r.ticket).then(function () {
          rememberUser(r.username);
          return { username: r.username };
        });
      });
    },

    register: function (username, password) {
      return callAuth("register", { username: username, password: password }).then(function (r) {
        return auth.customAuthProvider().signIn(r.ticket).then(function () {
          rememberUser(r.username);
          return { username: r.username };
        });
      });
    },

    logout: function () {
      forgetUser();
      return auth.signOut();
    },

    /* 同步读取：当前账号名（本地记忆，配合 loginState 校验） */
    user: function () {
      var name = rememberedUser();
      return name ? { username: name } : null;
    },

    /* 异步校验：返回当前登录状态（含 uid）或 null */
    loginState: function () {
      return ensureSession().then(function (state) {
        if (!state || !state.user) return null;
        return {
          uid: state.user.uid || null,
          username: rememberedUser()
        };
      }).catch(function () { return null; });
    },

    /* ---------------- 云命运簿（登录按账号；未登录按同步码） ---------------- */

    saveReading: function (entry) {
      return ensureSession().then(function (state) {
        var data = {
          code: getSyncCode(),
          seed: entry.seed,
          themeTitle: entry.themeTitle,
          spreadName: entry.spreadName,
          keyword: entry.keyword,
          finalCardName: entry.finalCardName,
          payload: JSON.stringify({ reading: entry.reading, result: entry.result }),
          createdAt: Date.now()
        };
        if (state && state.user) data.owner = state.user.uid;
        return db.collection("readings").add(data);
      });
    },

    listReadings: function (limit) {
      return ensureSession().then(function (state) {
        var q = db.collection("readings");
        if (state && state.user) {
          q = q.where({ owner: state.user.uid });
        } else {
          q = q.where({ code: getSyncCode() });
        }
        return q.orderBy("createdAt", "desc").limit(limit || 30).get();
      }).then(function (res) {
        return (res.data || []).map(function (row) {
          var payload = JSON.parse(row.payload || "{}");
          return {
            ts: row.createdAt || Date.now(),
            seed: row.seed,
            themeId: payload.reading ? payload.reading.theme.id : null,
            themeTitle: row.themeTitle || (payload.reading ? payload.reading.theme.title : ""),
            spreadId: payload.reading ? payload.reading.spread.id : null,
            spreadName: row.spreadName || (payload.reading ? payload.reading.spread.name : ""),
            keyword: row.keyword || "",
            finalCardName: row.finalCardName || "",
            reading: payload.reading,
            result: payload.result
          };
        });
      });
    },

    /* ---------------- 心事墙 ---------------- */

    postWish: function (text, keyword) {
      return ensureSession().then(function () {
        return db.collection("wishes").add({
          text: text,
          keyword: keyword || "心事",
          device: YTM.backend.deviceId(),
          createdAt: Date.now()
        });
      }).then(function (res) {
        return {
          id: res.id,
          text: text,
          keyword: keyword || "心事",
          lights: 0,
          mine: true,
          lit: false
        };
      });
    },

    listWishes: function (limit) {
      return ensureSession().then(function () {
        return db.collection("wishes").orderBy("createdAt", "desc").limit(limit || 20).get();
      }).then(function (res) {
        return (res.data || []).map(function (row) {
          return {
            id: row._id,
            text: row.text,
            keyword: row.keyword || "心事",
            lights: row.lights || 0,
            mine: row.device === YTM.backend.deviceId(),
            lit: false /* 由调用方合并本地点亮记录 */
          };
        });
      });
    },

    /* 点亮：文档 _id 天然防重复（同一设备重复 set 会报错） */
    lightWish: function (id) {
      return ensureSession().then(function () {
        return db.collection("wishes").where({ _id: id }).get();
      }).then(function (res) {
        if (!res.data || !res.data.length) throw new Error("这条心事已消失");
        var docId = id + "_" + YTM.backend.deviceId();
        return db.collection("lights").doc(docId).set({
          wishId: id,
          device: YTM.backend.deviceId(),
          createdAt: Date.now()
        }).then(function () {
          /* 计数同步回 wishes（尽力而为） */
          return db.collection("lights").where({ wishId: id }).count().then(function (c) {
            return db.collection("wishes").doc(id).update({ lights: c.total }).catch(function () {});
          });
        });
      }).catch(function (err) {
        if (err && /已存在|exist|already|document.*exists/i.test(err.message || "")) {
          throw new Error("已点亮");
        }
        throw err;
      });
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
