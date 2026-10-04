/* ============================================================
   研途秘典 · 后端配置
   ------------------------------------------------------------
   固定使用 Cloudflare Worker 云端：
     - 匿名进入：设备身份，无需注册
     - 账号密码登录：用户名 + 密码（客户端 PBKDF2 派生，服务端加盐哈希）
     - 云命运簿 / 图鉴云同步 / 心事墙 / Yaya 管理台
   apiBase 留空 = 与网页同源（Worker 同时托管网页与接口，推荐）。
   ============================================================ */
(function (global) {
  "use strict";
  global.YTM = global.YTM || {};
  global.YTM.config = global.YTM.config || {};

  global.YTM.config.backend = {
    provider: "worker",
    /* Worker 接口地址：留空表示与网页同源（推荐） */
    apiBase: ""
  };
})(typeof window !== "undefined" ? window : globalThis);
