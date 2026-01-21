import { $, $$, fadeIn, slideToggle, on, openModal, closeModal, show, hide, mountHTML, delegate, openConfirm, openTextPrompt, openInfoModal } from "/src/js/utils/dom.js";
import storageAdapter from "/src/js/storage/storageAdapter.js";
import { normalizeUrl } from "/src/js/utils/url.js";
import { USER_ID, DIGEST_TYPE, LIMITS, COOLDOWN } from "/src/js/config/constants.js";
import { createCard } from "/src/js/templates/card.js";
import { createDigestCard } from "/src/js/templates/digestCard.js";
import { escapeHTML, getTagClass, buildIconHTML } from "/src/js/utils/ui-helpers.js";
import { linkController } from "/src/js/controllers/linkController.js";
import { syncLoop } from "/src/js/sync/syncAgent.js";
import { digestController } from "/src/js/controllers/digestController.js";
import * as linksView from "/src/js/views/linksView.js";
import * as digestView from "/src/js/views/digestView.js";
import * as sendLogsView from "/src/js/views/sendLogsView.js";
import { mountUserWelcomeCard } from "/src/js/components/user-welcome-card.js";
import { mountSubscriptionSettings } from "/src/js/components/settings-panel.js";

// Listen for storage events to update UI
storageAdapter.subscribe((event) => {
  const cardsContainer = document.getElementById('cardsContainer');
  const digestList = document.getElementById('digestList');

  if (event.type === 'links_changed' || event.type === 'subscriptions_changed') {
      if (cardsContainer) {
          linksView.renderLinks();
      }
  }
  
  if (event.type === 'digests_changed' || event.type === 'links_changed') {
      if (digestList) {
          // If Digest View is active
          digestView.renderDigests();
      }
  }
});

// =============================
// ☁️ 云端 AI 封装（Supabase Edge Functions）
// =============================
const SUPABASE_URL = (import.meta?.env?.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (import.meta?.env?.VITE_SUPABASE_ANON_KEY || '').trim();
const useCloud = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Chat Logic
import { pythonApi } from "/src/js/services/pythonApi.js";

async function initChat() {
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatContainer = document.getElementById('chatContainer');
    
    // Previous "leftPanel" creation code is removed as it's now in renderChatView
    // We only need to hydrate the logic
    
    if (!chatInput || !sendBtn || !chatContainer) return;

    // Mobile Back Logic
    const mobileBackBtn = document.getElementById('chatMobileBackBtn');
    if (mobileBackBtn) {
        mobileBackBtn.onclick = () => {
            const leftPanel = document.getElementById('chatLeftPanel');
            const rightPanel = document.getElementById('chatRightPanel');
            if (leftPanel && rightPanel) {
                leftPanel.classList.remove('hidden');
                leftPanel.classList.add('flex');
                rightPanel.classList.add('hidden');
                rightPanel.classList.remove('flex');
            }
        };
    }

    let currentConvId = localStorage.getItem('current_conversation_id');
    const panelContent = document.getElementById('leftPanelContent');
    let activeTab = 'convs'; // convs | runes

    // Tab Switching
    const tabConvs = document.getElementById('tabConvs');
    const tabRunes = document.getElementById('tabRunes');
    if (tabConvs) tabConvs.addEventListener('click', () => switchTab('convs'));
    if (tabRunes) tabRunes.addEventListener('click', () => switchTab('runes'));

    function switchTab(tab) {
        activeTab = tab;
        
        if (tab === 'convs') {
            tabConvs.className = 'flex-1 py-3 text-sm font-medium text-primary border-b-2 border-primary transition-colors';
            tabConvs.classList.remove('text-gray-500');
            tabRunes.className = 'flex-1 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors';
            tabRunes.classList.remove('text-primary', 'border-b-2', 'border-primary');
            loadConversations();
        } else {
            tabRunes.className = 'flex-1 py-3 text-sm font-medium text-primary border-b-2 border-primary transition-colors';
            tabRunes.classList.remove('text-gray-500');
            tabConvs.className = 'flex-1 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors';
            tabConvs.classList.remove('text-primary', 'border-b-2', 'border-primary');
            loadRunes();
        }
    }

    // Load Conversations
    const loadConversations = async () => {
        panelContent.innerHTML = '<div class="p-4 text-center text-gray-400">Loading...</div>';
        try {
            const convs = await pythonApi.getConversations();
            panelContent.innerHTML = `
                <button id="newChatBtn" class="w-full py-2 px-4 mb-4 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined text-sm">add</span> New Conversation
                </button>
            `;
            
            document.getElementById('newChatBtn').addEventListener('click', async () => {
                const newConv = await pythonApi.createConversation("New Chat");
                currentConvId = newConv.id;
                localStorage.setItem('current_conversation_id', currentConvId);
                await loadConversations();
                await loadMessages(currentConvId);
            });

            convs.forEach(c => {
                const btn = document.createElement('div');
                btn.className = `group cursor-pointer p-3 rounded-xl transition-all border ${c.id === currentConvId ? 'bg-white border-primary/20 shadow-sm' : 'border-transparent hover:bg-gray-100 dark:hover:bg-white/5'}`;
                btn.innerHTML = `
                    <div class="flex items-center justify-between mb-1">
                        <span class="font-medium text-sm text-gray-900 truncate flex-1">${escapeHTML(c.title || 'Untitled Chat')}</span>
                        <span class="text-[10px] text-gray-400 shrink-0">Now</span>
                    </div>
                    <div class="text-xs text-gray-500 truncate">Click to view messages...</div>
                `;
                btn.onclick = async () => {
                    currentConvId = c.id;
                    localStorage.setItem('current_conversation_id', currentConvId);
                    // Update active state visual
                    Array.from(panelContent.children).forEach(el => {
                         if(el.tagName === 'DIV') el.classList.remove('bg-white', 'border-primary/20', 'shadow-sm');
                    });
                    btn.classList.add('bg-white', 'border-primary/20', 'shadow-sm');
                    
                    // Update Header
                    const headerTitle = document.getElementById('chatHeaderTitle');
                    if (headerTitle) headerTitle.textContent = c.title || 'Untitled Chat';
                    
                    // Mobile: Hide List, Show Chat
                    const leftPanel = document.getElementById('chatLeftPanel');
                    const rightPanel = document.getElementById('chatRightPanel');
                    if (window.innerWidth < 768 && leftPanel && rightPanel) {
                        leftPanel.classList.add('hidden');
                        leftPanel.classList.remove('flex');
                        rightPanel.classList.remove('hidden');
                        rightPanel.classList.add('flex');
                    }

                    await loadMessages(currentConvId);
                };
                panelContent.appendChild(btn);
            });
            
            if (!currentConvId && convs.length > 0) {
                currentConvId = convs[0].id;
                // Update header for initial
                const headerTitle = document.getElementById('chatHeaderTitle');
                if (headerTitle) headerTitle.textContent = convs[0].title || 'Untitled Chat';
                loadMessages(currentConvId);
            } else if (!currentConvId) {
                document.getElementById('newChatBtn').click();
            }
        } catch (e) {
            console.error("Load convs failed", e);
            panelContent.innerHTML = '<div class="text-red-500 p-4">Failed to load conversations</div>';
        }
    };

    // Load Runes
    const loadRunes = async () => {
        panelContent.innerHTML = '<div class="p-4 text-center text-gray-400">Loading Runes...</div>';
        try {
            const runes = await pythonApi.getRunes();
            panelContent.innerHTML = '';
            
            if (runes.length === 0) {
                panelContent.innerHTML = '<div class="p-8 text-center text-gray-400 text-sm">No runes saved yet.<br>Save messages as runes to see them here.</div>';
                return;
            }

            runes.forEach(r => {
                const card = document.createElement('div');
                card.className = 'bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer mb-2 group';
                card.innerHTML = `
                    <div class="flex items-start gap-3">
                        <div class="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0 text-purple-600 font-bold text-xs">R</div>
                        <div class="flex-1 min-w-0">
                            <h4 class="font-bold text-sm text-gray-800 truncate">${escapeHTML(r.title || 'Untitled Rune')}</h4>
                            <p class="text-xs text-gray-500 line-clamp-2 mt-1">${escapeHTML(r.content)}</p>
                        </div>
                    </div>
                `;
                card.onclick = () => {
                    alert(`Preview Rune: ${r.title}\n\n${r.content}`);
                };
                panelContent.appendChild(card);
            });
        } catch (e) {
            console.error("Load runes failed", e);
            panelContent.innerHTML = '<div class="text-red-500 p-4">Failed to load runes</div>';
        }
    };

    // State for Attachments
    let pendingAttachments = []; // Array of {file, url, mime}

    // Input Area (Composer)
    const renderComposer = () => {
        const composer = document.querySelector('.p-6.bg-transparent');
        if (!composer) return;
        
        composer.innerHTML = `
            <div class="relative flex flex-col gap-2 max-w-4xl mx-auto bg-white dark:bg-surface-dark rounded-[20px] shadow-sm border border-gray-200 dark:border-gray-700 px-[18px] py-2 pointer-events-auto transition-all">
                <!-- Attachments Preview -->
                <div id="attachmentsPreview" class="flex gap-2 overflow-x-auto py-1 empty:hidden"></div>
                
                <div class="flex items-center gap-4">
                    <button id="attachBtn" class="p-2 text-gray-400 hover:text-primary rounded-full hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shrink-0" title="Attach">
                        <span class="material-symbols-outlined text-[24px]">add_circle</span>
                    </button>
                    <input type="file" id="fileInput" class="hidden" multiple />
                    
                    <div class="flex-1 min-w-0">
                        <textarea id="chatInput" rows="1" class="w-full bg-transparent border-none p-2 max-h-32 focus:ring-0 resize-none text-[15px] placeholder-gray-400" placeholder="Message AI..."></textarea>
                    </div>
                    <button id="sendBtn" class="w-10 h-10 bg-primary text-white rounded-full hover:bg-primary/90 shadow-md flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
                        <span class="material-symbols-outlined text-[20px] ml-0.5">arrow_upward</span>
                    </button>
                </div>
            </div>
            <div class="text-center mt-3 pointer-events-auto">
                <p class="text-[11px] text-gray-400">AI can make mistakes. Please verify important information.</p>
            </div>
        `;
        
        // Re-bind events
        document.getElementById('attachBtn').onclick = () => document.getElementById('fileInput').click();
        document.getElementById('fileInput').onchange = handleFileSelect;
        document.getElementById('sendBtn').onclick = handleSend;
        const chatInput = document.getElementById('chatInput');
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });
        // Auto-resize textarea
        chatInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
    };

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        // Show optimistic preview
        const previewContainer = document.getElementById('attachmentsPreview');
        
        for (const file of files) {
            // Upload immediately
            try {
                // Optimistic UI item
                const item = document.createElement('div');
                item.className = 'relative w-16 h-16 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0 bg-gray-50 flex items-center justify-center';
                item.innerHTML = '<span class="material-symbols-outlined animate-spin text-gray-400">progress_activity</span>';
                previewContainer.appendChild(item);
                
                const uploadResp = await pythonApi.uploadFile(file);
                
                // Update item with preview
                item.innerHTML = '';
                if (file.type.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.src = `${API_BASE}${uploadResp.url}`; // Assuming backend serves uploads
                    img.className = 'w-full h-full object-cover';
                    item.appendChild(img);
                } else {
                    item.innerHTML = '<span class="material-symbols-outlined text-gray-500">description</span>';
                }
                
                // Add remove button
                const removeBtn = document.createElement('button');
                removeBtn.className = 'absolute top-0 right-0 bg-black/50 text-white rounded-bl-lg p-0.5 hover:bg-black/70';
                removeBtn.innerHTML = '<span class="material-symbols-outlined text-[12px]">close</span>';
                removeBtn.onclick = () => {
                    item.remove();
                    pendingAttachments = pendingAttachments.filter(a => a.url !== uploadResp.url);
                };
                item.appendChild(removeBtn);
                
                pendingAttachments.push({
                    type: file.type.startsWith('image/') ? 'image' : 'file',
                    url: uploadResp.url,
                    filename: uploadResp.filename,
                    mime: uploadResp.mime
                });
                
            } catch (err) {
                console.error("Upload failed", err);
                alert("Upload failed: " + err.message);
            }
        }
        
        e.target.value = ''; // Reset input
    };

    // ... (rest of initChat) ...

    // Selection State
    let selectedMessages = new Set();
    let isSelectionMode = false;

    const toggleSelectionMode = (enable) => {
        isSelectionMode = enable;
        document.body.classList.toggle('selection-mode', enable);
        // Toggle checkboxes visibility
        $$('.msg-checkbox').forEach(cb => {
            cb.style.display = enable ? 'block' : 'none';
            cb.checked = false;
        });
        selectedMessages.clear();
        updateFloatingBar();
    };

    const updateFloatingBar = () => {
        let bar = document.getElementById('selectionBar');
        if (selectedMessages.size > 0) {
            if (!bar) {
                bar = document.createElement('div');
                bar.id = 'selectionBar';
                bar.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-surface-dark shadow-xl border border-gray-200 rounded-full px-6 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-4 z-50';
                bar.innerHTML = `
                    <span class="text-sm font-medium"><span id="selCount">0</span> selected</span>
                    <div class="h-4 w-px bg-gray-300"></div>
                    <button id="multiSaveBtn" class="text-sm font-bold text-primary hover:text-primary-dark">Save as Rune</button>
                    <button id="cancelSelBtn" class="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                `;
                document.body.appendChild(bar);
                
                bar.querySelector('#cancelSelBtn').onclick = () => toggleSelectionMode(false);
                bar.querySelector('#multiSaveBtn').onclick = () => openSaveRuneModal(Array.from(selectedMessages));
            }
            bar.querySelector('#selCount').textContent = selectedMessages.size;
        } else {
            if (bar) bar.remove();
        }
    };

    const appendMessage = (role, text, sources = [], id = null) => {
        const div = document.createElement('div');
        div.className = `flex gap-4 mb-4 group w-full ${role === 'user' ? 'justify-end' : 'justify-start'}`;
        div.dataset.id = id;
        
        // Checkbox for selection (Hidden by default, shown in selection mode)
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'msg-checkbox hidden w-5 h-5 mt-3 rounded border-gray-300 text-primary focus:ring-primary shrink-0';
        checkbox.onclick = (e) => {
            e.stopPropagation();
            if (e.target.checked) selectedMessages.add(id);
            else selectedMessages.delete(id);
            updateFloatingBar();
        };

        let sourcesHtml = '';
        if (sources && sources.length > 0) {
            sourcesHtml = `
            <div class="mt-3 text-[11px] ${role === 'user' ? 'text-white/80 border-white/20' : 'text-gray-400 border-gray-200'} border-t pt-2">
                <span class="font-medium opacity-80">Sources:</span>
                ${sources.map(id => `<a href="#" class="${role === 'user' ? 'text-white hover:text-white/90' : 'text-blue-500 hover:text-blue-600'} hover:underline ml-1" onclick="alert('View Rune ${id}')">#${id}</a>`).join(', ')}
            </div>`;
        }
        
        // Action Menu (Hover)
        const actionsHtml = id ? `
            <div class="absolute top-2 ${role === 'user' ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'} opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                 <button class="w-8 h-8 flex items-center justify-center bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-50 dark:hover:bg-white/10 text-gray-500 shadow-sm transition-colors" title="Save as Rune" onclick="window.openSaveRuneSingle('${id}')">
                    <span class="material-symbols-outlined text-[16px]">bookmark_add</span>
                 </button>
                 <button class="w-8 h-8 flex items-center justify-center bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-50 dark:hover:bg-white/10 text-gray-500 shadow-sm transition-colors" title="Select" onclick="window.toggleMsgSelection('${id}')">
                    <span class="material-symbols-outlined text-[16px]">check_circle</span>
                 </button>
            </div>
        ` : '';

        // Notion-style Card
        // AI: bg-[#F7F7F8] rounded-[18px] shadow-[0_1px_2px_rgba(0,0,0,0.05)]
        // User: bg-primary text-white rounded-[18px] shadow-[0_2px_4px_rgba(0,0,0,0.1)]
        const bubbleClass = role === 'user' 
            ? 'bg-primary text-white rounded-[20px] rounded-tr-sm shadow-[0_2px_4px_rgba(0,0,0,0.1)]' 
            : 'bg-[#F7F7F8] dark:bg-white/10 text-gray-800 dark:text-gray-100 rounded-[20px] rounded-tl-sm shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-transparent dark:border-white/5';

        div.innerHTML = `
            ${role === 'user' ? '' : `
                <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-white border border-gray-200 shadow-sm overflow-hidden mt-0.5">
                    <img src="https://ui-avatars.com/api/?name=AI&background=random&color=fff&size=32" class="w-full h-full object-cover opacity-80" alt="AI">
                </div>
            `}
            
            <div class="relative max-w-[70%] group/bubble">
                <div class="${bubbleClass} px-5 py-3.5 text-[15px] leading-relaxed break-words">
                    <p class="whitespace-pre-wrap">${escapeHTML(text)}</p>
                    ${sourcesHtml}
                </div>
                ${actionsHtml}
            </div>

            ${role === 'user' ? `
                <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-primary/10 overflow-hidden mt-0.5">
                    <img src="https://ui-avatars.com/api/?name=User&background=4E7BFF&color=fff&size=32" class="w-full h-full object-cover" alt="User">
                </div>
            ` : ''}
        `;
        
        // Insert checkbox based on role for selection mode
        if (role === 'user') {
            div.insertBefore(checkbox, div.firstChild);
        } else {
            div.appendChild(checkbox);
        }

        chatContainer.appendChild(div);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    };
    
    // Global handlers for inline buttons
    window.openSaveRuneSingle = (id) => openSaveRuneModal([id]);
    window.toggleMsgSelection = (id) => {
        toggleSelectionMode(true);
        const cb = document.querySelector(`div[data-id="${id}"] .msg-checkbox`);
        if (cb) {
            cb.checked = true;
            selectedMessages.add(id);
            updateFloatingBar();
        }
    };

    // Save Rune Modal
    const openSaveRuneModal = (ids) => {
        const modalHtml = `
            <div class="p-6">
                <h3 class="text-lg font-bold mb-4">Save as Rune</h3>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">Title</label>
                        <input id="runeTitle" class="w-full rounded-lg border-gray-300 focus:border-primary focus:ring-primary" placeholder="Enter a title..." value="New Rune">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Tags (comma separated)</label>
                        <input id="runeTags" class="w-full rounded-lg border-gray-300 focus:border-primary focus:ring-primary" placeholder="tech, physics, idea">
                    </div>
                    <div class="text-xs text-gray-500">
                        Saving ${ids.length} message(s). Embedding will be generated automatically.
                    </div>
                    <div class="flex justify-end gap-3 mt-6">
                        <button class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg" onclick="closeModal()">Cancel</button>
                        <button id="confirmSaveRune" class="px-4 py-2 text-sm text-white bg-primary hover:bg-primary/90 rounded-lg">Save Rune</button>
                    </div>
                </div>
            </div>
        `;
        openModal(modalHtml);
        
        document.getElementById('confirmSaveRune').onclick = async () => {
            const title = document.getElementById('runeTitle').value;
            const tags = document.getElementById('runeTags').value.split(',').map(t => t.trim()).filter(t => t);
            
            const btn = document.getElementById('confirmSaveRune');
            btn.textContent = 'Saving...';
            btn.disabled = true;
            
            try {
                await pythonApi.saveRuneFromMessage(currentConvId, ids, title); // need to update api to support tags
                closeModal();
                toggleSelectionMode(false);
                
                // Animation
                const fly = document.createElement('div');
                fly.className = 'fixed z-50 w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white shadow-xl pointer-events-none transition-all duration-700 ease-in-out';
                fly.innerHTML = '<span class="material-symbols-outlined">auto_awesome</span>';
                fly.style.top = '50%';
                fly.style.left = '50%';
                document.body.appendChild(fly);
                
                // Animate to left panel
                setTimeout(() => {
                    const target = document.getElementById('tabRunes').getBoundingClientRect();
                    fly.style.top = `${target.top + 10}px`;
                    fly.style.left = `${target.left + 20}px`;
                    fly.style.transform = 'scale(0.2)';
                    fly.style.opacity = '0';
                }, 50);
                
                setTimeout(() => {
                    fly.remove();
                    // Switch to Runes tab to show result
                    if (activeTab !== 'runes') document.getElementById('tabRunes').click();
                    else loadRunes();
                }, 750);
                
            } catch (e) {
                alert('Failed: ' + e.message);
                btn.textContent = 'Save Rune';
                btn.disabled = false;
            }
        };
    };

    const handleSend = async () => {
        const text = chatInput.value.trim();
        if (!text) return;
        
        if (!currentConvId) {
             const newConv = await pythonApi.createConversation("New Chat");
             currentConvId = newConv.id;
             localStorage.setItem('current_conversation_id', currentConvId);
             await loadConversations();
        }

        // UI Optimistic
        appendMessage('user', text);
        chatInput.value = '';
        sendBtn.disabled = true;
        
        // Show Loading
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'chat-loading';
        loadingDiv.className = 'flex gap-4 mb-4';
        loadingDiv.innerHTML = `
            <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-white border border-gray-200 shadow-sm overflow-hidden mt-0.5">
                <img src="https://ui-avatars.com/api/?name=AI&background=random&color=fff&size=32" class="w-full h-full object-cover opacity-80" alt="AI">
            </div>
            <div class="bg-[#F7F7F8] dark:bg-white/10 p-4 rounded-[20px] rounded-tl-sm shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-transparent dark:border-white/5 flex items-center gap-2">
                <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></span>
            </div>
        `;
        chatContainer.appendChild(loadingDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        try {
            const resp = await pythonApi.chat(currentConvId, text);
            loadingDiv.remove();
            appendMessage('assistant', resp.reply, resp.sources, resp.assistant_message_id);
        } catch (e) {
            loadingDiv.remove();
            appendMessage('assistant', `Error: ${e.message}`, [], null);
        } finally {
            sendBtn.disabled = false;
            chatInput.focus();
        }
    };

    sendBtn.addEventListener('click', handleSend);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });
    
    // Initial Load
    loadConversations();
}

export function initDashboard() {
  console.log("📊 Dashboard initialized");
  
  // P0: Migration Trigger
  (async () => {
    try {
      await storageAdapter.migrateToIdBased();
    } catch (e) {
      console.error("Migration failed:", e);
    }
    
    initChat(); // Initialize Chat Logic
    
    // Initialize Views
    const context = {
        containerEl: null, // Will be set per render
        controllers: { linkController, digestController },
        templates: { createCard, createDigestCard },
        utils: { 
            dom: { $, $$, fadeIn, slideToggle, on, openModal, closeModal, show, hide, mountHTML, delegate, openConfirm, openTextPrompt, openInfoModal },
            storageAdapter // Passing for read-only user/global info
        }
    };
    
    // Initialize View Modules (passing context that doesn't change)
    // ContainerEl changes on navigation, so we pass it during render?
    // The init function stored it. 
    // Let's pass containerEl: document.getElementById('cardsContainer') for linksView
    // But cardsContainer might not exist if we are on another tab?
    // Actually, index.html has cardsContainer inside main by default?
    // Let's check index.html or main rendering logic.
    // defaultMainHTML has 'cardsContainer'.
    
    const mainEl = document.querySelector('main');
    
    // Init Views
    // 中文注释：初始化 Links 与 Digest 视图容器
    // Links 视图容器固定为 #cardsContainer
    linksView.initLinksView({ ...context, containerEl: document.getElementById('cardsContainer') });

    // Digest 视图不再清空 <main>，改为挂载到独立容器 #digestSection，避免与 Chat/RuneSpace 互相叠加
    let digestSection = document.getElementById('digestSection');
    if (!digestSection && mainEl) {
        digestSection = document.createElement('section');
        digestSection.id = 'digestSection';
        digestSection.className = 'hidden p-6';
        // 默认插入在 Links 视图之后，保持层级一致
        const linksViewContainer = document.getElementById('linksViewContainer');
        if (linksViewContainer && linksViewContainer.parentElement === mainEl) {
            mainEl.appendChild(digestSection);
        } else {
            mainEl.appendChild(digestSection);
        }
    }
    digestView.initDigestView({ ...context, containerEl: digestSection });
    // 中文注释：初始化发送历史视图容器，占位，登录后可访问
    let sendLogsSection = document.getElementById('sendLogsSection');
    if (!sendLogsSection && mainEl) {
        sendLogsSection = document.createElement('section');
        sendLogsSection.id = 'sendLogsSection';
        sendLogsSection.className = 'hidden p-6';
        mainEl.appendChild(sendLogsSection);
    }
    sendLogsView.initSendLogsView({ containerEl: sendLogsSection, utils: { dom: { $, $$, fadeIn, slideToggle, on, openModal, closeModal, show, hide, mountHTML, delegate, openConfirm, openTextPrompt, openInfoModal }, config: { supabaseUrl: import.meta?.env?.VITE_SUPABASE_URL || '' }, supabaseClient: { getAuthHeaders: async () => {
        // 中文注释：复用统一封装的认证头
        const mod = await import('../services/supabaseClient.js');
        return mod.getAuthHeaders();
    } } } });
    
    // Phase 3: Partial Update - Inject View into Controller
    linkController.setView(linksView);
    digestController.setView(digestView);

    // Bind Events Once
    linksView.bindLinksEvents();

    // Welcome Card Initialization (Run Once)
    loadWelcomeCard();

    // 初始渲染：Mock 模式默认进入 Links 视图，便于直接看到 mock 数据
    // 非 Mock 模式保持原先进入 RuneSpace 视图的行为
    try {
      const cfgMod = await import('../services/config.js');
      const isMock = Boolean(cfgMod.default?.useMock || cfgMod.config?.useMock);
      if (isMock) {
        await renderDefaultMain();
      } else {
        renderRuneSpaceView();
      }
    } catch {
      renderRuneSpaceView();
    }

    // 启动后台同步循环（在线时定期推送变更）
    try { syncLoop(); } catch {}
  })();

  // 中文注释：抽取 Welcome Card 加载逻辑，供 renderRuneSpaceView 复用
  function loadWelcomeCard() {
      // 中文注释：采用旧版设计模板，统一由组件模块挂载与填充数据
      const welcomeContainer = document.getElementById('userWelcomeCard');
      if (!welcomeContainer) return;
      try { mountUserWelcomeCard(welcomeContainer); } catch {}
  }

  const mainEl = document.querySelector('main');
  const defaultMainHTML = mainEl ? mainEl.innerHTML : '';
  
  // ... (lines 91-178 skipped) ...

  async function renderRuneSpaceView() {
    if (!mainEl) return;
    
    // 1. Ensure Welcome Card is loaded/refreshed
    loadWelcomeCard();

    // 2. Hide other views
    const runeView = document.getElementById('runeSpaceView');
    const linksView = document.getElementById('linksViewContainer');
    const digestSection = document.getElementById('digestSection');
    const chatView = document.getElementById('chatSection');
    const sendLogsSection = document.getElementById('sendLogsSection');
    // 隐藏非 RuneSpace 的其他视图
    if (linksView) hide(linksView);
    if (digestSection) hide(digestSection);
    if (chatView) hide(chatView);
    if (sendLogsSection) hide(sendLogsSection);

    if (runeView) show(runeView);
    
    // Highlight nav
    highlightNav('navRuneSpace');
    
    const homeRunesContainer = document.getElementById('homeRunesContainer');
    const homeMemoriesContainer = document.getElementById('homeMemoriesContainer');
    const consolidateBtn = document.getElementById('consolidateBtn');

    // Consolidate Action
    if (consolidateBtn) {
        consolidateBtn.onclick = async () => {
            const originalText = consolidateBtn.innerHTML;
            consolidateBtn.innerHTML = '<span class="material-symbols-outlined text-[14px] animate-spin">autorenew</span> Processing...';
            consolidateBtn.disabled = true;
            try {
                const res = await pythonApi.consolidateMemories();
                if (res.status === 'consolidated') {
                    alert(`Memory Consolidated: ${res.title}`);
                    loadMemories(); // Refresh
                } else {
                    alert(`Info: ${res.message}`);
                }
            } catch (e) {
                alert('Consolidation failed: ' + e.message);
            } finally {
                consolidateBtn.innerHTML = originalText;
                consolidateBtn.disabled = false;
            }
        };
    }

    // Load Memories
    const loadMemories = async () => {
        if (!homeMemoriesContainer) return;
        homeMemoriesContainer.innerHTML = '<div class="py-8 flex justify-center"><span class="material-symbols-outlined animate-spin text-gray-400">progress_activity</span></div>';
        
        try {
            const memories = await pythonApi.getMemories();
            homeMemoriesContainer.innerHTML = '';
            
            if (memories.length === 0) {
                homeMemoriesContainer.innerHTML = `
                    <div class="p-6 text-center text-sm text-gray-500 bg-gray-50 dark:bg-white/5 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                        No consolidated memories yet. Chat more to generate memories!
                    </div>
                `;
                return;
            }
            
            memories.forEach(m => {
                const dateStr = m.created_at ? new Date(m.created_at).toLocaleDateString() : 'Just now';
                const el = document.createElement('div');
                el.className = 'bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-700 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex gap-4';
                el.innerHTML = `
                    <div class="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined text-[20px]">psychology</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="font-bold text-gray-900 dark:text-white text-sm mb-1">${escapeHTML(m.title || 'Untitled Memory')}</h4>
                        <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-2">${escapeHTML(m.summary)}</p>
                        <div class="text-xs text-gray-400 font-mono">${dateStr}</div>
                    </div>
                `;
                homeMemoriesContainer.appendChild(el);
            });
        } catch (e) {
            console.error("Load memories failed", e);
            homeMemoriesContainer.innerHTML = '<div class="text-red-500 text-sm">Failed to load memories</div>';
        }
    };
    
    // Initial Load
    loadMemories();

    // 3. Render "My Runes" Grid
    if (homeRunesContainer) {
        homeRunesContainer.innerHTML = '<div class="col-span-full py-12 flex justify-center"><span class="material-symbols-outlined animate-spin text-gray-400 text-3xl">progress_activity</span></div>';
        try {
            const runes = await pythonApi.getRunes(20);
            homeRunesContainer.innerHTML = '';
            
            if (runes.length === 0) {
                homeRunesContainer.innerHTML = `
                    <div class="col-span-full flex flex-col items-center justify-center py-12 text-center bg-gray-50 dark:bg-white/5 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                        <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                            <span class="material-symbols-outlined text-primary text-3xl">auto_awesome</span>
                        </div>
                        <h4 class="text-lg font-bold text-gray-900 dark:text-white mb-2">暂无符文</h4>
                        <p class="text-sm text-gray-500 max-w-md mb-6">你还没有保存任何 Rune。<br>在 AI Assistant 中选中内容即可保存为你的第一个 Rune！</p>
                        <button id="goChatBtn" class="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-transform active:scale-95 shadow-lg shadow-primary/20 flex items-center gap-2">
                            <span class="material-symbols-outlined">chat</span>
                            前往 AI Assistant
                        </button>
                    </div>
                `;
                document.getElementById('goChatBtn')?.addEventListener('click', () => {
                   document.getElementById('navChat')?.click(); 
                });
                return;
            }
            
            runes.forEach(r => {
                // Determine Icon
                let iconName = 'description';
                let iconClass = 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300';
                
                if (r.type === 'image') {
                    iconName = 'image';
                    iconClass = 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
                } else if (r.type === 'audio') {
                    iconName = 'graphic_eq';
                    iconClass = 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
                } else if (r.type === 'mixed') {
                    iconName = 'auto_awesome';
                    iconClass = 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';
                }
                
                // Truncate Description (2 lines roughly)
                const desc = r.description || r.content || '';
                const descText = desc.length > 80 ? desc.substring(0, 80) + '...' : desc;
                
                // Format Date
                const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Just now';
                
                const card = document.createElement('div');
                card.className = 'group relative bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-700 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col h-full';
                card.innerHTML = `
                    <div class="flex items-start justify-between mb-3">
                        <div class="w-10 h-10 rounded-lg ${iconClass} flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined text-[20px]">${iconName}</span>
                        </div>
                        <!-- Menu (Optional) -->
                        <button class="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 transition-opacity" title="Options">
                            <span class="material-symbols-outlined text-[20px]">more_horiz</span>
                        </button>
                    </div>
                    
                    <h4 class="font-bold text-gray-900 dark:text-white text-[15px] mb-2 line-clamp-1" title="${escapeHTML(r.title)}">${escapeHTML(r.title || 'Untitled Rune')}</h4>
                    
                    <p class="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 flex-1 h-[40px] leading-relaxed">
                        ${escapeHTML(descText)}
                    </p>
                    
                    <div class="flex items-center justify-between mt-auto pt-3 border-t border-gray-50 dark:border-white/5">
                        <span class="text-xs text-gray-400 font-medium">${dateStr}</span>
                        <button class="text-xs font-bold text-primary hover:text-primary-dark transition-colors px-2 py-1 rounded hover:bg-primary/5">
                            View
                        </button>
                    </div>
                `;
                
                // Click Handler
                card.onclick = (e) => {
                    // Prevent if clicked on menu
                    if (e.target.closest('button') && e.target.closest('button').title === 'Options') return;
                    // Mock Detail View
                    alert(`Rune Detail (Mock):\n\nTitle: ${r.title}\nID: ${r.id}\n\n${r.content}`);
                };
                
                homeRunesContainer.appendChild(card);
            });
            
        } catch (e) {
            console.error("Load home runes failed", e);
            homeRunesContainer.innerHTML = `<div class="col-span-full text-red-500 p-4 text-center text-sm">Failed to load runes: ${e.message}</div>`;
        }
    }
  }

  function renderDefaultMain() {
    if (mainEl) {
      // Cleanup other scrolls
      digestView.disableInfiniteScroll();

      // Restore Links View
      const runeView = document.getElementById('runeSpaceView');
      const linksViewContainer = document.getElementById('linksViewContainer');
      const digestSection = document.getElementById('digestSection');
      const chatView = document.getElementById('chatSection');
      const sendLogsSection = document.getElementById('sendLogsSection');
      
      if (runeView) hide(runeView);
      if (linksViewContainer) show(linksViewContainer);
      if (digestSection) hide(digestSection);
      if (chatView) hide(chatView);
      if (sendLogsSection) hide(sendLogsSection);
      
      // 保持 Chat 视图容器但隐藏，避免反复创建/销毁

      // Update container reference for LinksView as DOM changed (or just re-init logic)
      // Since we are toggling visibility, we don't need to re-mount HTML.
      // But we do need to ensure linksView is active controller.
      
      linksView.initLinksView({ 
          containerEl: document.getElementById('cardsContainer'), 
          controllers: { linkController, digestController },
          templates: { createCard, createDigestCard },
          utils: { dom: {$,$$,fadeIn,slideToggle,on,openModal,closeModal,show,hide,mountHTML,delegate,openConfirm,openTextPrompt,openInfoModal}, storageAdapter }
      });
      linkController.setView(linksView);
      
      highlightNav('linksGroupHeader'); // Or find the "All Links" item?

      // Phase 3: Pagination (Load Page 0) if empty?
      // Check if already loaded?
      const container = document.getElementById('cardsContainer');
      if (container && container.children.length === 0) {
          return linkController.fetchPage(0, 20).then(({ items }) => {
              linksView.renderLinks(items);
              // Enable Infinite Scroll
              const scrollContainer = document.getElementById('mainScrollContainer');
              linksView.enableInfiniteScroll(scrollContainer, {
                  onLoadMore: () => linkController.loadNextPage()
              });
          });
      }
    }
    return Promise.resolve();
  }
  // 中文注释：暴露“返回 All Links 视图”的导航方法，供侧栏分类点击时调用（Digest 等其他视图切回 Links）
  try { window.navigateToLinks = renderDefaultMain; } catch {}
  
  function highlightNav(id) {
      $$('.nav-item, #linksGroupHeader, #aiGroupHeader').forEach(el => el.classList.remove('bg-gray-200', 'dark:bg-white/20', 'text-primary'));
      const el = document.getElementById(id);
      if (el) el.classList.add('bg-gray-200', 'dark:bg-white/20', 'text-primary');
  }

  // Navigation Logic
  const navRuneSpace = document.getElementById('navRuneSpace');
  if (navRuneSpace) on(navRuneSpace, 'click', (e) => {
      e.preventDefault();
      renderRuneSpaceView();
  });

  const navDigest = document.getElementById('navDigest');
  const navChat = document.getElementById('navChat');
  const navSendLogs = document.getElementById('navSendLogs');
  const navLinks = document.querySelector('.nav-item[href="#"]'); // Assuming Home/Links is default
  
  // ...
  
  // For now, let's assume clicking "Digest" switches view.
  if (navDigest) on(navDigest, 'click', (e) => { 
      e.preventDefault(); 
      // 中文注释：切换到 Digest 视图时，统一隐藏其他视图
      const runeView = document.getElementById('runeSpaceView');
      const linksViewContainer = document.getElementById('linksViewContainer');
      const chatView = document.getElementById('chatSection');
      const digestSection = document.getElementById('digestSection');
      const sendLogsSection = document.getElementById('sendLogsSection');
      if (runeView) hide(runeView);
      if (linksViewContainer) hide(linksViewContainer);
      if (chatView) hide(chatView);
      if (sendLogsSection) hide(sendLogsSection);
      if (digestSection) show(digestSection);

      // 中文注释：清理 hash，避免 #/send-logs 残留导致后续误触发渲染
      try { if (window.location.hash) window.location.hash = ''; } catch {}

      linksView.disableInfiniteScroll();
      digestView.renderDigests().then(() => {
          const scrollContainer = document.getElementById('mainScrollContainer');
          digestView.enableInfiniteScroll(scrollContainer, {
              onLoadMore: () => digestController.loadNextPage()
          });
          highlightNav('navDigest');
      });
  });

  // 中文注释：发送历史视图（登录守卫）
  function renderSendLogsRoute() {
      const user = storageAdapter.getUser();
      if (!user || !user.id) {
      openInfoModal({ title: 'Unauthorized', message: '请先登录后访问发送历史。' });
          try { window.location.href = 'index.html'; } catch {}
          return;
      }
      const runeView = document.getElementById('runeSpaceView');
      const linksViewContainer = document.getElementById('linksViewContainer');
      const digestSection = document.getElementById('digestSection');
      const chatView = document.getElementById('chatSection');
      const sendLogsSection = document.getElementById('sendLogsSection');
      if (runeView) hide(runeView);
      if (linksViewContainer) hide(linksViewContainer);
      if (digestSection) hide(digestSection);
      if (chatView) hide(chatView);
      if (sendLogsSection) show(sendLogsSection);
      sendLogsView.renderSendLogs();
      highlightNav('navSendLogs');
  }
  if (navSendLogs) on(navSendLogs, 'click', (e) => { 
      e.preventDefault(); 
      try { window.location.hash = '#/send-logs'; } catch {}
      renderSendLogsRoute(); 
  });

  // 中文注释：Hash 路由集成（#/send-logs）
  window.addEventListener('hashchange', () => {
      if (window.location.hash === '#/send-logs') renderSendLogsRoute();
  });
  // 首次加载根据 hash 渲染
  if (window.location.hash === '#/send-logs') renderSendLogsRoute();
  
  // We need a way to go back to Links. 
   // The "Links" header or items inside it.
  const linksHeader = document.getElementById('linksGroupHeader');
  const linksBody = document.getElementById('linksGroupBody');
  if (linksHeader && linksBody) {
      // 中文注释：初始化折叠状态标记，0=展开，1=折叠；避免首击判断错误
      if (!linksBody.dataset.collapsed) linksBody.dataset.collapsed = '0';
      // 点击标题：切换视图 + 切换折叠状态
      on(linksHeader, 'click', (e) => {
          e.preventDefault();
          // 中文注释：模态期间禁止侧栏交互
          if (document.body?.dataset?.modalOpen === '1') return;
          
          // 1. 切换到 Links 视图 (如果当前不在)
          const linksContainer = document.getElementById('linksViewContainer');
          const isViewHidden = !linksContainer || linksContainer.classList.contains('hidden');
          
          if (isViewHidden) {
              renderDefaultMain();
              // 中文注释：强制展开并在动画结束后清理内联样式，避免“首击覆盖/拉伸多次才恢复”问题
              linksBody.style.transition = `max-height 200ms ease-in-out, opacity 200ms ease-in-out`;
              linksBody.style.maxHeight = linksBody.scrollHeight + "px";
              linksBody.style.display = "";
              linksBody.style.opacity = "1";
              linksBody.style.overflow = "hidden";
              linksBody.dataset.collapsed = '0';
              setTimeout(() => {
                  if (linksBody.dataset.collapsed === '0') {
                      linksBody.style.maxHeight = '';
                      linksBody.style.overflow = '';
                      linksBody.style.transition = '';
                  }
              }, 220);
              
              // 旋转图标向下
              const icon = linksHeader.querySelector('.material-symbols-outlined');
              if (icon) {
                  icon.style.transform = 'rotate(0deg)';
                  icon.style.transition = 'transform 0.2s ease';
              }
              return; // 结束，不执行 toggle
          }
          
          // 2. 如果已经在 Links 视图，则执行折叠切换 (依据数据状态)
          const willCollapse = linksBody.dataset.collapsed !== '1' && linksBody.offsetHeight > 0;
          slideToggle(linksBody);
          linksBody.dataset.collapsed = willCollapse ? '1' : '0';
          
          // 3. 旋转图标（基于目标状态）
          const icon = linksHeader.querySelector('.material-symbols-outlined');
          if (icon) {
              icon.style.transform = willCollapse ? 'rotate(-90deg)' : 'rotate(0deg)';
              icon.style.transition = 'transform 0.2s ease';
          }
      });
  }
  const aiHeader = document.getElementById('aiGroupHeader');
   const aiBody = document.getElementById('aiGroupBody');
   if (aiHeader && aiBody) {
       on(aiHeader, 'click', (e) => {
           e.preventDefault();
            // 中文注释：模态期间阻止 AI Features 折叠/展开，避免覆盖 New Category 区域
            if (document.body?.dataset?.modalOpen === '1') return;
           slideToggle(aiBody);
           const icon = aiHeader.querySelector('.material-symbols-outlined');
           if (icon) {
               if (aiBody.style.maxHeight === '0px') {
                   icon.style.transform = 'rotate(-90deg)';
               } else {
                   icon.style.transform = 'rotate(0deg)';
               }
               icon.style.transition = 'transform 0.2s ease';
           }
       });
   }

    if (logoBtn) on(logoBtn, 'click', renderRuneSpaceView); // Logo goes home (Rune Space)

  // Chat View (Placeholder)
  if (navChat) on(navChat, 'click', (e) => { 
      e.preventDefault(); 
      renderChatView(); 
      highlightNav('navChat');
  });

  function renderChatView() {
    if (!mainEl) return;
    // 中文注释：统一隐藏其他视图（RuneSpace / Links / Digest）
    const runeView = document.getElementById('runeSpaceView');
    const linksView = document.getElementById('linksViewContainer');
    const digestSection = document.getElementById('digestSection');
    if (runeView) hide(runeView);
    if (linksView) hide(linksView);
    if (digestSection) hide(digestSection);
    const sendLogsSection = document.getElementById('sendLogsSection');
    if (sendLogsSection) hide(sendLogsSection);

    // Mount chat
    let chatSection = document.getElementById('chatSection');
    if (!chatSection) {
        chatSection = document.createElement('section');
        chatSection.id = 'chatSection';
        // Flex Row for Dual Pane
        chatSection.className = 'flex h-[calc(100vh-64px)] overflow-hidden bg-white dark:bg-black'; 
        
        chatSection.innerHTML = `
            <!-- Left Panel: Conversations -->
            <div id="chatLeftPanel" class="w-full md:w-80 flex-col border-r border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 transition-all duration-300 pt-4 flex">
                <div class="flex border-b border-gray-200 dark:border-white/10 h-[42px] items-center shrink-0">
                    <button id="tabConvs" class="flex-1 h-full text-xs font-medium text-primary border-b-2 border-primary transition-colors flex items-center justify-center">Conversations</button>
                    <button id="tabRunes" class="flex-1 h-full text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex items-center justify-center">RuneSpace</button>
                </div>
                <div id="leftPanelContent" class="flex-1 overflow-y-auto p-2 space-y-2"></div>
            </div>

            <!-- Right Panel: Chat Window -->
            <div id="chatRightPanel" class="flex-1 flex-col h-full relative min-w-0 bg-[#F9FAFB] dark:bg-black hidden md:flex">
                <!-- Header (Tight layout with global search) -->
                <div class="border-b border-[#EDEDED] dark:border-white/10 bg-white dark:bg-surface-dark shrink-0">
                    <div class="h-14 flex items-center justify-between px-4 md:px-8 py-3">
                        <div class="flex items-center gap-3 overflow-hidden">
                            <!-- Mobile Back Button -->
                            <button id="chatMobileBackBtn" class="md:hidden p-1 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full">
                                <span class="material-symbols-outlined">arrow_back</span>
                            </button>
                            
                            <div class="flex flex-col gap-0.5 min-w-0">
                                <h2 id="chatHeaderTitle" class="text-[16px] md:text-[18px] font-[600] text-gray-900 dark:text-white truncate leading-tight">New Chat</h2>
                                <p class="text-[12px] text-gray-400 dark:text-gray-500 font-medium truncate">AI Assistant</p>
                            </div>
                        </div>
                        <div class="flex gap-2 shrink-0">
                            <button class="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors" title="More">
                                <span class="material-symbols-outlined text-[20px]">more_vert</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Messages Area -->
                <div id="chatContainer" class="flex-1 overflow-y-auto px-8 py-4 space-y-4 scroll-smooth">
                    <!-- Messages will be injected here -->
                    <div class="flex flex-col items-center justify-center h-full text-gray-400 opacity-50">
                        <span class="material-symbols-outlined text-4xl mb-2">chat_bubble</span>
                        <p>Select a conversation to start chatting</p>
                    </div>
                </div>

                <!-- Input Area (Composer) -->
                <div class="p-6 bg-transparent shrink-0 sticky bottom-0 pointer-events-none">
                    <div class="relative flex items-center gap-4 max-w-4xl mx-auto bg-white dark:bg-surface-dark rounded-[20px] shadow-sm border border-gray-200 dark:border-gray-700 px-[18px] py-2 pointer-events-auto">
                        <button class="p-2 text-gray-400 hover:text-primary rounded-full hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shrink-0" title="Attach">
                            <span class="material-symbols-outlined text-[24px]">add_circle</span>
                        </button>
                        <div class="flex-1 min-w-0">
                            <textarea id="chatInput" rows="1" class="w-full bg-transparent border-none p-2 max-h-32 focus:ring-0 resize-none text-[15px] placeholder-gray-400" placeholder="Message AI..."></textarea>
                        </div>
                        <button id="sendBtn" class="w-10 h-10 bg-primary text-white rounded-full hover:bg-primary/90 shadow-md flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
                            <span class="material-symbols-outlined text-[20px] ml-0.5">arrow_upward</span>
                        </button>
                    </div>
                    <div class="text-center mt-3 pointer-events-auto">
                        <p class="text-[11px] text-gray-400">AI can make mistakes. Please verify important information.</p>
                    </div>
                </div>
            </div>
        `;
      mainEl.appendChild(chatSection);
      initChat();
    }
    show(chatSection);
  }

  // User Welcome & Dropdown
  loadUserWelcome();

  // 中文注释：登录可见的导航项（Send Logs），未登录时隐藏
  const user = storageAdapter.getUser();
  const sendLogsNavEl = document.getElementById('navSendLogs');
  if (sendLogsNavEl) {
     if (!user || !user.id || user.id === 'local-dev') {
        // 开发模式下 local-dev 也显示，生产未登录隐藏
        const isDev = import.meta?.env?.MODE !== 'production';
        sendLogsNavEl.style.display = isDev ? '' : 'none';
     } else {
        sendLogsNavEl.style.display = '';
     }
  }
  
  function loadUserWelcome() {
    const user = storageAdapter.getUser();
    const userName = user?.nickname || 'Developer';
    const userId = user?.id || 'local-dev';
    const userAvatar = user?.avatar || 'https://i.pravatar.cc/100?img=12';
    
    // 修复：不再移除 #userWelcomeCard 容器，避免 WelcomeCard 无法渲染
    // 旧逻辑会误删容器，导致 loadWelcomeCard() 找不到目标
    const avatarContainer = document.getElementById("userDropdownContainer");
    if (avatarContainer) {
      avatarContainer.innerHTML = `<img src="${userAvatar}" alt="User Avatar" class="user-avatar" title="${userName}" />`;
      
      // Dropdown logic
      let menu = avatarContainer.querySelector('.user-dropdown');
      if (!menu) {
          menu = document.createElement('div');
          menu.className = 'user-dropdown';
          menu.innerHTML = `
            <ul class="p-2">
              <li><button id="profileBtn" class="w-full text-left px-3 py-2 text-sm">Profile</button></li>
              <li><button id="settingsBtn" class="w-full text-left px-3 py-2 text-sm">Settings</button></li>
              <li><button id="logoutBtn" class="w-full text-left px-3 py-2 text-sm">Log out</button></li>
            </ul>`;
          avatarContainer.appendChild(menu);
      }
      const avatar = avatarContainer.querySelector('.user-avatar');
      if (avatar) {
          on(avatar, 'click', (e) => {
              e.stopPropagation();
              menu.classList.toggle('show');
          });
      }
      // ... settings btn logic ...
      const settingsBtn = document.getElementById('settingsBtn');
      if (settingsBtn) on(settingsBtn, 'click', () => {
          menu.classList.remove('show');
          openSettings();
      });
      const profileBtn = document.getElementById('profileBtn');
      if (profileBtn) on(profileBtn, 'click', () => {
           menu.classList.remove('show');
           openSettings('profile');
       });
      
      document.addEventListener('click', (e) => {
          if (!avatarContainer.contains(e.target)) menu.classList.remove('show');
      });
    }
  }

  // Notifications
  const headerButtons = Array.from(document.querySelectorAll('header button'));
  const notifyBtn = headerButtons.find((btn) => btn.querySelector('.material-symbols-outlined')?.textContent?.trim() === 'notifications');
  if (notifyBtn) {
      on(notifyBtn, 'click', () => {
          // ... notification panel logic ...
          let panel = document.getElementById('notifPanel');
          if (!panel) {
              panel = document.createElement('div');
              panel.id = 'notifPanel';
              panel.className = 'notify-panel';
              panel.innerHTML = `
                <div class="p-4">
                  <h4 class="text-sm font-bold mb-2">Recent notifications</h4>
                  <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">No notifications</p>
                  <div class="mt-3 text-right"><button id="notifCloseBtn" class="text-xs text-text-secondary-light">Close</button></div>
                </div>`;
              document.body.appendChild(panel);
              const rect = notifyBtn.getBoundingClientRect();
              panel.style.position = 'fixed';
              panel.style.top = `${rect.bottom + 8}px`;
              panel.style.right = '16px';
              show(panel);
              const closeBtn = panel.querySelector('#notifCloseBtn');
              on(closeBtn, 'click', (ev) => { ev.preventDefault(); ev.stopPropagation(); hide(panel); });
          } else {
              if (panel.style.display === 'none' || !panel.style.display) show(panel); else hide(panel);
          }
      });
  }
}

async function openSettings(defaultTab = 'general') {
    // ... Settings logic from original dashboard.js ...
    // Re-implementing briefly for completeness as it was part of dashboard.js
    const backdrop = document.getElementById('modalBackdrop');
    const container = document.getElementById('settingsModalContainer');
    if (!container) return;
    let panel = document.getElementById('settingsPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'settingsPanel';
        panel.className = 'fixed inset-0 z-50 flex items-center justify-center pointer-events-none';
        container.appendChild(panel);
    }
        panel.innerHTML = `
      <div class="pointer-events-auto relative w-[640px] h-[480px] bg-white dark:bg-surface-dark rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 flex overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div class="w-48 flex-shrink-0 bg-gray-50 dark:bg-black/20 border-r border-gray-100 dark:border-gray-700/50 flex flex-col">
          <div class="p-4 pb-2"><h2 class="text-sm font-bold px-2">Settings</h2></div>
          <nav class="flex-1 px-2 py-2 space-y-0.5">
             <button data-tab="profile" class="settings-tab-btn w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-text-secondary-light">Profile</button>
             <button data-tab="general" class="settings-tab-btn w-full text-left px-3 py-2 rounded-lg text-xs font-medium bg-gray-200 dark:bg-white/10 text-primary">General</button>
             <button data-tab="subscription" class="settings-tab-btn w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-text-secondary-light">Subscription Settings</button>
             <button data-tab="account" class="settings-tab-btn w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-text-secondary-light">Account</button>
          </nav>
          <div class="p-3 border-t border-gray-100"><button id="settingsCloseBtn" class="w-full py-1.5 rounded-lg text-xs font-medium text-text-secondary-light hover:bg-gray-200">Close</button></div>
        </div>
        <div class="flex-1 flex flex-col h-full overflow-hidden bg-surface-light dark:bg-surface-dark">
           <div id="tab-content-profile" class="settings-tab-content flex-1 p-6 overflow-y-auto hidden"></div>
           <div id="tab-content-general" class="settings-tab-content flex-1 p-6 overflow-y-auto">
              <h3 class="text-sm font-bold mb-4">General</h3>
              <div><label class="block text-xs font-medium mb-2">Appearance</label>
                   <select id="themeSelect" class="w-full h-9 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 text-xs px-3"><option value="light">Light</option><option value="dark">Dark</option></select>
              </div>
           </div>
           <div id="tab-content-subscription" class="settings-tab-content flex-1 p-0 overflow-y-auto hidden"></div>
           <div id="tab-content-account" class="settings-tab-content flex-1 p-6 overflow-y-auto hidden"></div>
        </div>
      </div>`;
    show(backdrop);
    show(panel);
    
    const closeBtn = document.getElementById('settingsCloseBtn');
    if (closeBtn) on(closeBtn, 'click', () => { hide(panel); hide(backdrop); });
    on(backdrop, 'click', () => { hide(panel); hide(backdrop); });
    
    // Theme toggle
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        const html = document.documentElement;
        themeSelect.value = html.classList.contains('dark') ? 'dark' : 'light';
        themeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'dark') { html.classList.add('dark'); html.classList.remove('light'); localStorage.setItem('theme', 'dark'); }
            else { html.classList.remove('dark'); html.classList.add('light'); localStorage.setItem('theme', 'light'); }
        });
    }

    // 中文注释：挂载订阅设置面板
    const subContainer = document.getElementById('tab-content-subscription');
    if (subContainer) {
        try { mountSubscriptionSettings(subContainer); } catch (e) { console.warn('[Settings] mount subscription failed', e); }
    }
    const profileContainer = document.getElementById('tab-content-profile');
    if (profileContainer) {
        try { const { mountProfileSettings } = await import('../features/account_settings.js'); mountProfileSettings(profileContainer); } catch (e) { console.warn('[Settings] mount profile failed', e); }
    }
    const accountContainer = document.getElementById('tab-content-account');
    if (accountContainer) {
        try { const { mountAccountSettings } = await import('../features/account_settings.js'); mountAccountSettings(accountContainer); } catch (e) { console.warn('[Settings] mount account failed', e); }
    }

    // Tab 切换
    const tabs = Array.from(panel.querySelectorAll('.settings-tab-btn'));
    tabs.forEach(btn => {
        on(btn, 'click', () => {
            tabs.forEach(b => b.classList.remove('bg-gray-200','dark:bg-white/10','text-primary'));
            btn.classList.add('bg-gray-200','dark:bg-white/10','text-primary');
            const key = btn.dataset.tab;
            panel.querySelectorAll('.settings-tab-content').forEach(c => c.classList.add('hidden'));
            const target = document.getElementById(`tab-content-${key}`);
            if (target) target.classList.remove('hidden');
        });
    });

    // Auto-switch to requested tab
    if (defaultTab && defaultTab !== 'general') {
        const btn = panel.querySelector(`.settings-tab-btn[data-tab="${defaultTab}"]`);
        if (btn) btn.click();
    }
}
