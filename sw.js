const CACHE_NAME = 'ru2agr-cache-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './ui.js',
  './text-converter.js',
  './config.js',
  './storage.js',
  './icon.svg',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Clone request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(response => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone response to cache it
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              // Only cache same-origin resources for simplicity
              if (event.request.url.startsWith(self.location.origin)) {
                 cache.put(event.request, responseToCache);
              }
            });

          return response;
        }).catch(() => {
          // Offline and not in cache — return a simple offline fallback
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});
