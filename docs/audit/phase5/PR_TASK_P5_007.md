# PR: Service Worker (TASK-P5-007)

## 📝 Description
Implemented `sw.js` with Cache-First strategy for App Shell (HTML/CSS/JS).
Registered Service Worker in `js/main.js`.

## 🔗 Linked Tasks
- [x] TASK-P5-007: Service Worker Implementation

## 🛠️ Changes
- `sw.js`: Created service worker file.
  - Caches core assets (`/`, `/index.html`, `/style.css`, `/js/**`).
  - Caches external fonts and CDN SDKs.
  - Skips Supabase API calls (handled by SyncAgent).
- `js/main.js`: Added SW registration logic on window load.

## ✅ Verification
- [x] SW registers successfully in browser.
- [x] "Offline" mode in DevTools loads the page from cache.
- [x] Static assets served from ServiceWorker.
