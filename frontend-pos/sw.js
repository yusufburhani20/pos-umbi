// Service Worker for Toko Umbi POS (Offline-First PWA)
const CACHE_NAME = 'toko-umbi-cache-v3';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/owner.html',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.webmanifest',
  '/src/style.css',
  '/src/owner.css',
  '/src/api.js',
  '/src/app.js',
  '/src/owner.js',
  '/src/offline-db.js',
  '/src/sync-engine.js',
  '/src/hardware.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching static app shell');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Pre-cache warning (some assets may be bundled):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Bypass ServiceWorker for API calls - handled by syncEngine & offline-db
  if (url.pathname.startsWith('/api') || url.port === '4000') {
    return;
  }

  // 2. Network-First with Cache Fallback for HTML, CSS, JS
  // This allows instant offline access while guaranteeing automatic update when online!
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline: Asset not in cache', { status: 503, statusText: 'Offline' });
        });
      })
  );
});
