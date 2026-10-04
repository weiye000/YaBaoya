/**
 * 本地验证：自定义登录私钥能否签发 Ticket（不部署云函数即可确认密钥有效）
 * 运行：node scripts/_diag_ticket.mjs
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const KEY_PATH = process.argv[2] || "scripts/cloudfunctions/auth/tcb_custom_login.json";
const MODULES_DIR = process.argv[3] || path.join(os.tmpdir(), "ytm-sign-test");

const cred = JSON.parse(fs.readFileSync(KEY_PATH, "utf8"));
console.log("私钥环境 ID: " + cred.env_id);
console.log("私钥 ID: " + cred.private_key_id);
console.log("私钥长度: " + String(cred.private_key).length + " 字符");

const sdkPath = path.join(MODULES_DIR, "node_modules", "@cloudbase", "node-sdk");
if (!fs.existsSync(sdkPath)) {
  console.error("未找到 @cloudbase/node-sdk：" + sdkPath + "（请先安装）");
  process.exit(2);
}
const cloudbase = require(sdkPath);
const app = cloudbase.init({ env: cred.env_id, credentials: cred });

const customUserId = "probe" + Date.now().toString().slice(-8);
try {
  const ticket = app.auth().createTicket(customUserId);
  const t = typeof ticket === "string" ? ticket : JSON.stringify(ticket);
  console.log("✅ 签发成功");
  console.log("  customUserId: " + customUserId);
  console.log("  ticket 类型: " + typeof ticket);
  console.log("  ticket 长度: " + t.length);
  console.log("  是否 JWT 结构: " + (t.split(".").length === 3));
  console.log("  ticket 头部: " + t.slice(0, 40) + "…");
} catch (err) {
  console.error("❌ 签发失败: " + (err && (err.message || err.errMsg || JSON.stringify(err))));
  process.exit(1);
}
