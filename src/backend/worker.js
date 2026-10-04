/**
 * 研途秘典 · 后端适配器（Cloudflare Worker）
 *
 * 与 local.js 提供完全相同的接口，但底层是自家 Worker 的 REST 接口：
 *   - 匿名会话：/api/session（设备身份 + 签名令牌）
 *   - 账号：/api/register、/api/login（客户端 PBKDF2 派生，密码明文不出浏览器）
 *   - 命运簿：/api/history（登录按账号、访客按 8 位同步码）
 *   - 心事墙：/api/wishes、/api/lights
 *   - 管理台：/api/admin/stats、/api/admin/wishes/:id（用户名 Yaya）
 *
 * 配置：YTM.config.backend = { provider: "worker", apiBase: "" }（空=同源）
 */
(function (global) {
  "use strict";

  var YTM = (global.YTM = global.YTM || {});
  YTM.backend = YTM.backend || {};
  YTM.backend.impl = YTM.backend.impl || {};

  var TOKEN_KEY = "ytm_cf_token";
  var DEVICE_KEY = "ytm_cf_device";
  var USER_KEY = "ytm_cf_user";
  var CODE_KEY = "ytm_sync_code";
  var PBKDF2_ROUNDS = 150000;

  var token = null;
  var device = null;
  var adminFlag = false;
  var sessionReady = null;

  function cfg() {
    return (YTM.config && YTM.config.backend) || {};
  }

  function base() {
    return String(cfg().apiBase || "").replace(/\/+$/, "");
  }

  function store(key, value) {
    try {
      if (value === null) global.localStorage.removeItem(key);
      else global.localStorage.setItem(key, value);
    } catch (e) { /* 隐私模式忽略 */ }
  }

  function load(key) {
    try { return global.localStorage.getItem(key); } catch (e) { return null; }
  }

  function token$() {
    if (!token) token = load(TOKEN_KEY);
    return token;
  }

  function deviceId() {
    if (!device) {
      device = load(DEVICE_KEY);
      if (!device) {
        device = "d_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
        store(DEVICE_KEY, device);
      }
    }
    return device;
  }

  function errText(err) {
    var t = err && (err.message || err.errMsg || err.msg);
    if (t) return String(t);
    return "网络异常，请稍后再试";
  }

  /* 统一请求：自动带会话令牌，统一错误处理 */
  function api(path, options) {
    options = options || {};
    var headers = { "Content-Type": "application/json" };
    var t = token$();
    if (t) headers.Authorization = "Bearer " + t;
    return fetch(base() + "/api" + path, {
      method: options.method || "GET",
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    }).then(function (res) {
      return res.json().catch(function () {
        throw new Error("服务返回异常（HTTP " + res.status + "）");
      }).then(function (data) {
        if (data && data.code === 0) return data;
        throw new Error((data && data.message) || "请求失败");
      });
    }, function (err) {
      throw new Error("无法连接服务器：" + errText(err));
    });
  }

  /* 建立（或复用）匿名会话 */
  function ensureSession() {
    if (sessionReady) return sessionReady;
    sessionReady = Promise.resolve().then(function () {
      if (token$()) return true;
      return api("/session", { method: "POST", body: { device: deviceId() } }).then(function (r) {
        token = r.token;
        device = r.device || deviceId();
        store(TOKEN_KEY, token);
        store(DEVICE_KEY, device);
        return true;
      });
    }).catch(function (err) {
      sessionReady = null;
      throw err;
    });
    return sessionReady;
  }

  function ensure() {
    return ensureSession().then(function () { return token$(); });
  }

  /* 密码派生：PBKDF2-SHA256（150k 次），明文密码不离开浏览器 */
  function deriveVerifier(username, password) {
    var subtle = global.crypto && global.crypto.subtle;
    if (!subtle) return Promise.reject(new Error("当前浏览器不支持安全加密（需 HTTPS 环境）"));
    var enc = new global.TextEncoder();
    return subtle.importKey("raw", enc.encode(String(password)), "PBKDF2", false, ["deriveBits"]).then(function (key) {
      return subtle.deriveBits(
        { name: "PBKDF2", salt: enc.encode("ytm:" + String(username).toLowerCase()), iterations: PBKDF2_ROUNDS, hash: "SHA-256" },
        key,
        256
      );
    }).then(function (bits) {
      return Array.prototype.map.call(new Uint8Array(bits), function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    });
  }

  function rememberUser(username) {
    store(USER_KEY, username);
  }
  function forgetUser() {
    store(USER_KEY, null);
    adminFlag = false;
  }

  /* 8 位同步码（去掉易混淆字符） */
  function newCode() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var code = "";
    for (var i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  function getSyncCode() {
    var code = load(CODE_KEY);
    if (code) return code;
    code = newCode();
    store(CODE_KEY, code);
    return code;
  }

  YTM.backend.impl.worker = {
    mode: function () { return "cloud"; },
    hasCloud: function () { return true; },
    isCloud: function () { return true; },
    ready: function () { return ensureSession().then(function () { return true; }).catch(function () { return false; }); },

    deviceId: deviceId,

    /* ---------------- 同步码 ---------------- */
    getSyncCode: getSyncCode,
    bindSyncCode: function (code) {
      code = String(code || "").trim().toUpperCase();
      if (!/^[A-Z0-9]{8}$/.test(code)) return Promise.reject(new Error("同步码格式不对（8 位字母数字）"));
      store(CODE_KEY, code);
      return Promise.resolve(code);
    },
    resetSyncCode: function () {
      var code = newCode();
      store(CODE_KEY, code);
      return Promise.resolve(code);
    },

    /* ---------------- 账号 ---------------- */
    login: function (username, password) {
      return ensure().then(function () {
        return deriveVerifier(username, password);
      }).then(function (verifier) {
        return api("/login", { method: "POST", body: { username: username, verifier: verifier } });
      }).then(function (r) {
        token = r.token;
        store(TOKEN_KEY, token);
        rememberUser(r.username);
        adminFlag = r.role === "admin";
        return { username: r.username, admin: adminFlag };
      });
    },

    register: function (username, password) {
      return ensure().then(function () {
        return deriveVerifier(username, password);
      }).then(function (verifier) {
        return api("/register", { method: "POST", body: { username: username, verifier: verifier } });
      }).then(function (r) {
        token = r.token;
        store(TOKEN_KEY, token);
        rememberUser(r.username);
        adminFlag = r.role === "admin";
        return { username: r.username, admin: adminFlag };
      });
    },

    logout: function () {
      token = null;
      sessionReady = null;
      store(TOKEN_KEY, null);
      forgetUser();
      return Promise.resolve();
    },

    user: function () {
      var name = load(USER_KEY);
      return name ? { username: name } : null;
    },

    loginState: function () {
      return ensure().then(function () {
        return api("/me");
      }).then(function (r) {
        adminFlag = r.user && r.user.role === "admin";
        return { username: r.user.username, role: r.user.role };
      }).catch(function () {
        return null;
      });
    },

    refreshAuthState: function () {
      return this.loginState().then(function (state) {
        if (state && state.username) rememberUser(state.username);
        else forgetUser();
        return state;
      });
    },

    /* ---------------- 命运簿 ---------------- */
    saveReading: function (entry) {
      return ensure().then(function () {
        return api("/history", {
          method: "POST",
          body: {
            code: getSyncCode(),
            entry: {
              seed: entry.seed,
              themeTitle: entry.themeTitle,
              spreadName: entry.spreadName,
              keyword: entry.keyword,
              finalCardName: entry.finalCardName,
              reading: entry.reading,
              result: entry.result
            }
          }
        });
      });
    },

    listReadings: function (limit) {
      return ensure().then(function () {
        return api("/history?limit=" + (limit || 30) + "&code=" + encodeURIComponent(getSyncCode()));
      }).then(function (r) {
        return r.items || [];
      });
    },

    /* ---------------- 心事墙 ---------------- */
    listWishes: function (limit) {
      return ensure().then(function () {
        return api("/wishes?limit=" + (limit || 20));
      }).then(function (r) {
        return (r.items || []).map(function (w) {
          return {
            id: w.id,
            text: w.text,
            keyword: w.keyword || "心事",
            lights: w.lights || 0,
            mine: w.mine || false,
            lit: false
          };
        });
      });
    },

    postWish: function (text, keyword) {
      return ensure().then(function () {
        return api("/wishes", { method: "POST", body: { text: text, keyword: keyword || "心事" } });
      }).then(function (r) {
        return {
          id: r.item.id,
          text: r.item.text,
          keyword: r.item.keyword,
          lights: r.item.lights || 0,
          mine: true,
          lit: false
        };
      });
    },

    lightWish: function (id) {
      return ensure().then(function () {
        return api("/lights", { method: "POST", body: { wishId: id } });
      }).then(function (r) {
        return { lights: r.lights };
      });
    },

    /* ---------------- 管理员 ---------------- */
    isAdmin: function () { return !!adminFlag; },
    adminStats: function () {
      if (!adminFlag) return Promise.reject(new Error("需要管理员身份"));
      return ensure().then(function () { return api("/admin/stats"); });
    },
    adminDeleteWish: function (id) {
      if (!adminFlag) return Promise.reject(new Error("需要管理员身份"));
      return ensure().then(function () {
        return api("/admin/wishes/" + encodeURIComponent(id), { method: "DELETE" });
      });
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
