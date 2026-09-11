const CACHE_NAME = 'finora-1.0.0-beta.6-cache-hotfix';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/app.css?v=1.0.0-beta.6',
  './assets/js/config.js?v=1.0.0-beta.6',
  './assets/js/state.js?v=1.0.0-beta.6',
  './assets/js/utils.js?v=1.0.0-beta.6',
  './assets/js/auth.js?v=1.0.0-beta.6',
  './assets/js/onboarding.js?v=1.0.0-beta.6',
  './assets/js/offline.js?v=1.0.0-beta.6',
  './assets/js/notifications.js?v=1.0.0-beta.6',
  './assets/js/ui.js?v=1.0.0-beta.6',
  './assets/js/transactions.js?v=1.0.0-beta.6',
  './assets/js/budgets.js?v=1.0.0-beta.6',
  './assets/js/subscriptions.js?v=1.0.0-beta.6',
  './assets/js/categories.js?v=1.0.0-beta.6',
  './assets/js/goals.js?v=1.0.0-beta.6',
  './assets/js/wealth.js?v=1.0.0-beta.6',
  './assets/js/analysis.js?v=1.0.0-beta.6',
  './assets/js/settings.js?v=1.0.0-beta.6',
  './assets/js/charts.js?v=1.0.0-beta.6',
  './assets/js/data-io.js?v=1.0.0-beta.6',
  './assets/js/diagnostics.js?v=1.0.0-beta.6',
  './assets/js/namespace.js?v=1.0.0-beta.6',
  './assets/js/events.js?v=1.0.0-beta.6',
  './assets/js/bootstrap.js?v=1.0.0-beta.6',
  './assets/js/pwa.js?v=1.0.0-beta.6'
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
