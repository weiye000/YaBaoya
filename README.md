# 研途秘典

> 你的保研之路，究竟会通向哪里？

**线上体验：<https://yantu-midian.yabaoyan.workers.dev>**

一款面向中国大学生的**轻量级娱乐网页游戏**：保研 × 塔罗牌 × 命运占卜 × 大学生活 × 轻心理测试。
写下你的问题，抽取命运之牌，让随机叙事诱发一次关于自己的思考。

> 本游戏结果仅供娱乐，不构成真实的升学预测或决策依据。

---

## 一、这是什么

一次完整占卜的流程：

```
首页 → 身份选择门（登录 / 注册 / 匿名进入）
     → 选择主题（8 类）
     → 填写当前状态 + 自由提问
     → 选择牌阵（3 种）
     → 抽牌 → 3D 翻牌 → 逐牌解读 → 完整结果
     → 生成「研途命运卡」分享图
```

云端（Cloudflare 免费额度内）提供：匿名身份、账号注册登录、云命运簿、图鉴云同步、心事墙、管理员台。

## 二、设计原则

1. **娱乐优先，不制造焦虑**：随机只决定**叙事**，绝不输出「你一定能 / 有 X% 概率」这类结论（自动化测试会直接拦截这类文案与标点堆叠）。
2. **逆位不是坏结果**：逆位读作「需要留意的另一面」，落在不同牌阵位置时有各自的叙事。
3. **零依赖、零构建**：纯 HTML/CSS/JS，全局命名空间 `YTM` 协作，没有 npm 依赖、没有打包步骤，双击 `index.html` 就能跑。
4. **配置驱动内容**：卡牌、牌阵、主题、提示池全是纯数据文件，改数据即可扩展，不改引擎。
5. **同源架构，拒绝复杂度**：前端用 `fetch('/api/...')` 调自家后端，天然无跨域，不需要任何第三方 SDK。
6. **安全默认**：明文密码不离开浏览器（PBKDF2 派生）；服务端只存加盐哈希；会话与管理员身份由 HMAC 签名令牌承载；密钥永不进仓库。
7. **优雅降级**：后端不可用时游戏自动退回单机模式（数据只存本机），心事墙显示演示数据，绝不白屏。
8. **移动端优先 + 无障碍**：手机/平板/PC 自适应，安全区适配，遵循 `prefers-reduced-motion`，键盘焦点可见，用户输入一律经 `textContent` / `esc()` 渲染。

## 三、已实现功能

### 游戏内

- **完整占卜流程**：首页 → 身份门 → 主题 → 状态与提问 → 牌阵 → 抽牌 → 翻牌 → 逐牌解读 → 结果 → 分享卡
- **22 张大阿卡纳**：21 张传统重构 + 原创牌「求索者」，全部结合保研语境撰写，正位 / 逆位双面含义
- **3 种牌阵**：单牌「今日研途启示」、三牌「过去·现在·未来」、五牌「保研命运阵」（核心牌阵）
- **8 大主题**：保研总运 / 学校选择 / 科研运 / 夏令营·预推免 / 导师缘 / 最大阻碍 / 竞争力 / 年度关键词
- **逐牌详解（自洽叙事）**：每张牌按「牌阵位置 × 正逆位 × 占卜主题」三层语境生成解读；逆位落在优势位、正位落在阻碍位等四种组合各有独立叙事，画像段落与逐牌解读互相呼应，用户填写的状态与问题会被文案回应
- **研途命运卡（命运星图）**：Canvas 生成 1080×1440 分享图——顶部枢纽星发出命运扇面，本次抽到的**全部卡牌**（1/3/5 张）沿星轨扇形展开、星线相连，每张牌下方标注位置与牌名/正逆位/关键词；支持下载 / 长按保存 / 复制
- **命运簿**：记录最近 30 次占卜，随时回看
- **研途图鉴**：收集 22 张大阿卡纳，集齐解锁「秘典之证」
- **仪式感视觉**：Canvas 星空粒子、法阵首页、逐段浮现的结果页
- **真实素材**：21 张 Rider–Waite–Smith 公有领域插画 + Flammarion 版画（原创牌）；5 个本地合成 WAV 音效，默认静音、右上角开关

### 云端（Cloudflare Worker + D1，全部免费额度内）

- **身份选择门**：点「开始占卜」先进「研途之门前」，可**注册/登录账号**进入，或**匿名进入**（设备身份，无需注册）
- **账号体系**：用户名 + 密码；注册即登录；`Yaya` 为管理员
- **云命运簿**：登录用户按账号同步（换设备登录即恢复）；访客按 **8 位同步码**同步（可随时升级为账号）
- **研途图鉴云收集**：跟随命运簿同步
- **心事墙**：匿名发帖（140 字），全员可见、可点亮；同一设备对同一帖只能点亮一次（数据库主键去重）
- **管理员台**：`Yaya` 登录后自动进入——注册用户列表、全局统计（用户 / 命运簿 / 心事 / 点亮）、心事管理（删帖）
- **离线/单机模式**：后端未配置或不可用时自动降级，游戏照常可玩

## 四、技术架构

### 分层

```
┌──────────────────────── 玩家浏览器 ────────────────────────┐
│ 前端（纯静态，无框架）                                      │
│   index.html → src/data → src/game → src/backend → src/ui → src/main.js
│   数据层：cards / spreads / questions / tips（纯 JSON 式数据）│
│   引擎层：random / draw / interpretation（纯函数）           │
│   表现层：starfield / sound / storage / cards-ui / share     │
│   控制层：main.js（状态机 + 路由 + 渲染 + 事件委托）           │
└───────────────────────────┬───────────────────────────────┘
                            │ fetch('/api/...')（同源，无跨域）
┌───────────────────────────▼───────────────────────────────┐
│ Cloudflare Worker（cloudflare/worker/index.js）            │
│   /api/session  匿名会话（设备身份 + HMAC 签名令牌）          │
│   /api/register /api/login  账号（PBKDF2 派生值 + 加盐哈希）  │
│   /api/me       会话校验                                    │
│   /api/history  GET/POST  命运簿（登录按账号、访客按同步码）   │
│   /api/wishes   GET/POST  心事墙                            │
│   /api/lights   POST      点亮（主键去重）                    │
│   /api/admin/*  GET/DELETE 管理台（仅管理员）                 │
│ 静态资源由同一 Worker 托管（Assets 绑定）                     │
└───────────────────────────┬───────────────────────────────┘
                            │ SQL
┌───────────────────────────▼───────────────────────────────┐
│ D1 数据库（SQLite）                                        │
│   users / readings / wishes / lights                      │
└───────────────────────────────────────────────────────────┘
```

**为什么这样设计**：前后端同源，前端不需要任何 SDK、不需要配置安全域名、不需要处理跨域；权限逻辑写在自家后端代码里，不进平台黑盒。

### 一次请求的流程

- 玩家打开 `https://你的域名/` → Cloudflare 返回静态 `index.html`、`src/*`、`assets/*`
- 游戏内触发占卜结果保存 → `POST /api/history`（带 `Authorization: Bearer <会话令牌>`）
- Worker 校验令牌 → 写入 D1 → 返回 JSON → 前端提示「已存入命运簿」

### 数据表

| 表 | 字段 | 说明 |
|---|---|---|
| `users` | `id, username, verifier, salt, role, admin_token, created_at` | `verifier = sha256(客户端 PBKDF2 值 + 服务端随机盐)`，不存明文密码 |
| `readings` | `id, code, owner, seed, theme_title, spread_name, keyword, final_card_name, payload, created_at` | 每次占卜一条；登录写 `owner`（用户 id），访客写 `code`（同步码）；`payload` 为整局快照 |
| `wishes` | `id, text, keyword, device, created_at` | 心事墙帖子 |
| `lights` | `wish_id, device, created_at`，主键 `(wish_id, device)` | 点亮记录，主键天然防重复 |

### 目录结构

```
yan-tu-mi-dian/
├── index.html                 # 入口（页面骨架 + 脚本加载顺序，勿打乱）
├── cloudflare/                # ★ 云端（Cloudflare Worker + D1）
│   ├── wrangler.toml          #   部署配置：D1 绑定、静态资源目录
│   ├── worker/index.js        #   后端全部逻辑（接口 + 路由）
│   ├── public/                #   部署产物（脚本生成，已 gitignore）
│   └── .session-secret        #   会话签名密钥（本地保存，已 gitignore）
├── src/
│   ├── main.js                # 控制层：状态机 / 路由 / 渲染 / 事件委托
│   ├── config.backend.js      # ★ 后端配置（provider / apiBase）
│   ├── backend/
│   │   ├── adapter.js         #   统一接口（游戏只认它，不感知具体后端）
│   │   ├── worker.js          #   Cloudflare Worker 适配器（fetch 调 /api）
│   │   └── local.js           #   单机/离线模式（测试与降级用）
│   ├── data/
│   │   ├── cards.js           # ★ 22 张卡牌数据
│   │   ├── spreads.js         # ★ 3 种牌阵
│   │   ├── questions.js       # ★ 8 个主题 + 状态选项
│   │   └── tips.js            #   命运提示池（47 条）
│   ├── game/
│   │   ├── random.js          #   Fisher-Yates 洗牌 / 正逆位随机
│   │   ├── draw.js            #   组装一次占卜（纯函数）
│   │   └── interpretation.js  #   结果生成引擎（纯函数）
│   ├── ui/
│   │   ├── starfield.js       #   星空粒子背景
│   │   ├── sound.js           #   音效（WAV + WebAudio 合成兜底）
│   │   ├── storage.js         #   命运簿本地存储
│   │   ├── cards-ui.js        #   程序化 SVG 卡面
│   │   └── share.js           #   Canvas 分享卡（命运星图）
│   └── styles/                #   global / home / cards / screens / result
├── scripts/                   # 测试、部署、运维脚本（全部 Node，无依赖）
│   ├── test.mjs               #   逻辑层自动化测试（16540 项断言）
│   ├── smoke.mjs              #   启动冒烟（DOM 桩下跑完整旅程）
│   ├── e2e.mjs                #   真实浏览器 E2E（Chrome DevTools 协议 + 截图）
│   ├── cf_deploy.mjs          #   部署助手：stage / deploy / check
│   ├── cf_flow_check.mjs      #   后端全链路自检（19 项）
│   ├── cf_browser_check.mjs   #   线上真机验证（真实浏览器走完整流程）
│   ├── cf_db.mjs              #   数据库维护：stats / users / wishes / clean-test
│   ├── cf_shots.mjs           #   线上页面截图
│   ├── http_check.py          #   HTTP 部署冒烟（可选）
│   ├── process_cards.py       #   卡面插画后处理（Pillow）
│   └── make_sounds.py         #   音效 WAV 生成（numpy）
├── docs/
│   ├── CLOUDFLARE_GUIDE.md    #   部署运维指南（命令、表结构、挂域名）
│   └── shots/                 #   线上截图
└── assets/
    ├── cards/                 # 22 张卡面插画（公有领域，见目录内 README）
    ├── sounds/                # 5 个音效 WAV（本地生成）
    └── backgrounds/           # 预留目录
```

## 五、本地运行与测试

**零依赖、零构建**，三种方式任选：

```bash
# 方式一：直接双击 index.html（最简单）

# 方式二：本地静态服务器
python -m http.server 8080     # 或 npx serve .
# 打开 http://localhost:8080
```

跑测试：

```bash
node scripts/test.mjs     # 逻辑层：数据完整性 / 随机系统 / 解读引擎（16540 项断言）
node scripts/smoke.mjs    # 启动冒烟：DOM 桩下真实执行 boot 与完整旅程
node scripts/e2e.mjs      # 真实浏览器 E2E（需本机 Chrome/Edge，Node ≥ 22，输出截图）
```

`test.mjs` 覆盖：卡牌/牌阵/主题数据完整性、1000 次随机抽牌（无重复、正逆位比例）、
全部 8 主题 × 3 牌阵 × 20 种子 = 480 次解读有效性、同种子可复现、障碍词池覆盖、
位置 × 正逆位叙事一致性、禁止概率/承诺表述与标点堆叠等。

`e2e.mjs` 通过 Chrome DevTools 协议驱动真实浏览器（内置 HTTP 静态服务器模拟生产同源环境），
验证桌面 + 移动视口下的完整旅程、分享卡星像素级绘制、布局边界与 JS 异常。

## 六、部署（Cloudflare，免费且无需备案）

### 首次部署

```bash
# 1) 建库（一次性；也可在 Cloudflare 控制台建）
#    表结构见「四、技术架构 → 数据表」
# 2) 配置并部署（会自动同步游戏文件 + 上传 Worker）
set CLOUDFLARE_API_TOKEN=你的令牌
set CLOUDFLARE_ACCOUNT_ID=你的账号ID
node scripts/cf_deploy.mjs deploy
```

### 验证

```bash
set YTM_WORKER_URL=https://你的域名
node scripts/cf_flow_check.mjs      # 后端全链路自检 19 项
node scripts/cf_browser_check.mjs   # 线上真机验证（真实浏览器 + 截图）
```

### 日常运维

```bash
node scripts/cf_deploy.mjs deploy    # 改完代码重新上线（必须执行，否则线上不变）
node scripts/cf_db.mjs stats         # 数据量总览
node scripts/cf_db.mjs users         # 列出注册用户
node scripts/cf_db.mjs wishes        # 列出心事
node scripts/cf_db.mjs del-user 某人  # 删除用户
node scripts/cf_db.mjs del-wish 12    # 删除心事
node scripts/cf_db.mjs clean-test     # 清理测试数据
```

### 绑定自己的域名

域名注册商处把 **NS 记录**改为 Cloudflare 分配的两个名称服务器 → Cloudflare 控制台
Workers & Pages → 你的 Worker → Settings → Domains & Routes → Add → Custom domain → 填入域名。
**无需 ICP 备案**（Cloudflare 为境外节点）。详见 [docs/CLOUDFLARE_GUIDE.md](docs/CLOUDFLARE_GUIDE.md)。

## 七、怎么改内容

### 修改卡牌

编辑 `src/data/cards.js`。每张卡的结构：

```js
{
  id: "chariot",            // 唯一 id（勿与现有重复）
  no: 7,                    // 编号（决定星图徽记的种子）
  name: "战车",
  en: "The Chariot",
  palette: ["#d04a55", "#551a20"],   // [亮色, 暗色]，用于牌面渐变
  keyword: { u: "冲刺", r: "失控" }, // 正位/逆位关键词
  meaning: {                // 双面含义
    u: { core: "目标明确、全速推进的意志。",      // 核心句（必须）
         light: ["极强的目标感和行动力", "……"],  // 正向要点 ≥2 条（优势位取用）
         shadow: ["只盯目标，忽略身体", "……"] },  // 暗面要点 ≥2 条（短板/阻碍位取用）
    r: { core: "方向混乱或过度消耗的冲刺。", light: ["…"], shadow: ["…"] }
  },
  general: "对保研而言，……",     // 通用保研语境
  context: {                  // 五大主题语境（必填）
    school: "……", research: "……", mentor: "……", camp: "……", obstacle: "……"
  },
  advice: { u: "冲刺要有配速……", r: "先确认方向，再踩油门。" },
  tags: {
    schoolStyle: "冲刺型",   // 冲刺型 | 稳妥型 | 匹配型 | 地域偏好 | 学科匹配
    mentorType: "严师型",    // 引路人型 | 严师型 | 放养型 | 伙伴型
    obstacle: ["过度焦虑"],  // 池：拖延/信息差/过度焦虑/选择困难/简历不足/科研不足/沟通不足/目标分散
    ability: "硬实力"        // 硬实力 | 软实力 | 心态 | 信息
  }
}
```

改完运行 `node scripts/test.mjs` 验证数据完整性。文案请保持「叙事引导」调性，不要出现百分比或承诺性结论。

### 增加牌阵

编辑 `src/data/spreads.js`，追加：

```js
{
  id: "seven",
  name: "七星阵",
  alias: "七重天机",
  count: 7,                  // 卡牌数（≤ 卡池 22）
  desc: "……",
  positions: [               // 必须与 count 一致，label 显示在牌下方
    { label: "第一重", desc: "……" }
    // ……共 7 个
  ]
}
```

其余自动生效（主题页 → 牌阵选择 → 抽牌 → 翻牌 → 解读都由 `count` + `positions` 驱动）。
如需为它定制画像段落，在 `src/game/interpretation.js` 的 `buildPortrait` 里按 `reading.spread.id === "seven"` 加分支。

### 增加主题（问题类型）

编辑 `src/data/questions.js`：

```js
{ id: "internship", title: "实习运", glyph: "❁", sample: "我的实习运势怎么样？", desc: "……" }
```

然后按需接入三处：

1. **提示池**（可选）：`src/data/tips.js` 增加 `themes: ["internship"]` 的提示；
2. **语境映射**（可选）：给 `cards.js` 每张牌的 `context` 增加 `internship` 字段，并在
   `interpretation.js` 的 `CONTEXT_KEY` 登记（未登记自动回退 `general`）；
3. **画像模板**（推荐）：在 `interpretation.js` 的 `buildPortrait` 增加分支。

### 修改云端逻辑

- 接口逻辑：`cloudflare/worker/index.js`（改完必须 `node scripts/cf_deploy.mjs deploy`）
- 前端调用：`src/backend/worker.js`（保持 `adapter.js` 暴露的接口签名不变，游戏代码无需改动）

## 八、安全设计

| 环节 | 做法 |
|---|---|
| 密码 | 明文只在浏览器内用于 **PBKDF2（15 万次）** 派生；服务端只存 `sha256(派生值 + 随机盐)` |
| 会话 | **HMAC-SHA256 签名令牌**（密钥存 Cloudflare Secret，不在仓库）；伪造令牌校验必失败 |
| 管理员 | 用户名 `Yaya` 由服务端赋予 `role=admin`，角色写在**签名令牌**里；普通用户访问 `/api/admin/*` 返回「管理员验证失败」（已实测） |
| 数据隔离 | 访客只能按自己的同步码读取自己的命运簿；`users` 表不对任何客户端暴露 |
| 输入 | 用户名/密码有格式校验，心事限 140 字，所有用户输入经 `textContent` / `esc()` 渲染 |
| 密钥管理 | `.session-secret`、Cloudflare API 令牌均列入 `.gitignore`，从不进入仓库 |

## 九、下一阶段可以做的

1. **AI 命运解读**：结果页增加「让 AI 解读者细说」，把 `{主题, 问题, 牌, 正逆位}` 交给 LLM；本地引擎保留为 fallback，免责声明写进提示词
2. **小阿卡纳扩展**：权杖/圣杯/宝剑/星币四组原创保研牌，扩到 78 张，引擎无需改动
3. **更多牌阵**：凯尔特十字等
4. **PWA 离线安装**：manifest + Service Worker，「添加到主屏幕」
5. **分享图个性化**：把问题、状态、学校梯度印在命运卡上；「朋友帮我抽」模式
6. **每日一签 / 好友互抽**：每天全服共享一张牌、生成口令让朋友替你抽
7. **数据统计彩蛋**：命运簿统计「抽到最多的牌 / 最常见关键词」，生成年度研途回顾
8. **push 自动部署**：GitHub Actions 调 wrangler，免去手动部署

## 十、素材与版权

- **卡面插画**：Rider–Waite–Smith 塔罗牌（1909，美国公有领域）与 Flammarion 木刻版画（1888，公有领域），来自 Wikimedia Commons；来源与授权见 [assets/cards/README.md](assets/cards/README.md)
- **音效**：由 `scripts/make_sounds.py` 本地合成，无第三方版权
- **代码与文案**：本项目原创
