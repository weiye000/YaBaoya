/**
 * 研途秘典 · 云环境初始化助手（用 Node 精确传参调用 CloudBase CLI）
 * 用法：
 *   node scripts/backend_setup.mjs create-collections   # 创建 wishes/lights/readings 集合
 *   node scripts/backend_setup.mjs cors-add              # 添加 WEB 安全域名
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, cpSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const PNPM = "C:\\Users\\zhang\\.dsh\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\pnpm\\bin\\pnpm.mjs";
const ENV_ID = process.env.YTM_ENV || "cloud1-d9gqiv9hvb5ead833";

function run(args, opts = {}) {
  const r = spawnSync(process.execPath, [PNPM, "--package=@cloudbase/cli", "dlx", "cloudbase", ...args], {
    stdio: opts.input !== undefined ? ["pipe", "inherit", "inherit"] : "inherit",
    input: opts.input,
    env: process.env
  });
  return r.status === null ? 1 : r.status;
}

const action = process.argv[2];

if (action === "create-collections") {
  for (const c of ["wishes", "lights", "readings"]) {
    const cmd = JSON.stringify([
      { TableName: c, CommandType: "COMMAND", Command: JSON.stringify({ create: c }) }
    ]);
    console.log("== 创建集合:", c);
    const st = run(["db", "nosql", "execute", "-e", ENV_ID, "--command", cmd]);
    if (st !== 0) {
      console.log("（" + c + " 可能已存在，跳过）");
    }
  }
  console.log("集合检查完成 ✔");
  process.exit(0);
}

if (action === "list-collections") {
  const cmd = JSON.stringify([
    { TableName: "wishes", CommandType: "COMMAND", Command: JSON.stringify({ listCollections: 1 }) }
  ]);
  run(["db", "nosql", "execute", "-e", ENV_ID, "--command", cmd]);
  process.exit(0);
}

if (action === "cors-add") {
  const domains = "https://weiye000.github.io,http://localhost,http://127.0.0.1";
  console.log("== 添加安全域名:", domains);
  const st = run(["cors", "add", domains, "-e", ENV_ID], { input: "Y\n" });
  process.exit(st);
}

if (action === "cors-list") {
  const st = run(["cors", "list", "-e", ENV_ID]);
  process.exit(st);
}

if (action === "hosting-deploy") {
  const stage = path.join(os.tmpdir(), "ytm-deploy");
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  for (const f of ["index.html", "package.json"]) {
    cpSync(f, path.join(stage, f));
  }
  for (const d of ["src", "assets"]) {
    cpSync(d, path.join(stage, d), { recursive: true });
  }
  console.log("== 部署静态文件:", stage);
  const st = run(["hosting", "deploy", stage, "-e", ENV_ID]);
  process.exit(st);
}

console.error("未知操作:", action);
process.exit(1);
