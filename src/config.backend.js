/* ============================================================
   研途秘典 · 后端配置
   ------------------------------------------------------------
   provider = "worker"：Cloudflare Worker 云端模式（推荐）
     - 匿名进入：设备身份，无需注册
     - 账号登录：用户名 + 密码（客户端 PBKDF2 派生，服务端加盐哈希存储）
     - 云命运簿 / 图鉴云同步 / 心事墙 / Yaya 管理台
     - apiBase 留空 = 与网页同源（Worker 同时托管网页与接口，推荐）
   provider = "local"：单机模式（数据只存本机，用于离线或测试）
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
