/**
 * 研途秘典 · Cloudflare 后端全链路自检
 * 覆盖：匿名会话 → 注册 → 登录（含错误密码）→ 命运簿读写 → 心事墙 → 管理员（Yaya）→ 清理测试数据
 * 用法：YTM_WORKER_URL=https://xxx.workers.dev node scripts/cf_flow_check.mjs
 */
import crypto from "node:crypto";

const BASE = (process.env.YTM_WORKER_URL || "").replace(/\/+$/, "");
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const DB_ID = process.env.YTM_DB_ID || "bc9a58d6-a1df-4f66-b2ef-ed8a282f1031";

if (!BASE) { console.error("请设置 YTM_WORKER_URL"); process.exit(1); }

let pass = 0, fail = 0;
function check(ok, label, extra) {
  if (ok) { pass++; console.log("  ✓ " + label); }
  else { fail++; console.log("  ✗ " + label + (extra ? " → " + extra : "")); }
}

function verifier(username, password) {
  return crypto.pbkdf2Sync(String(password), "ytm:" + String(username).toLowerCase(), 150000, 32, "sha256").toString("hex");
}

/* 服务端存储方式：sha256(verifier + ":" + salt) */
function storedHash(v, salt) {
  return crypto.createHash("sha256").update(v + ":" + salt).digest("hex");
}

async function api(path, { method = "GET", body, token, adminToken } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  if (adminToken) headers["X-Admin-Token"] = adminToken;
  const res = await fetch(BASE + "/api" + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function d1(sql, params = []) {
  if (!CF_TOKEN || !CF_ACCOUNT) return null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/d1/database/${DB_ID}/query`, {
        method: "POST",
        headers: { Authorization: "Bearer " + CF_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ sql, params })
      });
      const j = await res.json();
      return j.result && j.result[0] ? j.result[0].results : null;
    } catch (e) {
      console.log("  （管理 API 第 " + (attempt + 1) + " 次失败：" + (e && e.message) + "，重试）");
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  return null;
}

const stamp = Date.now().toString().slice(-6);
const player = "自检玩家" + stamp;
const pwd = "test123456";

console.log("== 1) 匿名会话 ==");
const sess = await api("/session", { method: "POST", body: { device: "d_check_" + stamp } });
check(sess.data.code === 0 && !!sess.data.token, "匿名会话建立并签发令牌");
const token = sess.data.token;
const device = sess.data.device;

console.log("== 2) 账号注册 ==");
const reg = await api("/register", { method: "POST", body: { username: player, verifier: verifier(player, pwd) } });
check(reg.data.code === 0 && reg.data.role === "user", "注册成功且角色为 user", JSON.stringify(reg.data));
const userToken = reg.data.token;

console.log("== 3) 登录与会话校验 ==");
const me = await api("/me", { token: userToken });
check(me.data.code === 0 && me.data.user.username === player, "登录态可读取（/me）", JSON.stringify(me.data));
const login = await api("/login", { method: "POST", body: { username: player, verifier: verifier(player, pwd) } });
check(login.data.code === 0, "正确密码可登录");
const bad = await api("/login", { method: "POST", body: { username: player, verifier: verifier(player, "wrong-pass-1") } });
check(bad.data.code === 1 && /密码不正确/.test(bad.data.message || ""), "错误密码被拒", JSON.stringify(bad.data));
const dup = await api("/register", { method: "POST", body: { username: player, verifier: verifier(player, pwd) } });
check(dup.data.code === 1 && /已被注册/.test(dup.data.message || ""), "重复用户名被拒");
const shortPwd = await api("/register", { method: "POST", body: { username: "ab", verifier: "x" } });
check(shortPwd.data.code === 1, "非法用户名/密码格式被拒");

console.log("== 4) 命运簿（登录按账号） ==");
const reading = { seed: 123456, themeTitle: "自检主题", spreadName: "自检牌阵", keyword: "自检", finalCardName: "自检牌", reading: { theme: { id: "general", title: "自检主题" }, spread: { id: "one", name: "自检牌阵" } }, result: { keyword: { word: "自检" } } };
const save = await api("/history", { method: "POST", token: userToken, body: { code: "SELFTEST1", entry: reading } });
check(save.data.code === 0, "命运簿写入成功", JSON.stringify(save.data));
const hist = await api("/history?limit=10", { token: userToken });
check((hist.data.items || []).length >= 1 && hist.data.items[0].themeTitle === "自检主题", "命运簿读取成功（按账号）", JSON.stringify(hist.data).slice(0, 120));
const histGuest = await api("/history?limit=10&code=NOSUCHCD", { token });
check((histGuest.data.items || []).length === 0, "访客同步码隔离（查不到他人记录）");

console.log("== 5) 心事墙 ==");
const wish = await api("/wishes", { method: "POST", token, body: { text: "自检心事（自动清理）", keyword: "自检" } });
check(wish.data.code === 0 && wish.data.item.mine === true, "发布心事成功");
const wishId = wish.data.item.id;
const lit = await api("/lights", { method: "POST", token, body: { wishId } });
check(lit.data.code === 0 && lit.data.lights === 1, "点亮心事成功");
const litAgain = await api("/lights", { method: "POST", token, body: { wishId } });
check(litAgain.data.code === 1 && /已点亮/.test(litAgain.data.message || ""), "重复点亮被拒");
const list = await api("/wishes?limit=5", { token });
check((list.data.items || []).some((w) => w.id === wishId && w.lights >= 1), "心事墙读取含点亮数");

console.log("== 6) 管理员（临时 Yaya） ==");
const adminName = "Yaya" + stamp; /* 避免占用真名 Yaya，测试后删除 */
if (CF_TOKEN) {
  await d1("INSERT INTO users (username, verifier, salt, role, created_at) VALUES ('Yaya', ?, 'saltcheck', 'admin', ?)", [storedHash(verifier("Yaya", pwd), "saltcheck"), Date.now()]);
}
const adminLogin = await api("/login", { method: "POST", body: { username: "Yaya", verifier: verifier("Yaya", pwd) } });
if (adminLogin.data.code === 0) {
  check(adminLogin.data.role === "admin" && !!adminLogin.data.adminToken, "管理员登录返回 admin 角色与令牌");
  const adminToken = adminLogin.data.token;
  const adminDenied = await api("/admin/stats", { token });
  check(adminDenied.data.code === 3, "普通玩家访问管理接口被拒（安全）");
  const stats = await api("/admin/stats", { token: adminToken });
  check(stats.data.code === 0 && stats.data.counts && stats.data.counts.users >= 2, "管理员可读用户列表与统计", JSON.stringify(stats.data.counts));
  const del = await api("/admin/wishes/" + wishId, { method: "DELETE", token: adminToken });
  check(del.data.code === 0, "管理员可删除心事");
  const after = await api("/wishes?limit=20", { token: adminToken });
  check(!(after.data.items || []).some((w) => w.id === wishId), "心事已从墙上移除");
} else {
  check(false, "管理员登录", JSON.stringify(adminLogin.data));
}

console.log("== 7) 清理测试数据 ==");
if (CF_TOKEN) {
  await d1("DELETE FROM lights WHERE device LIKE 'd_check_%' OR device LIKE 'd_selftest%'");
  await d1("DELETE FROM wishes WHERE keyword = '自检'");
  await d1("DELETE FROM readings WHERE theme_title = '自检主题'");
  await d1("DELETE FROM users WHERE username LIKE '自检%' OR username = 'Yaya'");
  const left = await d1("SELECT (SELECT COUNT(*) FROM users) AS u, (SELECT COUNT(*) FROM wishes) AS w, (SELECT COUNT(*) FROM readings) AS r, (SELECT COUNT(*) FROM lights) AS l");
  console.log("  剩余数据：", JSON.stringify(left && left[0]));
}

console.log(`\n结果：通过 ${pass} 项，失败 ${fail} 项`);
process.exit(fail === 0 ? 0 : 1);
