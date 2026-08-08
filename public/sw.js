/* 7 STAR INVEST - Dynamic Network-First Service Worker */
const CACHE_NAME = '7star-invest-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Always attempt network fetch first so HTML pages & scripts are 100% fresh
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

/* FCM & Web Push Notification Handler */
self.addEventListener('push', (event) => {
  let data = { title: '🔔 7 STAR ADMIN Request Alert', body: 'You have a new pending request!', tab: 'deposits', url: '/xpro-admin/dashboard.html#deposits' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/images/logo.png',
    badge: '/images/logo.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    tag: data.tag || 'admin-request-alert',
    data: {
      url: data.url || (data.tab ? `/xpro-admin/dashboard.html#${data.tab}` : '/xpro-admin/dashboard.html#deposits'),
      tab: data.tab || 'deposits'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '🔔 7 STAR ADMIN', options)
  );
});

/* Notification Click Handler — Opens/Focuses Admin App & Navigates to Target Tab */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notifData = event.notification.data || {};
  const targetTab = notifData.tab || 'deposits';
  const targetUrl = notifData.url || `/xpro-admin/dashboard.html#${targetTab}`;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes('/xpro-admin/dashboard.html')) {
          client.focus();
          client.postMessage({ action: 'switchTab', tab: targetTab, url: targetUrl });
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

