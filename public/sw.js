const CACHE='awaaz-run-v2';
const TILE_CACHE='awaaz-tiles-v1';
const ASSETS=[
 './','./index.html','./game.js','./extra.js','./sprites.js','./map.js',
 './fonts/fonts.css','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png',
 './fonts/tirodevanagarihindi_v7_55xyezN7P8T4e0_CfIJrwdodg9HoYw0i-M9vTuMPTG0.woff2',
 './fonts/tirodevanagarihindi_v7_55xyezN7P8T4e0_CfIJrwdodg9HoYw0i-M9vT-MP.woff2',
 './fonts/tirodevanagarihindi_v7_55xyezN7P8T4e0_CfIJrwdodg9HoYw0i-M9vQeMPTG0.woff2',
 './fonts/archivo_v25_k3kPo8UDI-1M0wlSV9XAw6lQkqWY8Q82sLydOxI.woff2',
 './fonts/archivo_v25_k3kPo8UDI-1M0wlSV9XAw6lQkqWY8Q82sLydOxI.woff2',
 './fonts/archivo_v25_k3kPo8UDI-1M0wlSV9XAw6lQkqWY8Q82sLyTOxK-vA.woff2',
 './fonts/archivo_v25_k3kPo8UDI-1M0wlSV9XAw6lQkqWY8Q82sLySOxK-vA.woff2',
 './fonts/anton_v27_1Ptgg87LROyAm3Kz-C8.woff2',
 './fonts/anton_v27_1Ptgg87LROyAm3K9-C8QSw.woff2',
 './fonts/anton_v27_1Ptgg87LROyAm3K8-C8QSw.woff2'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== TILE_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.hostname === 'server.arcgisonline.com') {
    e.respondWith(caches.open(TILE_CACHE).then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      try {
        const res = await fetch(e.request);
        if (res.ok || res.type === 'opaque') c.put(e.request, res.clone());
        return res;
      } catch (_) {
        return new Response('', { status: 504, statusText: 'Offline tile' });
      }
    }));
    return;
  }
  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request, { ignoreSearch: url.pathname === '/' }).then(hit => hit || fetch(e.request)));
  }
});
