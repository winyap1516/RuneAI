# PR: Integrate Supabase SDK (TASK-P5-001)

## 📝 Description
Integrated `@supabase/supabase-js` via CDN into `index.html`, `dashboard.html`, and `signup.html`.
Refactored `js/services/supabaseClient.js` to initialize the SDK and use it for Auth headers and Session management.

## 🔗 Linked Task
- [x] TASK-P5-001: Integrate Supabase SDK

## 🛠️ Changes
- `index.html`: Added `<script src="...supabase-js@2"></script>`.
- `dashboard.html`: Added SDK script.
- `signup.html`: Added SDK script.
- `js/services/supabaseClient.js`:
  - Initialized `window.supabase.createClient`.
  - Updated `getAuthHeaders` to be async and fetch token from SDK session.
  - Updated `callFunction` and `callRest` to await headers.
  - Deprecated manual `getJWT`/`setJWT`.

## ✅ Verification
- [x] Code compiles/runs (Static check).
- [x] `supabaseClient.js` correctly exports `supabase` instance.
- [x] Backward compatibility for `callFunction` maintained (now async internally).
