# assets/backgrounds · 背景资源

当前版本（V1）星空背景由 `src/ui/starfield.js` 用 Canvas 粒子实时渲染（漂移 + 闪烁，自动适配暗色主题与低性能设备）。

如需替换为静态背景图：

1. 将图片放入本目录（如 `night.jpg`）；
2. 在 `src/styles/global.css` 的 `body` 上追加：
   ```css
   background-image: url("../../assets/backgrounds/night.jpg");
   background-size: cover;
   ```
3. 可在 `src/ui/starfield.js` 的 `init()` 开头直接 `return` 关闭粒子。
