// Spytify Mobile PWA Service Worker
const CACHE_NAME = 'spytify-mobile-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Let network handle dynamic requests, fallback to cache if available
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
