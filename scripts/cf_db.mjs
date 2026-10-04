/**
 * 研途秘典 · 数据维护工具（Cloudflare D1）
 *
 * 用法（需环境变量 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID）：
 *   node scripts/cf_db.mjs stats          # 查看各表数据量
 *   node scripts/cf_db.mjs users          # 列出注册用户
 *   node scripts/cf_db.mjs wishes         # 列出心事
 *   node scripts/cf_db.mjs clean-test     # 清理自检产生的测试数据
 *   node scripts/cf_db.mjs del-user <名>  # 删除指定用户
 *   node scripts/cf_db.mjs del-wish <id>  # 删除指定心事（含点亮）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SECRET_FILE = path.resolve(HERE, "../cloudflare/.session-secret");

const TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const DB_ID = process.env.YTM_DB_ID || "bc9a58d6-a1df-4f66-b2ef-ed8a282f1031";

if (!TOKEN || !ACCOUNT) {
  console.error("请设置环境变量 CLOUDFLARE_API_TOKEN 与 CLOUDFLARE_ACCOUNT_ID");
  process.exit(1);
}

async function d1(sql, params = []) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DB_ID}/query`, {
        method: "POST",
        headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ sql, params })
      });
      const j = await res.json();
      if (!j.success) throw new Error(JSON.stringify(j.errors));
      return j.result && j.result[0] ? j.result[0].results : [];
    } catch (e) {
      if (i === 2) throw e;
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
}

const action = process.argv[2] || "stats";

if (action === "stats") {
  const rows = await d1("SELECT (SELECT COUNT(*) FROM users) AS 用户, (SELECT COUNT(*) FROM readings) AS 命运簿, (SELECT COUNT(*) FROM wishes) AS 心事, (SELECT COUNT(*) FROM lights) AS 点亮");
  console.log(JSON.stringify(rows[0], null, 2));
} else if (action === "users") {
  const rows = await d1("SELECT username, role, created_at FROM users ORDER BY created_at DESC LIMIT 50");
  rows.forEach((r) => console.log(`${r.role === "admin" ? "★" : " "} ${r.username}  (${new Date(r.created_at).toLocaleString("zh-CN")})`));
  console.log(`共 ${rows.length} 个用户`);
} else if (action === "wishes") {
  const rows = await d1("SELECT w.id, w.text, w.keyword, (SELECT COUNT(*) FROM lights l WHERE l.wish_id = w.id) AS lights, w.created_at FROM wishes w ORDER BY w.created_at DESC LIMIT 50");
  rows.forEach((r) => console.log(`#${r.id} ✦${r.lights} [${r.keyword}] ${r.text}`));
  console.log(`共 ${rows.length} 条心事`);
} else if (action === "clean-test") {
  await d1("DELETE FROM lights WHERE device LIKE 'd_check_%' OR device LIKE 'd_selftest%'");
  await d1("DELETE FROM wishes WHERE keyword = '自检'");
  await d1("DELETE FROM readings WHERE theme_title = '自检主题'");
  await d1("DELETE FROM users WHERE username LIKE '自检%'");
  const rows = await d1("SELECT (SELECT COUNT(*) FROM users) AS u, (SELECT COUNT(*) FROM wishes) AS w, (SELECT COUNT(*) FROM readings) AS r, (SELECT COUNT(*) FROM lights) AS l");
  console.log("已清理测试数据，剩余：", JSON.stringify(rows[0]));
} else if (action === "del-user") {
  const name = process.argv[3];
  if (!name) { console.error("请提供用户名"); process.exit(1); }
  await d1("DELETE FROM users WHERE username = ?", [name]);
  console.log("已删除用户：" + name);
} else if (action === "del-wish") {
  const id = Number(process.argv[3]);
  if (!id) { console.error("请提供心事 id"); process.exit(1); }
  await d1("DELETE FROM lights WHERE wish_id = ?", [id]);
  await d1("DELETE FROM wishes WHERE id = ?", [id]);
  console.log("已删除心事 #" + id);
} else if (action === "secret-info") {
  console.log("会话密钥文件：" + SECRET_FILE + "（存在：" + fs.existsSync(SECRET_FILE) + "）");
} else {
  console.log("未知操作：" + action);
}
