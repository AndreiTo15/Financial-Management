const CACHE_NAME = 'finora-1.0.0-beta.5-pwa-diagnostics';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/app.css',
  './assets/js/config.js',
  './assets/js/state.js',
  './assets/js/utils.js',
  './assets/js/auth.js',
  './assets/js/onboarding.js',
  './assets/js/offline.js',
  './assets/js/notifications.js',
  './assets/js/ui.js',
  './assets/js/transactions.js',
  './assets/js/budgets.js',
  './assets/js/subscriptions.js',
  './assets/js/categories.js',
  './assets/js/goals.js',
  './assets/js/wealth.js',
  './assets/js/analysis.js',
  './assets/js/settings.js',
  './assets/js/charts.js',
  './assets/js/data-io.js',
  './assets/js/diagnostics.js',
  './assets/js/namespace.js',
  './assets/js/events.js',
  './assets/js/bootstrap.js',
  './assets/js/pwa.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Never intercept Supabase/OpenRouter/CDN/API requests.
  if (url.origin !== self.location.origin) return;
  if (request.method !== 'GET') return;

  // Navigation: prefer fresh app, fall back to cached shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Static same-origin assets: cache first, refresh opportunistically.
  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
