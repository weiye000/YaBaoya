/**
 * 研途秘典 · 云函数「auth」（微信云开发环境）
 * 功能：
 *   - 用户名 + 密码 注册 / 登录，签发自定义登录凭证（ticket）
 *   - 管理员体系：用户名「Yaya」即管理员（register 时标记；老账号在 login 时自动补标）
 *   - 管理员登录时签发一次性 adminToken（每次登录轮换，旧令牌作废）
 *   - adminStats：查看注册用户列表与全局统计（需 adminToken）
 *   - adminDeleteWish：删除心事及点亮记录（需 adminToken）
 * 安全：
 *   - 密码 scrypt + 随机盐哈希存储，不保存明文
 *   - 管理操作均在云端校验令牌，前端无法伪造身份
 *   - users 集合建议在控制台设为 {"read":false,"write":false}
 *     （云函数使用管理员权限，不受该规则限制；浏览器端永远无法直读用户数据）
 */
const cloud = require("wx-server-sdk");
const crypto = require("crypto");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const users = db.collection("users");

const TICKET_REFRESH = 30 * 24 * 3600 * 1000; // 登录凭证 30 天
const ADMIN_NAME = "Yaya"; // 管理员用户名（精确匹配）

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 32).toString("hex");
}
function makeSalt() {
  return crypto.randomBytes(16).toString("hex");
}
function makeAdminToken() {
  return crypto.randomBytes(24).toString("hex");
}
function issueTicket(userId) {
  return cloud.auth().createTicket(String(userId), { refresh: TICKET_REFRESH });
}

/* 校验管理员令牌：匹配 users 里 Yaya 记录的当前 token */
async function verifyAdmin(event) {
  const token = String((event && event.adminToken) || "");
  if (!token || token.length < 16) return null;
  const found = await users.where({ username: ADMIN_NAME }).limit(1).get();
  if (!found.data.length) return null;
  const admin = found.data[0];
  if ((admin.role === "admin" || admin.username === ADMIN_NAME) &&
      admin.adminToken === token) {
    return admin;
  }
  return null;
}

/* 登录/注册成功后的组装：管理员额外返回新令牌 */
async function buildAuthResult(user) {
  var role = user.role;
  if (user.username === ADMIN_NAME && role !== "admin") {
    role = "admin";
    await users.doc(user._id).update({ role: "admin" }).catch(function () {});
  }
  var ticket = issueTicket(user._id);
  if (role === "admin") {
    var token = makeAdminToken();
    await users.doc(user._id).update({ adminToken: token }).catch(function () {});
    return { code: 0, ticket, username: user.username, role: "admin", adminToken: token };
  }
  return { code: 0, ticket, username: user.username, role: "user" };
}

exports.main = async (event) => {
  const action = event && event.action;
  const username = String((event && event.username) || "").trim();
  const password = String((event && event.password) || "");

  try {
    /* ---------------- 注册 ---------------- */
    if (action === "register") {
      if (!/^[\w\u4e00-\u9fa5-]{2,16}$/.test(username)) {
        return { code: 1, message: "用户名需 2-16 位（字母/数字/中文/下划线）" };
      }
      if (password.length < 6 || password.length > 32) {
        return { code: 1, message: "密码需 6-32 位" };
      }
      const exist = await users.where({ username }).count();
      if (exist.total > 0) {
        return { code: 1, message: "这个用户名已被注册" };
      }
      const salt = makeSalt();
      const doc = {
        username,
        salt,
        hash: hashPassword(password, salt),
        role: username === ADMIN_NAME ? "admin" : "user",
        createdAt: Date.now()
      };
      const res = await users.add({ data: doc });
      doc._id = res._id;
      return buildAuthResult(doc);
    }

    /* ---------------- 登录 ---------------- */
    if (action === "login") {
      const found = await users.where({ username }).limit(1).get();
      if (!found.data.length) {
        return { code: 1, message: "用户名不存在" };
      }
      const user = found.data[0];
      if (hashPassword(password, user.salt) !== user.hash) {
        return { code: 1, message: "密码不正确" };
      }
      return buildAuthResult(user);
    }

    /* ---------------- 管理员：用户列表与全局统计 ---------------- */
    if (action === "adminStats") {
      const admin = await verifyAdmin(event);
      if (!admin) return { code: 3, message: "管理员验证失败" };
      const usersRes = await users.orderBy("createdAt", "desc").limit(200).get();
      const readingsN = await db.collection("readings").count();
      const wishesN = await db.collection("wishes").count();
      const lightsN = await db.collection("lights").count();
      return {
        code: 0,
        users: usersRes.data.map(function (u) {
          return {
            username: u.username,
            role: u.role || "user",
            createdAt: u.createdAt || null
          };
        }),
        counts: {
          users: usersRes.data.length,
          readings: readingsN.total,
          wishes: wishesN.total,
          lights: lightsN.total
        }
      };
    }

    /* ---------------- 管理员：删除心事（含点亮记录） ---------------- */
    if (action === "adminDeleteWish") {
      const admin = await verifyAdmin(event);
      if (!admin) return { code: 3, message: "管理员验证失败" };
      const id = String((event && event.wishId) || "");
      if (!id) return { code: 1, message: "缺少 wishId" };
      await db.collection("wishes").doc(id).remove().catch(function () {});
      await db.collection("lights").where({ wishId: id }).remove().catch(function () {});
      return { code: 0 };
    }

    return { code: 1, message: "未知操作" };
  } catch (err) {
    return { code: 2, message: (err && err.message) || "服务器开小差了，稍后再试" };
  }
};
