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

  /* 匿名登录（兼容 v2 与 v1 两代 SDK API）：
     v2: auth.signInAnonymously()  /  v1: auth.anonymousAuthProvider().signIn() */
  function signInAnonymous() {
    if (typeof auth.signInAnonymously === "function") {
      return auth.signInAnonymously();
    }
    return auth.anonymousAuthProvider().signIn();
  }

  /* 自定义登录（云函数签发 ticket）：
     v2 标准写法 → setCustomSignFunc 提供取票函数 + signInWithCustomTicket() 无参登录
     兼容写法 → signInWithCustomTicket(ticket) / v1 customAuthProvider().signIn(ticket) */
  function signInWithTicket(ticket) {
    if (typeof auth.setCustomSignFunc === "function" && typeof auth.signInWithCustomTicket === "function") {
      return auth.setCustomSignFunc(function () { return Promise.resolve(ticket); })
        .then(function () { return auth.signInWithCustomTicket(); });
    }
    if (typeof auth.signInWithCustomTicket === "function") {
      return auth.signInWithCustomTicket(ticket);
    }
    return auth.customAuthProvider().signIn(ticket);
  }

  /* 当前有效登录态（统一校验 uid） */
  function validLoginState() {
    return auth.getLoginState().then(function (state) {
      return (state && state.user && state.user.uid) ? state : null;
    }).catch(function () { return null; });
  }

  /* 建立会话：
     - 已有有效登录态（自定义登录/匿名）→ 直接使用
     - 无登录态 → 匿名登录（需控制台开启「匿名登录」）
     - 匿名不可用 → 未登录模式（需控制台开启未登录访问权限） */
  function ensureSession() {
    return init(YTM.config.backend).then(function (ok) {
      if (!ok) throw new Error("云服务未就绪");
      var cfg = YTM.config.backend || {};
      return validLoginState().then(function (state) {
        if (state) return state;
        if (cfg.anonymousLogin === false) return null; /* 未登录模式 */
        return signInAnonymous().then(function () {
          return validLoginState();
        }).catch(function () {
          return null; /* 匿名不可用：降级未登录模式 */
        });
      }).catch(function () {
        return null;
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
      app = tcb.init({ env: cfg.envId, region: cfg.region || "ap-shanghai" });
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

  /* 统一错误提取：SDK 错误对象可能用 message / errMsg / msg / error 任一字段 */
  function errText(err, prefix) {
    var t = err && (err.message || err.errMsg || err.msg || err.error);
    if (t) return String(t);
    try { t = JSON.stringify(err); } catch (e) { t = ""; }
    return (prefix || "") + (t && t !== "{}" ? t.slice(0, 200) : "未知错误");
  }

  /* 调用云函数 auth（注册/登录/管理操作；已持有管理员令牌时自动附带） */
  var adminToken = null;

  function callAuth(action, data) {
    return ensureSession().then(function () {
      var payload = { action: action };
      if (data) {
        for (var k in data) payload[k] = data[k];
      }
      if (adminToken) payload.adminToken = adminToken;
      return app.callFunction({ name: "auth", data: payload });
    }).then(function (res) {
      var r = res && res.result;
      if (!r || r.code !== 0) {
        throw new Error((r && r.message) || "云函数调用失败");
      }
      return r;
    }).catch(function (err) {
      throw new Error(errText(err, "云函数："));
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
    mode: function () { return "cloud"; },

    ready: function () {
      return init(YTM.config && YTM.config.backend);
    },

    hasCloud: function () { return true; },
    getSyncCode: getSyncCode,
    bindSyncCode: bindSyncCode,
    resetSyncCode: resetSyncCode,

    /* ---------------- 账号（自定义登录 + 管理员令牌） ---------------- */

    login: function (username, password) {
      return callAuth("login", { username: username, password: password }).then(function (r) {
        if (r.role === "admin" && r.adminToken) {
          adminToken = r.adminToken; /* 仅存内存，刷新页面需重新登录 */
        } else {
          adminToken = null;
        }
        return signInWithTicket(r.ticket).catch(function (e) {
          throw new Error("登录凭证签发失败：" + errText(e));
        }).then(function () {
          rememberUser(r.username);
          return { username: r.username, admin: r.role === "admin" };
        });
      });
    },

    register: function (username, password) {
      return callAuth("register", { username: username, password: password }).then(function (r) {
        if (r.role === "admin" && r.adminToken) {
          adminToken = r.adminToken;
        } else {
          adminToken = null;
        }
        return signInWithTicket(r.ticket).catch(function (e) {
          throw new Error("登录凭证签发失败：" + errText(e));
        }).then(function () {
          rememberUser(r.username);
          return { username: r.username, admin: r.role === "admin" };
        });
      });
    },

    logout: function () {
      adminToken = null;
      forgetUser();
      return auth.signOut();
    },

    /* 管理员能力（令牌仅存内存；云端逐次校验） */
    isAdmin: function () { return !!adminToken; },
    adminStats: function () {
      if (!adminToken) return Promise.reject(new Error("需要管理员身份"));
      return callAuth("adminStats");
    },
    adminDeleteWish: function (wishId) {
      if (!adminToken) return Promise.reject(new Error("需要管理员身份"));
      return callAuth("adminDeleteWish", { wishId: wishId });
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
          device: YTM.backend.api.deviceId(),
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
        var rows = res.data || [];
        /* 点亮数改为实时 count（配合「仅创建者可改」安全规则，不再由客户端写回） */
        return Promise.all(rows.map(function (row) {
          return db.collection("lights").where({ wishId: row._id }).count().then(function (c) {
            return {
              id: row._id,
              text: row.text,
              keyword: row.keyword || "心事",
              lights: c.total,
              mine: row.device === YTM.backend.api.deviceId(),
              lit: false /* 由调用方合并本地点亮记录 */
            };
          }).catch(function () {
            return {
              id: row._id,
              text: row.text,
              keyword: row.keyword || "心事",
              lights: row.lights || 0,
              mine: row.device === YTM.backend.api.deviceId(),
              lit: false
            };
          });
        }));
      });
    },

    /* 点亮：文档 _id 天然防重复（同一设备重复 set 会报错）；只新增，不修改他人文档 */
    lightWish: function (id) {
      return ensureSession().then(function () {
        return db.collection("wishes").where({ _id: id }).get();
      }).then(function (res) {
        if (!res.data || !res.data.length) throw new Error("这条心事已消失");
        var docId = id + "_" + YTM.backend.api.deviceId();
        return db.collection("lights").doc(docId).set({
          wishId: id,
          device: YTM.backend.api.deviceId(),
          createdAt: Date.now()
        });
      }).catch(function (err) {
        if (err && /已存在|exist|already|document.*exists/i.test(err.message || "")) {
          throw new Error("已点亮");
        }
        throw err;
      });
    },

    /* 登录态与本地记忆保持一致（会话失效时清除本地用户名标记） */
    refreshAuthState: function () {
      return this.loginState().then(function (state) {
        if (state && state.username) rememberUser(state.username);
        else forgetUser();
        return state;
      });
    },

    /* 安全自检：users 集合是否可被浏览器直读（仅诊断用） */
    probeUsers: function () {
      return ensureSession().then(function () {
        return db.collection("users").count().then(function (c) {
          return { leaked: true, count: c.total };
        }).catch(function () {
          return { leaked: false };
        });
      });
    },

    /* 认证方式全量探测：v2/v1 两套匿名登录 API + 未登录模式，逐一验证实际可用性 */
    probeAuth: function () {
      var report = { sdk: {}, steps: [] };
      function push(step, ok, detail) {
        report.steps.push({ step: step, ok: ok, detail: detail || "" });
      }
      function tryDb() {
        return db.collection("wishes").limit(1).get().then(function (r) {
          return { ok: true, n: (r.data || []).length };
        }).catch(function (e) {
          return { ok: false, err: errText(e) };
        });
      }
      return init(YTM.config.backend).then(function (ok) {
        if (!ok) { push("init", false, "SDK 初始化失败"); return report; }
        report.sdk = {
          hasSignInAnonymously: typeof auth.signInAnonymously === "function",
          hasAnonymousAuthProvider: typeof auth.anonymousAuthProvider === "function",
          hasGetLoginState: typeof auth.getLoginState === "function",
          hasCustomAuthProvider: typeof auth.customAuthProvider === "function",
          keys: Object.keys(auth).slice(0, 25)
        };
        return auth.getLoginState().then(function (state) {
          push("getLoginState", !!state, state && state.user ? "uid=" + state.user.uid : "无登录态");
          var chain = Promise.resolve();
          if (typeof auth.signInAnonymously === "function") {
            chain = chain.then(function () {
              return auth.signInAnonymously().then(function (res) {
                push("signInAnonymously(v2)", true, JSON.stringify((res && (res.user || res)) || "").slice(0, 400));
                return tryDb().then(function (r) { push("db-after-v2", r.ok, r.ok ? "读到 " + r.n + " 条" : r.err); });
              }).catch(function (e) {
                push("signInAnonymously(v2)", false, errText(e).slice(0, 400));
              });
            });
          }
          if (typeof auth.anonymousAuthProvider === "function") {
            chain = chain.then(function () {
              return auth.anonymousAuthProvider().signIn().then(function (res) {
                push("anonymousAuthProvider(v1)", true, JSON.stringify((res && (res.user || res)) || "").slice(0, 120));
                return tryDb().then(function (r) { push("db-after-v1", r.ok, r.ok ? "读到 " + r.n + " 条" : r.err); });
              }).catch(function (e) {
                push("anonymousAuthProvider(v1)", false, errText(e));
              });
            });
          }
          /* 最后测一次：整套流程里真正用到的 ensureSession + 读库 */
          return chain.then(function () {
            return ensureSession().then(function () {
              return tryDb().then(function (r) {
                push("ensureSession+db", r.ok, r.ok ? "读到 " + r.n + " 条" : r.err);
                report.works = r.ok;
                return report;
              });
            }).catch(function (e) {
              push("ensureSession", false, errText(e));
              return report;
            });
          });
        }).catch(function (e) {
          push("getLoginState", false, errText(e));
          return report;
        });
      });
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
