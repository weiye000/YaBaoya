/* ============================================================
   研途秘典 · 后端配置
   ------------------------------------------------------------
   provider = "worker"：Cloudflare Worker 云端模式（推荐，免费）
     - 匿名进入：设备身份，无需注册
     - 账号登录：用户名 + 密码（客户端 PBKDF2 派生，服务端加盐存储）
     - 云命运簿 / 图鉴云同步 / 心事墙 / Yaya 管理台
     - apiBase 留空 = 与网页同源（Worker 同时托管网页与接口）
   provider = "local" 或留空：本地单机模式（游戏照常运行，数据只存本机）
   ------------------------------------------------------------
   旧方案（CloudBase）仍保留：填 envId 且 provider 不是 worker 时启用。
   ============================================================ */
(function (global) {
  "use strict";
  global.YTM = global.YTM || {};
  global.YTM.config = global.YTM.config || {};

  global.YTM.config.backend = {
    provider: "worker",
    /* Worker 接口地址：留空表示与网页同源（推荐） */
    apiBase: "",
    /* 旧 CloudBase 环境 ID：留空即不启用 */
    envId: "",
    anonymousLogin: true
  };
})(typeof window !== "undefined" ? window : globalThis);
