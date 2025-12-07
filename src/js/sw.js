// sw.js - Service Worker for PWA Support (Phase 5)
// 策略: Cache First for App Shell, Network First for Data

const CACHE_NAME = 'runeai-v3';
const ASSETS_TO_CACHE = [
  // 中文注释：避免预缓存 HTML 页面，防止开发阶段出现旧页面缓存导致交互失效
  // 改为只缓存静态资源（JS/Manifest/字体），HTML 采用 Network First
  '/src/js/main.js',
  '/src/js/features/auth_ui.js',
  '/src/js/features/dashboard.js',
  '/src/js/storage/db.js',
  '/src/js/storage/storageAdapter.js',
  '/src/js/sync/syncAgent.js',
  '/src/js/sync/changeLog.js',
  '/src/js/utils/ui-helpers.js',
  '/src/js/services/supabaseClient.js',
  '/manifest.json',
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
  const req = event.request;
  const url = new URL(req.url);

  // 1. 如果请求明确指定不缓存，直接透传给网络
  if (req.cache === 'no-store') {
    return;
  }

  // 忽略 Supabase API 和 Edge Functions (由业务层处理离线重试)
  if (url.href.includes('supabase.co') || url.href.includes('functions/v1')) {
    return;
  }

  // 中文注释：对 HTML 导航请求采用 Network First，确保页面最新（避免旧缓存导致表单默认提交）
  const isHtmlRequest = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHtmlRequest) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 其他静态资源采用 Cache First
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      const fetchRequest = req.clone();
      return fetch(fetchRequest).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        if (url.origin === self.location.origin) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, responseToCache)).catch(() => {});
        }
        return response;
      });
    })
  );
});
