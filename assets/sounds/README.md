# assets/sounds · 音效资源

当前版本（V1）音效由 `src/ui/sound.js` 用 **WebAudio 实时合成**，无音频文件依赖，默认静音（右上角开关）。

已实现音效：`click`（点击）/ `draw`（抽牌）/ `flip`（翻牌）/ `reveal`（揭示）/ `result`（结果）。

如需替换为真实音频：

1. 将文件放入本目录：`click.mp3`、`draw.mp3`、`flip.mp3`、`reveal.mp3`、`result.mp3`；
2. 修改 `src/ui/sound.js` 的 `play(name)`，改为：
   ```js
   new Audio("assets/sounds/" + name + ".mp3").play();
   ```
