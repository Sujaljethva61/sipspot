// Versioned cache name — bump this value on new deployments to force refresh
const CACHE_PREFIX = 'sipspot-cache-';
const CACHE_VERSION = 'v2';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

const STATIC_ASSETS = [
  'styles.css',
  'script.js',
  'manifest.webmanifest',
  'icons/icon-192.jpg',
  'icons/icon-512.jpg',
  'icons/icon.jpg',
  'icons/icon.svg',
  'icons/icon-maskable.svg'
];

const NAV_ASSETS = [
  'index.html',
  'explore.html',
  'login.html',
  'signup.html',
  'spin.html'
];

self.addEventListener('install', (event) => {
  // Pre-cache static assets
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS.concat(NAV_ASSETS))).then(() => {
      // Activate new service worker as soon as it's finished installing
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  // Claim clients and remove old caches
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.indexOf(CACHE_PREFIX) === 0 && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

// Listen for messages from the page (e.g., to skip waiting)
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch handler: network-first for navigations (HTML), cache-first for static assets
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  // Only handle same-origin requests
  if (requestUrl.origin !== location.origin) return;

  // Network-first for navigation requests to ensure updated HTML is fetched
  if (event.request.mode === 'navigate' || (event.request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        // Update the cache with the fresh HTML for offline fallback
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
        return networkResponse;
      }).catch(() => caches.match('index.html'))
    );
    return;
  }

  // For other requests (CSS/JS/images) use cache-first with background update
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchAndUpdate = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => null);

      // Return cached if available, otherwise wait for network
      return cached || fetchAndUpdate;
    })
  );
});
