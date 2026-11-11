// © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
/// Cyber Universe Service Worker（M6 PWA）
/// 静态资源 cache-first（Vite 产物带内容哈希），/api 与 /ws 永不缓存（网络优先透传）。
const STATIC_CACHE = 'cu-static-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(['/', '/index.html'])).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // API / WebSocket 透传，不缓存
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) return

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})
