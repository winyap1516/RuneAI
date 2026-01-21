# Frontend Adaptation Plan: Python Backend Migration

This document outlines the steps to adapt the existing Frontend to communicate with the new Python FastAPI Backend (`http://localhost:8003`) instead of Supabase Edge Functions.

## 1. Architecture Shift

| Feature | Old (Supabase) | New (Python FastAPI) |
| :--- | :--- | :--- |
| **API Base** | `SUPABASE_URL` / Functions | `http://localhost:8003` |
| **Add Link** | `invoke('super-endpoint')` | `POST /sync` |
| **List Links** | `supabase.from('links').select('*')` | `GET /links` |
| **Auth** | Supabase Auth (JWT) | Email-based lookup (Temporary) |

## 2. Implementation Steps (Executable)

### Step 1: Create Python API Service
Create a new file `src/js/services/pythonApi.js` to handle communication with the local backend.

```javascript
// src/js/services/pythonApi.js
const API_BASE = 'http://localhost:8003';
const TEST_EMAIL = 'test@example.com'; // Hardcoded for dev

export const pythonApi = {
  /**
   * Submit a URL for processing
   * @param {string} url 
   */
  async syncLink(url) {
    const res = await fetch(`${API_BASE}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, user_email: TEST_EMAIL })
    });
    if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
    return await res.json();
  },

  /**
   * Fetch all links
   */
  async getLinks() {
    const res = await fetch(`${API_BASE}/links`);
    if (!res.ok) throw new Error(`Get links failed: ${res.status}`);
    return await res.json();
  },

  /**
   * Get single link status
   */
  async getLink(id) {
    const res = await fetch(`${API_BASE}/links/${id}`);
    if (!res.ok) throw new Error(`Get link failed: ${res.status}`);
    return await res.json();
  }
};
```

### Step 2: Modify `linkController.js`
Update `src/js/controllers/linkController.js` to use `pythonApi`.

**Changes:**
1.  Import `pythonApi`.
2.  Replace `loadCloudLinks` implementation.
3.  Replace `fetchAIFromCloud` logic (or where `addLink` is handled).

#### Code Snippet for `loadCloudLinks`:
```javascript
import { pythonApi } from '/src/js/services/pythonApi.js';

async function loadCloudLinks() {
  try {
    const links = await pythonApi.getLinks();
    return links.map(l => ({
      id: l.id,
      url: l.url,
      title: l.url, // Python backend currently doesn't scrape title separately
      description: l.description || 'Processing...',
      tags: [],
      ai_status: l.ai_status,
      created_at: l.created_at,
      updated_at: l.created_at
    }));
  } catch (e) {
    console.error('Python API load failed:', e);
    return [];
  }
}
```

### Step 3: Disable Supabase Sync (Optional but Recommended)
Since we are bypassing Supabase for now, we should disable `syncAgent.js` loop to avoid errors.
- In `dashboard_init.js` or `main.js`, comment out `syncLoop()`.

## 3. Execution Checklist

- [ ] **Verify Backend**: Ensure `http://localhost:8003/links` returns `[]` (empty list) or data.
- [ ] **Create Client**: Add `src/js/services/pythonApi.js`.
- [ ] **Update Controller**: Modify `src/js/controllers/linkController.js`.
- [ ] **Test UI**:
    1.  Open Dashboard (`http://localhost:5173`).
    2.  Add a URL (e.g., `https://example.com`).
    3.  Verify it appears in the list.
    4.  Verify description updates after a few seconds (polling may be needed in UI or manual refresh).

## 4. Rollback Plan
To revert to Supabase:
1.  Restore `linkController.js` from Git history.
2.  Delete `pythonApi.js`.
