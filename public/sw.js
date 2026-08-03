const CACHE_NAME = '7star-invest-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/register.html',
  '/dashboard.html',
  '/deposit.html',
  '/withdraw.html',
  '/plans.html',
  '/team.html',
  '/css/main.css',
  '/js/app.js',
  '/images/logo.png',
  '/images/hero_banner.png',
  '/images/referral_banner.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
