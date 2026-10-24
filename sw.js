// オフラインで使えるようにする(js を足したら FILES に足して VERSION を上げる)
const VERSION = 'bag-v4';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './vendor/three/build/three.module.min.js',
  './vendor/three/build/three.core.js',
  './js/main.js',
  './js/ui-common.js',
  './js/ui-choose.js',
  './js/ui-view.js',
  './js/ui-pattern.js',
  './js/ui-print.js',
  './js/ui-steps.js',
  './js/geom.js',
  './js/print.js',
  './js/fabric.js',
  './js/viewer3d.js',
  './js/bags/index.js',
  './js/bags/steps-common.js',
  './js/glossary.js',
  './js/bags/parts.js',
  './js/bags/pouch.js',
  './js/bags/tote.js',
  './js/bags/wa.js',
  './js/bags/shoulder.js',
  './js/bags/backpack.js',
  './js/bags/outing.js',
  './js/viewer3d-bag.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // 1つ足りなくても、ほかは入れる
    await Promise.all(FILES.map((f) => cache.add(new Request(f, { cache: 'reload' })).catch(() => null)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// ネットがつながれば新しいものを先に(直した型紙がすぐ届く)。つながらないときは手もとの控え。
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
      return Response.error();
    }
  })());
});
