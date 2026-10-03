# assets/cards · 卡面插画

V1.1 起，22 张卡牌使用**真实塔罗插画**（本目录内的 JPG 文件）：

| 来源 | 授权 | 说明 |
|---|---|---|
| Rider–Waite–Smith 塔罗牌（1909，英国首版） | 美国公有领域 | 21 张大阿卡纳，来自 [Wikimedia Commons](https://commons.wikimedia.org/)（文件名形如 `RWS_Tarot_00_Fool.jpg`） |
| Flammarion 木刻版画（1888，出自 Camille Flammarion《L'atmosphère》） | 公有领域 | 原创牌「求索者」的画面（原图为横版，已按卡面比例裁剪），来自 [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Flammarion.jpg) |

文件名与卡牌 `id` 一一对应（见 `src/data/cards.js`），如 `fool.jpg`、`seeker.jpg`。

> 授权说明：两套图源均处于公有领域（美国）。若在其他司法辖区或用于商业发布，请自行确认当地版权规则。

## 加载失败时的兜底

`src/ui/cards-ui.js` 会在插画**之下**绘制程序化星图徽记：插画正常加载时完全遮盖星图；
若图片缺失/加载失败，卡面自动回落到此前的星图样式，游戏功能不受影响。

## 更换插画

1. 直接用同名文件替换本目录中的 JPG（建议竖版、比例接近 208:368，宽 ≥ 480px 更清晰）；
2. 无需改任何代码——牌面、翻牌动画、分享卡都会自动使用新图。

## 重新生成/后处理

下载脚本与裁剪逻辑见 `scripts/process_cards.py`（依赖 Pillow）：
`python scripts/process_cards.py`
