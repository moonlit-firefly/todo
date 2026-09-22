// Service Worker：把应用外壳缓存到本地，实现「断网也能打开、打开即秒开」。
// 策略为「缓存优先 + 后台静默更新」：本地应用没有服务端数据，缓存里就是最新版。
// 以后升级应用时，把 VERSION 的编号加一即可让旧缓存自动失效。
const VERSION = 'todo-v11';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  // 给资源加上 ?v=VERSION，绕开托管平台的 CDN 缓存，
  // 确保升级时抓到的是新文件而不是旧的 index.html
  const bust = ASSETS.map((u) => u + (u.indexOf('?') >= 0 ? '&' : '?') + 'v=' + VERSION);
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(bust))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cachePut(req, res) {
  if (res && res.status === 200 && res.type === 'basic') {
    const copy = res.clone();
    caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  try {
    if (new URL(req.url).origin !== self.location.origin) return;
  } catch (_) {
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) {
        // 命中缓存：立即返回，同时后台悄悄拉一次新版本
        fetch(req).then((res) => cachePut(req, res)).catch(() => {});
        return hit;
      }
      return fetch(req)
        .then((res) => cachePut(req, res))
        .catch(() => caches.match('./index.html'));
    })
  );
});
