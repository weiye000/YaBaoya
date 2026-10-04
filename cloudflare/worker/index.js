/**
 * 研途秘典 · Cloudflare Worker 后端
 *
 * 提供：
 *   - 匿名会话（设备身份 + 签名令牌，无需注册）
 *   - 账号注册 / 登录（客户端 PBKDF2 派生 + 服务端加盐 SHA-256 存储，不存明文）
 *   - 云命运簿（登录按账号、访客按 8 位同步码）
 *   - 心事墙（发帖 / 点亮，点亮去重由主键保证）
 *   - 管理员台（用户名 Yaya：一次性 adminToken，云端逐次校验）
 *
 * 绑定：DB（D1 数据库）、ASSETS（静态资源）、SESSION_SECRET（令牌签名密钥）
 */

const enc = new TextEncoder();

/* ---------------- 基础工具 ---------------- */

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS"
    }
  });
}

function b64url(bytes) {
  let s = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(str) {
  const pad = str.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(pad + "===".slice((pad.length + 3) % 4));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function hmacSign(secret, text) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(text));
  return b64url(sig);
}

async function signToken(secret, payload) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await hmacSign(secret, body);
  return body + "." + sig;
}

async function verifyToken(secret, token) {
  if (!token || token.indexOf(".") < 0) return null;
  const parts = token.split(".");
  const expect = await hmacSign(secret, parts[0]);
  if (expect !== parts[1]) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(unb64url(parts[0])));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

async function sha256hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bearer(request) {
  const h = request.headers.get("Authorization") || "";
  return h.replace(/^Bearer\s+/i, "").trim();
}

/* ---------------- 会话 ---------------- */

const GUEST_DAYS = 180;
const USER_DAYS = 30;

async function readSession(request, env) {
  const payload = await verifyToken(env.SESSION_SECRET, bearer(request));
  if (payload) return payload;
  const admin = request.headers.get("X-Admin-Token") || "";
  return { type: "anon", adminToken: admin };
}

/* 校验管理员身份：
   1) 会话令牌里带管理员角色（HMAC 签名，服务端可信）→ 直接通过
   2) 兼容一次性 adminToken（与 users 表中 Yaya 的当前令牌比对） */
async function verifyAdmin(request, env) {
  const session = await verifyToken(env.SESSION_SECRET, bearer(request));
  if (session && session.type === "user" && session.role === "admin") {
    return { id: session.uid, username: session.username, role: "admin" };
  }
  const token = request.headers.get("X-Admin-Token") || "";
  if (!token || token.length < 16) return null;
  const row = await env.DB.prepare("SELECT id, username, role, admin_token FROM users WHERE username = ?").bind("Yaya").first();
  if (!row) return null;
  if ((row.role === "admin" || row.username === "Yaya") && row.admin_token === token) return row;
  return null;
}

/* ---------------- 账号 ---------------- */

const ADMIN_NAME = "Yaya";
const VERIFIER_RE = /^[a-f0-9]{64}$/; /* 客户端 PBKDF2 输出（32 字节十六进制） */

async function handleRegister(env, body) {
  const username = String(body.username || "").trim();
  const verifier = String(body.verifier || "").toLowerCase();
  if (!/^[\w\u4e00-\u9fa5-]{2,16}$/.test(username)) return json({ code: 1, message: "用户名需 2-16 位（字母/数字/中文/下划线）" });
  if (!VERIFIER_RE.test(verifier)) return json({ code: 1, message: "密码格式不正确" });
  const exist = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
  if (exist) return json({ code: 1, message: "这个用户名已被注册" });
  const salt = randomHex(16);
  const stored = await sha256hex(verifier + ":" + salt);
  const role = username === ADMIN_NAME ? "admin" : "user";
  const now = Date.now();
  const res = await env.DB.prepare(
    "INSERT INTO users (username, verifier, salt, role, created_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(username, stored, salt, role, now).run();
  const uid = res.meta && res.meta.last_row_id;
  return buildAuthResult(env, { id: uid, username: username, role: role });
}

async function handleLogin(env, body) {
  const username = String(body.username || "").trim();
  const verifier = String(body.verifier || "").toLowerCase();
  if (!VERIFIER_RE.test(verifier)) return json({ code: 1, message: "密码格式不正确" });
  const user = await env.DB.prepare("SELECT id, username, verifier, salt, role FROM users WHERE username = ?").bind(username).first();
  if (!user) return json({ code: 1, message: "用户名不存在" });
  const stored = await sha256hex(verifier + ":" + user.salt);
  if (stored !== user.verifier) return json({ code: 1, message: "密码不正确" });
  return buildAuthResult(env, user);
}

async function buildAuthResult(env, user) {
  let role = user.role;
  if (user.username === ADMIN_NAME && role !== "admin") {
    role = "admin";
    await env.DB.prepare("UPDATE users SET role = 'admin' WHERE id = ?").bind(user.id).run();
  }
  const token = await signToken(env.SESSION_SECRET, {
    type: "user",
    uid: String(user.id),
    username: user.username,
    role: role,
    exp: Date.now() + USER_DAYS * 86400000
  });
  const out = { code: 0, token: token, username: user.username, role: role };
  if (role === "admin") {
    const adminToken = randomHex(24);
    await env.DB.prepare("UPDATE users SET admin_token = ? WHERE id = ?").bind(adminToken, user.id).run();
    out.adminToken = adminToken;
  }
  return json(out);
}

/* ---------------- 命运簿 ---------------- */

async function listReadings(env, session, url) {
  const limit = Math.min(Number(url.searchParams.get("limit") || 30), 100);
  let rows;
  if (session.type === "user") {
    rows = await env.DB.prepare(
      "SELECT * FROM readings WHERE owner = ? ORDER BY created_at DESC LIMIT ?"
    ).bind(String(session.uid), limit).all();
  } else {
    const code = String(url.searchParams.get("code") || "");
    if (!code) return json({ code: 0, items: [] });
    rows = await env.DB.prepare(
      "SELECT * FROM readings WHERE code = ? ORDER BY created_at DESC LIMIT ?"
    ).bind(code, limit).all();
  }
  const items = (rows.results || []).map((r) => {
    let payload = {};
    try { payload = JSON.parse(r.payload || "{}"); } catch (e) { payload = {}; }
    return {
      ts: r.created_at,
      seed: r.seed,
      themeId: payload.reading ? payload.reading.theme.id : null,
      themeTitle: r.theme_title || "",
      spreadId: payload.reading ? payload.reading.spread.id : null,
      spreadName: r.spread_name || "",
      keyword: r.keyword || "",
      finalCardName: r.final_card_name || "",
      reading: payload.reading,
      result: payload.result
    };
  });
  return json({ code: 0, items: items });
}

async function saveReading(env, session, body) {
  const e = body.entry || {};
  const code = String(body.code || "");
  await env.DB.prepare(
    "INSERT INTO readings (code, owner, seed, theme_title, spread_name, keyword, final_card_name, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    code,
    session.type === "user" ? String(session.uid) : null,
    Number(e.seed) || 0,
    String(e.themeTitle || ""),
    String(e.spreadName || ""),
    String(e.keyword || ""),
    String(e.finalCardName || ""),
    JSON.stringify({ reading: e.reading, result: e.result }),
    Date.now()
  ).run();
  return json({ code: 0 });
}

/* ---------------- 心事墙 ---------------- */

async function listWishes(env, session, url) {
  const limit = Math.min(Number(url.searchParams.get("limit") || 20), 50);
  const rows = await env.DB.prepare(
    "SELECT w.id, w.text, w.keyword, w.device, w.created_at, (SELECT COUNT(*) FROM lights l WHERE l.wish_id = w.id) AS lights FROM wishes w ORDER BY w.created_at DESC LIMIT ?"
  ).bind(limit).all();
  const items = (rows.results || []).map((w) => ({
    id: String(w.id),
    text: w.text,
    keyword: w.keyword || "心事",
    lights: w.lights || 0,
    createdAt: w.created_at,
    mine: !!session.device && w.device === session.device
  }));
  return json({ code: 0, items: items });
}

async function postWish(env, session, body) {
  const text = String(body.text || "").trim();
  if (!text) return json({ code: 1, message: "心事不能为空" });
  if (text.length > 300) return json({ code: 1, message: "心事最多 300 字" });
  const now = Date.now();
  const res = await env.DB.prepare(
    "INSERT INTO wishes (text, keyword, device, created_at) VALUES (?, ?, ?, ?)"
  ).bind(text, String(body.keyword || "心事"), session.device || "anon", now).run();
  return json({ code: 0, item: { id: String(res.meta.last_row_id), text: text, keyword: String(body.keyword || "心事"), lights: 0, createdAt: now, mine: true } });
}

async function lightWish(env, session, wishId) {
  const id = Number(wishId);
  if (!id) return json({ code: 1, message: "参数错误" });
  const wish = await env.DB.prepare("SELECT id FROM wishes WHERE id = ?").bind(id).first();
  if (!wish) return json({ code: 1, message: "这条心事已消失" });
  const device = session.device || "anon";
  const dup = await env.DB.prepare("SELECT 1 AS x FROM lights WHERE wish_id = ? AND device = ?").bind(id, device).first();
  if (dup) return json({ code: 1, message: "已点亮" });
  await env.DB.prepare("INSERT INTO lights (wish_id, device, created_at) VALUES (?, ?, ?)").bind(id, device, Date.now()).run();
  const cnt = await env.DB.prepare("SELECT COUNT(*) AS n FROM lights WHERE wish_id = ?").bind(id).first();
  return json({ code: 0, lights: cnt.n });
}

/* ---------------- 管理员 ---------------- */

async function adminStats(request, env) {
  const admin = await verifyAdmin(request, env);
  if (!admin) return json({ code: 3, message: "管理员验证失败" });
  const users = await env.DB.prepare("SELECT username, role, created_at FROM users ORDER BY created_at DESC LIMIT 200").all();
  const counts = await env.DB.prepare(
    "SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM readings) AS readings, (SELECT COUNT(*) FROM wishes) AS wishes, (SELECT COUNT(*) FROM lights) AS lights"
  ).first();
  return json({
    code: 0,
    users: (users.results || []).map((u) => ({ username: u.username, role: u.role, createdAt: u.created_at })),
    counts: counts
  });
}

async function adminDeleteWish(request, env, id) {
  const admin = await verifyAdmin(request, env);
  if (!admin) return json({ code: 3, message: "管理员验证失败" });
  const wishId = Number(id);
  if (!wishId) return json({ code: 1, message: "缺少 wishId" });
  await env.DB.prepare("DELETE FROM lights WHERE wish_id = ?").bind(wishId).run();
  await env.DB.prepare("DELETE FROM wishes WHERE id = ?").bind(wishId).run();
  return json({ code: 0 });
}

/* ---------------- 路由 ---------------- */

async function handleApi(request, env, url) {
  const path = url.pathname.replace(/^\/api/, "");
  const method = request.method.toUpperCase();
  let body = {};
  if (method === "POST" && request.headers.get("Content-Type") && request.headers.get("Content-Type").indexOf("json") >= 0) {
    try { body = await request.json(); } catch (e) { body = {}; }
  }

  /* 建立匿名会话（设备身份 + 签名令牌） */
  if (path === "/session" && method === "POST") {
    const device = String(body.device || "") || "d_" + randomHex(8);
    const token = await signToken(env.SESSION_SECRET, {
      type: "guest",
      device: device,
      exp: Date.now() + GUEST_DAYS * 86400000
    });
    return json({ code: 0, device: device, token: token });
  }

  const session = await readSession(request, env);

  if (path === "/register" && method === "POST") return handleRegister(env, body);
  if (path === "/login" && method === "POST") return handleLogin(env, body);
  if (path === "/me") {
    if (session.type === "user") return json({ code: 0, user: { username: session.username, role: session.role } });
    return json({ code: 1, message: "未登录" });
  }

  if (path === "/history" && method === "GET") return listReadings(env, session, url);
  if (path === "/history" && method === "POST") return saveReading(env, session, body);

  if (path === "/wishes" && method === "GET") return listWishes(env, session, url);
  if (path === "/wishes" && method === "POST") return postWish(env, session, body);
  if (path === "/lights" && method === "POST") return lightWish(env, session, body.wishId);

  if (path === "/admin/stats" && method === "GET") return adminStats(request, env);
  if (path.indexOf("/admin/wishes/") === 0 && method === "DELETE") return adminDeleteWish(request, env, path.replace("/admin/wishes/", ""));

  if (path === "/ping") return json({ code: 0, message: "pong", now: Date.now() });

  return json({ code: 1, message: "未知接口：" + path }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return json({ code: 0 });
    if (url.pathname.indexOf("/api/") === 0) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        return json({ code: 2, message: (err && err.message) || "服务器开小差了" }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  }
};
