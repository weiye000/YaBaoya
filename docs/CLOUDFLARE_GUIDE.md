# 研途秘典 · Cloudflare 部署与运维指南

> 线上地址：**https://yantu-midian.yabaoyan.workers.dev**
> 架构：Cloudflare Worker（接口 + 静态托管）+ D1 数据库（SQLite）　**全部在免费额度内，无需 ICP 备案**

---

## 一、这套方案能实现什么

| 能力 | 实现方式 | 免费额度 |
|---|---|---|
| 网页托管 | Worker Static Assets | 不限流量 |
| 后端接口 | Worker（`/api/*`） | 10 万请求/天 |
| 数据库 | D1（SQLite） | 5GB / 500 万读/天 |
| 匿名进入 | 设备身份 + HMAC 签名令牌（180 天） | — |
| 账号注册 / 登录 | 用户名 + 密码（客户端 PBKDF2 150k 次派生） | — |
| 云命运簿 | 登录按账号、访客按 8 位同步码 | — |
| 心事墙 | 发帖 / 点亮（主键去重） | — |
| Yaya 管理台 | 用户名 `Yaya` → 令牌内含管理员角色 | — |
| 自定义域名 | 域名 NS 指向 Cloudflare 即可 | 免费，**无需备案** |

---

## 二、目录与文件

```
cloudflare/
├── wrangler.toml        # Worker 配置（D1 绑定、静态资源绑定）
├── worker/index.js      # 后端全部逻辑（注册/登录/匿名/心事墙/命运簿/管理台）
├── public/              # 部署产物（由脚本从仓库根同步，已 gitignore）
└── .session-secret      # 会话签名密钥（自动生成，已 gitignore）
scripts/
├── cf_deploy.mjs        # 部署助手：stage / deploy / check
├── cf_flow_check.mjs    # 后端全链路自检（19 项）
├── cf_browser_check.mjs # 线上真机验证（真实浏览器走完整流程）
├── cf_db.mjs            # 数据库维护：stats / users / wishes / clean-test / del-user / del-wish
└── cf_shots.mjs         # 线上页面截图
src/backend/worker.js    # 前端适配器（fetch 调自家接口，无需任何 SDK）
```

---

## 三、日常运维命令

```bash
# 改完代码后重新部署（会自动同步游戏文件 + 上传 Worker）
set CLOUDFLARE_API_TOKEN=xxx
set CLOUDFLARE_ACCOUNT_ID=xxx
node scripts/cf_deploy.mjs deploy

# 后端全链路自检（注册/登录/心事墙/命运簿/管理台，19 项）
set YTM_WORKER_URL=https://yantu-midian.yabaoyan.workers.dev
node scripts/cf_flow_check.mjs

# 线上真机验证（真实浏览器 + 截图）
node scripts/cf_browser_check.mjs

# 数据库查看与维护
node scripts/cf_db.mjs stats        # 各表数据量
node scripts/cf_db.mjs users        # 列出注册用户
node scripts/cf_db.mjs wishes       # 列出心事
node scripts/cf_db.mjs del-user 某人 # 删除用户
node scripts/cf_db.mjs del-wish 12   # 删除心事
node scripts/cf_db.mjs clean-test    # 清理测试数据
```

---

## 四、数据表结构（D1）

| 表 | 字段 | 说明 |
|---|---|---|
| `users` | id, username, verifier, salt, role, admin_token, created_at | 账号；`verifier = sha256(客户端PBKDF2 + salt)`，不存明文密码 |
| `readings` | id, code, owner, seed, theme_title, spread_name, keyword, final_card_name, payload, created_at | 每次占卜一条；登录存 `owner`，访客存 `code`（同步码） |
| `wishes` | id, text, keyword, device, created_at | 心事墙帖子 |
| `lights` | wish_id, device, created_at（主键 wish_id+device） | 点亮记录，主键天然防重复 |

---

## 五、安全设计

1. **密码**：明文只在浏览器内用于 PBKDF2（15 万次）派生，服务端只存 `sha256(派生值 + 随机盐)`
2. **会话**：HMAC-SHA256 签名令牌（密钥存 Cloudflare Secret，不在仓库），伪造即校验失败
3. **管理员**：用户名 `Yaya` 在服务端被赋予 `role=admin`，角色写在**签名令牌**里；普通用户访问 `/api/admin/*` 返回「管理员验证失败」（已实测）
4. **数据隔离**：访客只能按自己的同步码读取自己的命运簿；`users` 表不对任何客户端暴露
5. **密钥管理**：`cloudflare/.session-secret`、Cloudflare API Token 均已 gitignore，未进入仓库

---

## 六、挂自己的域名（可选，仍无需备案）

1. 在你买域名的平台（腾讯云/阿里云/Namecheap 等）把 **NS 记录**改成 Cloudflare 提供的两个地址
   （Cloudflare 控制台 → 添加站点 → 输入 `yayabaoyan.com` → 选择 Free 计划 → 得到两个 NS）
2. 等 DNS 生效（几分钟到几小时）
3. Cloudflare 控制台 → Workers & Pages → `yantu-midian` → Settings → Domains & Routes → **Add custom domain** → 填你的域名
4. 完成：游戏跑在你的域名上，HTTPS 自动签发，**不需要 ICP 备案**

> 备案只在国内服务器（腾讯云/阿里云大陆节点）才需要；Cloudflare 是境外节点，因此无需备案。
> 代价：国内访问速度中等（可用，但不如国内服务器快）。
