// Offline support: serve the app from cache, refresh the cache in the
// background (stale-while-revalidate). Bump VERSION to force a clean update.

const VERSION = 'fundort-v6';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/main.js',
  'js/router.js',
  'js/store.js',
  'js/format.js',
  'js/ui.js',
  'js/components.js',
  'js/photos.js',
  'js/qr.js',
  'js/scan-worker.js',
  'js/install.js',
  'js/views/home.js',
  'js/views/browse.js',
  'js/views/list.js',
  'js/views/shelves.js',
  'js/views/box.js',
  'js/views/scan.js',
  'js/views/labels.js',
  'js/views/settings.js',
  'js/views/guide.js',
  'js/views/welcome.js',
  'vendor/qrcode.mjs',
  'vendor/jsQR.js',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      const fresh = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(fresh);
        return cached;
      }
      return (await fresh) ?? (request.mode === 'navigate' ? cache.match('./') : Response.error());
    }),
  );
});
