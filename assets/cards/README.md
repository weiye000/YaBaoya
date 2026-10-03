# assets/cards · 卡面资源

当前版本（V1）卡面**不使用图片文件**，22 张牌全部由 `src/ui/cards-ui.js` 程序化生成 SVG：

- 牌面：卡牌专属双色渐变 + 暗金双框 + 星图徽记（以卡牌编号为种子的程序化星座）+ 牌名 + 关键词
- 牌背：靛蓝晶格 + 八芒星法阵

如需替换为真实插画：

1. 将图片命名为 `card_<id>.svg`（id 见 `src/data/cards.js`）放入本目录；
2. 修改 `src/ui/cards-ui.js` 中 `cardFaceSVG()`，改为输出 `<img src="assets/cards/card_<id>.svg">`；
3. 分享图 `src/ui/share.js` 中 `drawMiniCard()` 可同步替换为 `drawImage`。
