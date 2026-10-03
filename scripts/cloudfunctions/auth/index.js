/**
 * 研途秘典 · 云函数「auth」（微信云开发环境）
 * 功能：用户名 + 密码 注册 / 登录，签发自定义登录凭证（ticket）
 * 部署：云开发控制台 → 云函数 → 新建云函数（名称 auth）
 *       → 把本文件与 package.json 一起上传（或在线编辑粘贴）
 *       → 保存并部署（云端安装依赖）
 * 安全：密码使用 scrypt + 随机盐哈希存储，不保存明文
 */
const cloud = require("wx-server-sdk");
const crypto = require("crypto");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const users = db.collection("users");

const TICKET_REFRESH = 30 * 24 * 3600 * 1000; // 30 天

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 32).toString("hex");
}

function makeSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function issueTicket(userId) {
  return cloud.auth().createTicket(String(userId), { refresh: TICKET_REFRESH });
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
      const res = await users.add({
        data: {
          username,
          salt,
          hash: hashPassword(password, salt),
          createdAt: Date.now()
        }
      });
      const ticket = issueTicket(res._id);
      return { code: 0, ticket, username };
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
      const ticket = issueTicket(user._id);
      return { code: 0, ticket, username };
    }

    return { code: 1, message: "未知操作" };
  } catch (err) {
    return { code: 2, message: (err && err.message) || "服务器开小差了，稍后再试" };
  }
};
