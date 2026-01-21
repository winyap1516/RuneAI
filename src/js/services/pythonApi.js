// src/js/services/pythonApi.js
const API_BASE = 'http://localhost:8003';
const TEST_EMAIL = 'dev@test.com'; // Hardcoded for dev（与后端默认保持一致）

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
    const res = await fetch(`${API_BASE}/links?user_email=${encodeURIComponent(TEST_EMAIL)}`);
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
  },

  /**
   * Send chat message with Health Check and Retry
   * @param {string} conversationId 
   * @param {string} message 
   */
  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await fetch(`${API_BASE}/uploads`, {
      method: 'POST',
      body: formData
    });
    
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return await res.json();
  },

  async chat(conversationId, message, attachments = [], contextRunes = []) {
    // 1. Health Check
    try {
        const health = await fetch(`${API_BASE}/healthz`);
        if (!health.ok) throw new Error('Service not ready');
    } catch (e) {
        // Retry once after 1s
        await new Promise(r => setTimeout(r, 1000));
        try {
            const health2 = await fetch(`${API_BASE}/healthz`);
            if (!health2.ok) throw new Error('Service offline');
        } catch (e2) {
            throw new Error('Backend service unavailable (Health Check Failed)');
        }
    }

    // 2. Send Message
    const res = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
          conversation_id: conversationId, 
          message, 
          top_k: 3,
          attachments: attachments,
          context_runes: contextRunes
      })
    });
    
    if (res.status === 503) throw new Error('Service busy/starting, please retry');
    if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
    
    return await res.json();
  },

  async createConversation(title) {
    const res = await fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }) // user_email is hardcoded in backend for now
    });
    if (!res.ok) throw new Error(`Create conversation failed: ${res.status}`);
    return await res.json();
  },

  async getConversations() {
    const res = await fetch(`${API_BASE}/conversations`);
    if (!res.ok) throw new Error(`Get conversations failed: ${res.status}`);
    return await res.json();
  },

  async getRunes(limit = 20) {
    const res = await fetch(`${API_BASE}/runes?limit=${limit}&sort=created_at_desc`);
    if (!res.ok) throw new Error(`Get runes failed: ${res.status}`);
    return await res.json();
  },

  async getMemories() {
    const res = await fetch(`${API_BASE}/memories`);
    if (!res.ok) throw new Error(`Get memories failed: ${res.status}`);
    return await res.json();
  },

  async consolidateMemories() {
    const res = await fetch(`${API_BASE}/memories/consolidate`, { method: 'POST' });
    if (!res.ok) throw new Error(`Consolidate memories failed: ${res.status}`);
    return await res.json();
  },

  async getMessages(conversationId) {
    const res = await fetch(`${API_BASE}/conversations/${conversationId}/messages`);
    if (!res.ok) throw new Error(`Get messages failed: ${res.status}`);
    return await res.json();
  },

  async saveRuneFromMessage(conversationId, messageIds, title) {
    const res = await fetch(`${API_BASE}/conversations/${conversationId}/save-rune`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_ids: messageIds, title: title, tags: [] })
    });
    if (!res.ok) throw new Error(`Save rune failed: ${res.status}`);
    return await res.json();
  }
};
