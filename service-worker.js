/* 时块 BlockFlow · Service Worker
   仅缓存静态资源（HTML / CSS / JS / 图标 / manifest），用于离线骨架加载。
   绝不触碰 localStorage（blockflow.v1 任务数据始终由页面本地读写）。 */

/* 缓存版本号：修改此常量（如 v1 -> v2）即可在下次加载时拉取新文件并清理旧缓存 */
var CACHE_VERSION = "blockflow-v1";
var CACHE_NAME = "blockflow-static-" + CACHE_VERSION;

/* 需要预缓存的静态资源（全部为本地、相对路径，无外部 CDN/字体/图片/脚本） */
var PRECACHE_URLS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png"
];

/* 安装：预缓存静态资源。任一资源失败不影响 SW 安装整体成功（使用 allSettled 语义） */
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(
        PRECACHE_URLS.map(function (url) {
          return cache.add(url).catch(function () { return null; });
        })
      );
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

/* 激活：清理旧版本缓存。只按前缀匹配本应用的静态缓存，绝不触碰其它存储 */
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key.indexOf("blockflow-static-") === 0 && key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* 请求拦截：
   - 仅处理同源 GET 请求；跨域、非 GET、非 http(s) 一律放行走网络。
   - 导航请求（打开页面）：网络优先，失败回退缓存的 index.html（离线可打开）。
   - 静态资源：缓存优先，未命中再走网络并写入缓存（stale-while-revalidate 简化版）。 */
self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (!req || req.method !== "GET") return;

  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;    /* 不缓存/不接管跨域资源 */
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(function () {
        return caches.match("./index.html").then(function (c) {
          return c || caches.match("./");
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === "basic") {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      });
    })
  );
});

/* 允许页面请求立即接管（配合 skipWaiting） */
self.addEventListener("message", function (event) {
  if (event.data === "skipWaiting") self.skipWaiting();
});