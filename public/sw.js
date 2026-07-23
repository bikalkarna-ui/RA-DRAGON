const CACHE_NAME = 'ra-dragon-v2-2026-07-22';
const OFFLINE_URLS = [
  '/home',
  '/pos',
  '/inventory',
  '/employees',
  '/reports',
  '/alerts',
  '/offline',
];

// Install - cache key pages
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and API calls (except read-only)
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/') && !url.pathname.includes('/api/connector/health')) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        // Cache successful responses for pages
        if (response.ok && !url.pathname.startsWith('/api/')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline fallback
        return caches.match(request).then(cached => {
          if (cached) return cached;
          if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/offline') || new Response(
              '<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h1>📵 Offline</h1><p>You are offline. Your data will sync when internet returns.</p></body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Push notification handler
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'RYXSOR AI', {
      body: data.body || 'You have a new notification',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/home' },
      actions: [
        { action: 'open', title: 'Open App' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || '/home';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
