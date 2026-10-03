# 研途秘典

> 你的保研之路，究竟会通向哪里？

一款面向中国大学生的**轻量级娱乐网页游戏**：保研 × 塔罗牌 × 命运占卜 × 大学生活 × 轻心理测试。
写下你的问题，抽取命运之牌，让随机叙事诱发一次关于自己的思考。

> 本游戏结果仅供娱乐，不构成真实的升学预测或决策依据。

---

## ✨ 已实现功能

- **完整占卜流程**：首页 → 选择主题（8 类）→ 当前状态 + 自由提问 → 选择牌阵 → 抽牌 → 3D 翻牌 → 逐牌解读 → 完整结果 → 分享卡
- **22 张大阿卡纳**（21 张传统重构 + 原创牌「求索者」），全部结合保研语境撰写；正位 / 逆位双面含义
- **3 种牌阵**：单牌占卜「今日研途启示」、三牌阵「过去·现在·未来」、五牌「保研命运阵」（核心牌阵）
- **8 大占卜主题**：保研总运 / 学校选择 / 科研运 / 夏令营·预推免 / 导师缘 / 最大阻碍 / 竞争力 / 年度关键词
- **结果生成引擎**：纯本地规则系统（JSON 数据 + JS 组装），无后端、无 API、无数据库
- **研途命运卡**：Canvas 生成 1080×1440 分享图（暗金双框 + 星图 + 红色印章），支持下载 / 长按保存 / 复制
- **命运簿**：本地记录最近 30 次占卜，刷新、关闭页面后仍可回看
- **仪式感视觉**：Canvas 星空粒子背景、法阵首页、逐段浮现的结果页
- **真实卡面插画**：21 张 Rider–Waite–Smith 公有领域塔罗插画 + Flammarion 版画（原创牌「求索者」），插画加载失败时自动回落程序化星图
- **真实音效**：5 个 WAV 音频文件（点击/抽牌/翻牌/揭示/结果），WebAudio 合成器兜底，默认静音，右上角开关
- **移动端优先**：手机 / 平板 / PC 自适应，安全区适配，触控翻牌
- **无障碍**：`prefers-reduced-motion` 支持、键盘焦点样式、语义化标签

## 🚀 如何启动

**零依赖、零构建、零网络请求**，三种方式任选：

### 方式一：直接双击（最简单）

双击 `index.html` 即可在浏览器中运行。所有脚本均为普通 `<script>`（非 ES Module），不受 `file://` 协议限制。

### 方式二：本地静态服务器

```bash
# Node（任选其一）
npx serve .            # 或 npm run serve
# Python
python -m http.server 8080
```

打开 `http://localhost:8080`。

### 方式三：部署后访问

见下文「如何部署到互联网」。

### 运行测试（可选）

```bash
node scripts/test.mjs     # 逻辑层：数据完整性 / 随机系统 / 解读引擎（9600+ 断言）
node scripts/smoke.mjs    # 启动冒烟：DOM 桩下真实执行 boot 与完整旅程
node scripts/e2e.mjs      # 真实浏览器 E2E（需本机 Chrome/Edge，Node ≥ 22）
node scripts/http_check.py  # 部署冒烟：校验静态服务器各资源 200 与 UTF-8 内容（可选）
```

`test.mjs` 覆盖：卡牌/牌阵/主题数据完整性、1000 次随机抽牌（无重复、正逆位比例）、
全部 8 主题 × 3 牌阵 × 20 种子 = 480 次解读有效性、同种子可复现、障碍词池覆盖、禁止概率/承诺表述等。
`e2e.mjs` 通过 Chrome DevTools 协议驱动真实浏览器，验证桌面 + 移动视口下的完整旅程、布局边界与 JS 异常，并输出截图。

## 📁 项目结构

```
yan-tu-mi-dian/
├── index.html              # 入口（页面骨架 + 脚本加载顺序）
├── package.json            # 仅含 test / serve 脚本，无任何依赖
├── scripts/
│   ├── test.mjs            # Node 逻辑层自动化测试
│   ├── smoke.mjs           # 启动冒烟测试（DOM 桩）
│   ├── e2e.mjs             # 真实浏览器 E2E（Chrome DevTools 协议）
│   ├── http_check.py       # HTTP 部署冒烟检查（可选）
│   ├── process_cards.py    # 卡面插画后处理（下载自 Wikimedia Commons，Pillow）
│   └── make_sounds.py      # 音效 WAV 生成（numpy）
├── src/
│   ├── main.js             # 主控制器：状态机 / 路由 / 页面渲染 / 事件
│   ├── data/
│   │   ├── cards.js        # ★ 22 张卡牌数据
│   │   ├── spreads.js      # ★ 3 种牌阵
│   │   ├── questions.js    # ★ 8 个占卜主题 + 状态选项
│   │   └── tips.js         # 命运提示池（47 条）
│   ├── game/
│   │   ├── random.js       # Fisher-Yates 洗牌 / 正逆位随机
│   │   ├── draw.js         # 组装一次占卜（纯函数）
│   │   └── interpretation.js  # 结果生成引擎（纯函数）
│   ├── ui/
│   │   ├── starfield.js    # 星空粒子背景
│   │   ├── sound.js        # WebAudio 合成音效
│   │   ├── storage.js      # 命运簿（localStorage）
│   │   ├── cards-ui.js     # 程序化 SVG 卡面
│   │   └── share.js        # Canvas 分享卡
│   └── styles/             # global / home / cards / screens / result
└── assets/
    ├── cards/              # ★ 22 张卡面插画（公有领域图源，见目录内 README）
    ├── sounds/             # ★ 5 个音效 WAV（本地生成，见目录内 README）
    └── backgrounds/        # 预留目录（含背景图替换说明）
```

所有文件通过全局命名空间 `YTM` 协作，`index.html` 底部的 `<script>` 顺序即加载顺序，**请勿打乱**。

## 🃏 如何修改卡牌

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
    obstacle: ["过度焦虑"],  // 见障碍词池：拖延/信息差/过度焦虑/选择困难/简历不足/科研不足/沟通不足/目标分散
    ability: "硬实力"        // 硬实力 | 软实力 | 心态 | 信息
  }
}
```

改完运行 `node scripts/test.mjs` 即可验证数据完整性。**注意**：文本请保持「叙事引导」调性，
不要出现百分比、承诺性结论（测试会自动拦截这类表述）。

## 🀄 如何增加新的牌阵

编辑 `src/data/spreads.js`，在数组中追加：

```js
{
  id: "seven",               // 唯一 id
  name: "七星阵",
  alias: "七重天机",
  count: 7,                  // 卡牌数（≤ 卡池总数 22）
  desc: "……",
  positions: [               // 必须与 count 一致，label 会显示在牌下方
    { label: "第一重", desc: "……" },
    // ……共 7 个
  ]
}
```

其余自动生效：主题页→牌阵选择→抽牌→翻牌→解读全部由引擎按 `count` 与 `positions` 驱动。
如需为七星阵定制画像段落，在 `src/game/interpretation.js` 的 `buildPortrait` 中按 `reading.spread.id === "seven"` 增加分支。

## ❓ 如何增加新的问题类型（主题）

编辑 `src/data/questions.js`：

```js
{
  id: "internship",          // 唯一 id
  title: "实习运",
  glyph: "❁",               // 纯字符符号（非 emoji），主题卡上的视觉标记
  sample: "我的实习运势怎么样？",
  desc: "……"
}
```

然后在三处接入：

1. **提示池**（可选）：在 `src/data/tips.js` 中加几条 `themes: ["internship"]` 的提示；
2. **语境映射**（可选）：若希望抽到的牌显示专属语境文本，给 `src/data/cards.js` 每张牌的
   `context` 增加 `internship: "……"` 字段，并在 `src/game/interpretation.js` 的
   `CONTEXT_KEY` 中登记 `internship: "internship"`（未登记时自动回退到 `general`）；
3. **画像模板**（推荐）：在 `interpretation.js` 的 `buildPortrait` 中增加
   `else if (t === "internship")` 分支，参照其他主题用 `c0/c1/cLast` 与卡牌字段拼段落。

## 🌐 如何部署到互联网

项目是纯静态站点，直接上传整个目录即可：

| 平台 | 步骤 |
|---|---|
| **GitHub Pages** | 推到 GitHub 仓库 → Settings → Pages → 选择分支（root）→ 访问 `https://用户名.github.io/仓库名` |
| **Netlify / Vercel** | 拖拽目录或连接仓库，Build command 留空，Publish directory 选根目录，自动部署 |
| **任何静态托管** | OSS / COS / Nginx / 宝塔：把整个 `yan-tu-mi-dian` 目录内容上传到站点根目录 |
| **校内/局域网** | 局域网内跑 `python -m http.server 8080`，同网段设备访问 `http://你的IP:8080` |

无跨域请求、无 API Key、无后端，因此不存在「部署后接口 404」类问题。
上线前建议跑一次 `python scripts/http_check.py`（先起一个本地服务并修改脚本里的端口）。

## 🔭 下一阶段（V2）可以增加的功能

1. **AI 命运解读**（需求文档中的 V2 功能）：在结果页增加「让 AI 解读者细说」入口，
   把 `{主题, 用户问题, 抽到的牌, 正逆位}` 发送给任意 LLM API；保持现有本地引擎作为
   fallback，并把免责声明写进 AI 提示词（AI 是游戏里的「解读者」，不是预测工具）。
2. **小阿卡纳扩展**：按「权杖（行动）/ 圣杯（心态）/ 宝剑（选择）/ 星币（积累）」四组
   原创保研牌，扩充到 78 张，引擎无需改动。
3. **更多牌阵**：凯尔特十字等，按上文「如何增加新的牌阵」扩展。
4. **PWA 离线安装**：加 manifest + Service Worker，手机上可「添加到主屏幕」。
5. **插画精细化**：为插画做统一的暗金调色/描边处理，或委托原创卡面；高分辨率版本配合懒加载。
6. **分享图个性化**：把用户的问题、状态、学校梯度等印在命运卡上；增加「朋友帮我抽」模式。
7. **数据统计彩蛋**：命运簿里统计「抽到最多的牌 / 最常见关键词」，生成年度研途回顾。

## 🖼️ 素材与版权

- **卡面插画**：Rider–Waite–Smith 塔罗牌（1909 年，美国公有领域）与 Flammarion 木刻版画（1888 年，公有领域），均来自 Wikimedia Commons；来源与授权详情见 [assets/cards/README.md](assets/cards/README.md)。
- **音效**：由 `scripts/make_sounds.py` 本地合成生成，无第三方版权。
- **代码与文案**：本项目原创。

## ⚖️ 设计原则（写给后续维护者）

- 随机只决定**叙事**，绝不输出「你一定能 / 有 X% 概率」类结论（测试会拦截）；
- 逆位不是坏结果，而是「需要留意的另一面」；
- 每屏只有一个主按钮；所有用户输入只经 `textContent` 或 `esc()` 渲染；
- 动画遵循 `prefers-reduced-motion`；抽牌/翻牌期间锁定交互防止连点；
- 文案调性：神秘、有一点哲学、有一点大学生语境，不制造焦虑、不过度鸡汤。
