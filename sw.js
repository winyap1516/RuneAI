// sw.js - Service Worker for PWA Support (Phase 5)
// 策略: Cache First for App Shell, Network First for Data

const CACHE_NAME = 'runeai-v1';
const ASSETS_TO_CACHE = [
  '/',
  'index.html',
  'dashboard.html',
  'signup.html',
  'auth.html',
  'js/main.js',
  'js/features/auth_ui.js',
  'js/features/dashboard.js',
  'js/storage/db.js',
  'js/storage/storageAdapter.js',
  'js/sync/syncAgent.js',
  'js/sync/changeLog.js',
  'js/utils/ui-helpers.js',
  'js/services/supabaseClient.js',
  'manifest.json',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined'
];

// Install: Cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching App Shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting(); // Force activate immediately
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[SW] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim();
});

// Fetch: Cache First strategy for static assets, Network for others
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // 忽略 Supabase API 和 Edge Functions (由 syncAgent 处理离线重试)
  if (url.href.includes('supabase.co') || url.href.includes('functions/v1')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Cache Hit - return response
      if (response) {
        return response;
      }

      // Clone request stream
      const fetchRequest = event.request.clone();

      return fetch(fetchRequest).then((response) => {
        // Check valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Cache new resource if it's part of our app domain (and not an API call)
        if (url.origin === self.location.origin) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
        }

        return response;
      });
    })
  );
});
