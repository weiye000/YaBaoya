/**
 * 研途秘典 · Cloudflare 部署助手
 *
 * 用法：
 *   node scripts/cf_deploy.mjs stage     # 把游戏文件同步到 cloudflare/public
 *   node scripts/cf_deploy.mjs secret    # 生成并上传会话签名密钥（首次）
 *   node scripts/cf_deploy.mjs deploy    # 上传静态资源 + 部署 Worker（= stage+secret+deploy）
 *   node scripts/cf_deploy.mjs check     # 线上接口自检（ping/匿名会话/心事墙）
 *   node scripts/cf_deploy.mjs dbsetup   # 打印建库 SQL（供参考）
 *
 * 需要环境变量：
 *   CLOUDFLARE_API_TOKEN    Cloudflare API 令牌
 *   CLOUDFLARE_ACCOUNT_ID   账号 ID
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, cpSync, readFileSync, writeFileSync } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const CF_DIR = path.join(ROOT, "cloudflare");
const PUBLIC_DIR = path.join(CF_DIR, "public");
const SECRET_FILE = path.join(CF_DIR, ".session-secret");
const PNPM = process.env.YTM_PNPM ||
  "C:\\Users\\zhang\\.dsh\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\pnpm\\bin\\pnpm.mjs";

function wrangler(args, opts = {}) {
  const r = spawnSync(process.execPath, [PNPM, "--package=wrangler", "dlx", "wrangler", ...args], {
    cwd: CF_DIR,
    stdio: opts.input !== undefined ? ["pipe", "inherit", "inherit"] : "inherit",
    input: opts.input,
    env: process.env
  });
  return r.status === null ? 1 : r.status;
}

/* 同步游戏文件到 public（只带网页需要的：index.html / src / assets） */
function stage() {
  rmSync(PUBLIC_DIR, { recursive: true, force: true });
  mkdirSync(PUBLIC_DIR, { recursive: true });
  for (const item of ["index.html", "src", "assets"]) {
    const from = path.join(ROOT, item);
    if (!existsSync(from)) continue;
    cpSync(from, path.join(PUBLIC_DIR, item), { recursive: true });
  }
  console.log("✔ 已同步游戏文件到 cloudflare/public");
}

function ensureSecret() {
  if (!existsSync(SECRET_FILE)) {
    writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString("hex"), "utf8");
    console.log("✔ 已生成会话签名密钥 cloudflare/.session-secret（已 gitignore）");
  }
  return readFileSync(SECRET_FILE, "utf8").trim();
}

const action = process.argv[2] || "deploy";

if (action === "stage") {
  stage();
  process.exit(0);
}

if (action === "dbinfo") {
  console.log("D1 database: ytm-db");
  console.log("database_id: bc9a58d6-a1df-4f66-b2ef-ed8a282f1031");
  process.exit(0);
}

if (action === "secret") {
  const secret = ensureSecret();
  process.exit(wrangler(["secret", "put", "SESSION_SECRET"], { input: secret + "\n" }));
}

if (action === "deploy") {
  stage();
  const secret = ensureSecret();
  const st1 = wrangler(["secret", "put", "SESSION_SECRET"], { input: secret + "\n" });
  if (st1 !== 0) console.log("（密钥上传返回非 0，可能已存在，继续部署）");
  const st2 = wrangler(["deploy"]);
  process.exit(st2);
}

if (action === "check") {
  const configured = process.env.YTM_WORKER_URL || "";
  console.log("用法：YTM_WORKER_URL=https://xxx.workers.dev node scripts/cf_deploy.mjs check");
  if (!configured) process.exit(1);
  const base = configured.replace(/\/+$/, "");
  const out = [];
  const call = async (label, url, opts) => {
    try {
      const r = await fetch(url, opts);
      const text = await r.text();
      out.push({ label, status: r.status, body: text.slice(0, 200) });
    } catch (e) {
      out.push({ label, status: 0, body: String(e && e.message) });
    }
  };
  await call("ping", base + "/api/ping");
  const s = await fetch(base + "/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device: "d_selftest" })
  });
  const session = await s.json();
  out.push({ label: "session", status: s.status, body: JSON.stringify(session).slice(0, 160) });
  const auth = { "Content-Type": "application/json", Authorization: "Bearer " + session.token };
  await call("wishes", base + "/api/wishes?limit=5", { headers: auth });
  await call("history", base + "/api/history?limit=5&code=SELFTEST", { headers: auth });
  await call("post-wish", base + "/api/wishes", {
    method: "POST", headers: auth, body: JSON.stringify({ text: "自检心事（可删）", keyword: "自检" })
  });
  await call("admin-denied", base + "/api/admin/stats", { headers: auth });
  for (const r of out) console.log(`[${r.status}] ${r.label}: ${r.body}`);
  process.exit(0);
}

console.log("未知操作：" + action);
process.exit(1);
