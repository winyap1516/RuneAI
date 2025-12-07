import { supabase } from '/src/js/services/supabaseClient.js'
import config from '/src/js/services/config.js'
import storageAdapter from '/src/js/storage/storageAdapter.js'
import { setBtnLoading, escapeHTML, showToast } from '/src/js/utils/ui-helpers.js'

function buildRedirectUrl(provider = 'google', action = 'link') {
  const base = config?.frontendBaseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
  const state = Math.random().toString(36).slice(2)
  const url = new URL(`${base}/oauth-callback.html`)
  url.searchParams.set('action', action)
  url.searchParams.set('state', state)
  url.searchParams.set('provider', provider)
  return url.toString()
}

/**
 * Mount Profile Settings (Avatar, Nickname)
 */
export async function mountProfileSettings(root) {
  if (!root) return

  const user = storageAdapter.getUser() || { nickname: 'Guest', email: '' }
  
  root.innerHTML = `
    <div class="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10">
        <h3 class="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4">Edit Profile</h3>
        <div class="flex items-start gap-4">
          <div class="flex-shrink-0">
            <img id="settingsAvatarPreview" src="${user.avatar || 'https://i.pravatar.cc/150?img=12'}" alt="Avatar" class="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm">
          </div>
          <div class="flex-1 space-y-3">
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Nickname</label>
              <input id="settingsNickname" type="text" value="${escapeHTML(user.nickname)}" class="w-full h-9 rounded-lg border border-gray-200 text-sm px-3 dark:bg-white/5 dark:border-white/10 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Avatar URL</label>
              <input id="settingsAvatarUrl" type="text" value="${escapeHTML(user.avatar)}" placeholder="https://..." class="w-full h-9 rounded-lg border border-gray-200 text-sm px-3 dark:bg-white/5 dark:border-white/10 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
            </div>
            <div class="flex items-center justify-between pt-1">
              <span class="text-xs text-gray-400">UID: ${user.id?.slice(0, 8)}...</span>
              <button id="btnSaveProfile" class="px-4 py-1.5 bg-primary text-white text-xs font-medium rounded-lg shadow-sm hover:bg-primary/90 transition-colors">Save Changes</button>
            </div>
          </div>
        </div>
    </div>
  `

  // Bind Events
  const avatarInput = root.querySelector('#settingsAvatarUrl')
  const avatarPreview = root.querySelector('#settingsAvatarPreview')
  const nicknameInput = root.querySelector('#settingsNickname')
  const btnSaveProfile = root.querySelector('#btnSaveProfile')

  if (avatarInput && avatarPreview) {
    avatarInput.addEventListener('input', () => {
      if (avatarInput.value.startsWith('http')) {
        avatarPreview.src = avatarInput.value
      }
    })
  }

  if (btnSaveProfile) {
    btnSaveProfile.addEventListener('click', async () => {
      try {
        setBtnLoading(btnSaveProfile, true, 'Saving...', 'Save Changes')
        
        const updates = {
          nickname: nicknameInput?.value?.trim() || '',
          avatar: avatarInput?.value?.trim() || ''
        }

        const { error } = await supabase.auth.updateUser({
          data: {
            nickname: updates.nickname,
            avatar_url: updates.avatar
          }
        })
        if (error) throw error

        const currentUser = storageAdapter.getUser() || {}
        storageAdapter.saveUser({
          ...currentUser,
          nickname: updates.nickname,
          avatar: updates.avatar
        })

        showToast('Profile updated successfully', 'success')
      } catch (err) {
        console.error('Update profile failed:', err)
        showToast(err.message || 'Update failed', 'error')
      } finally {
        setBtnLoading(btnSaveProfile, false, '', 'Save Changes')
      }
    })
  }
}

/**
 * Mount Account Settings (Email, UID, Connected Accounts, Danger Zone)
 */
export async function mountAccountSettings(root) {
  if (!root) return

  const user = storageAdapter.getUser() || { nickname: 'Guest', email: 'Not logged in' }
  // 优先渲染基础 UI，异步获取会话后再调整 Providers 状态
  let isGoogleLinked = false
  let isAppleLinked = false
  Promise.resolve().then(async () => {
    try {
      const resp = await (supabase?.auth?.getSession?.())
      const session = resp?.data?.session || null
      const providers = session?.user?.app_metadata?.providers || []
      isGoogleLinked = providers.includes('google')
      isAppleLinked = providers.includes('apple')
      const btn = root.querySelector('#btnLinkGoogle')
      if (btn && isGoogleLinked) {
        btn.setAttribute('disabled', 'disabled')
        btn.className = 'px-3 py-1.5 text-xs font-medium rounded-lg text-gray-500 bg-gray-100 cursor-not-allowed dark:bg-white/10 dark:text-gray-400'
        btn.textContent = 'Connected'
      }
    } catch {}
  })

  root.innerHTML = `
    <div class="space-y-6">
      <!-- Read-only Account Info -->
      <div class="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10">
        <div class="relative">
          <img src="${user.avatar || 'https://i.pravatar.cc/150?img=12'}" alt="Avatar" class="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm">
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">${escapeHTML(user.nickname) || 'Rune User'}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 truncate">${escapeHTML(user.email) || 'user@example.com'}</p>
          <div class="mt-1 flex items-center gap-2">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
              Guest
            </span>
            
          </div>
        </div>
      </div>

      <!-- Connected Accounts -->
      <div class="space-y-3">
        <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-200 uppercase tracking-wider">Connected Accounts</h4>
        
        <!-- Google -->
        <div class="flex items-center justify-between p-3 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 flex items-center justify-center bg-white rounded-full border border-gray-200 shadow-sm">
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" class="w-5 h-5" alt="Google">
            </div>
            <div>
              <div class="text-sm font-medium text-gray-900 dark:text-gray-100">Google</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">${isGoogleLinked ? 'Connected' : 'Not Connected'}</div>
            </div>
          </div>
          <button id="btnLinkGoogle" class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            isGoogleLinked 
              ? 'text-gray-500 bg-gray-100 cursor-not-allowed dark:bg-white/10 dark:text-gray-400' 
              : 'text-white bg-blue-600 hover:bg-blue-700 shadow-sm'
          }" ${isGoogleLinked ? 'disabled' : ''}>
            ${isGoogleLinked ? 'Connected' : 'Connect'}
          </button>
        </div>

        <!-- Apple -->
        <div class="flex items-center justify-between p-3 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors opacity-75">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 flex items-center justify-center bg-black text-white rounded-full border border-gray-800 shadow-sm">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.74s2.57-.99 4.31-.74c.58.03 2.21.23 3.24 1.73-.09.06-1.92 1.12-1.9 4.45.02 3.55 3.12 4.73 3.16 4.77-.03.07-.49 1.68-1.62 3.32-.97 1.42-1.99 2.84-3.27 2.7zm-4.32-14.7c.78-.94 1.3-2.26 1.15-3.57-1.12.05-2.48.74-3.29 1.7-.72.85-1.34 2.22-1.18 3.53 1.25.1 2.53-.72 3.32-1.66z"/></svg>
            </div>
            <div>
              <div class="text-sm font-medium text-gray-900 dark:text-gray-100">Apple</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">${isAppleLinked ? 'Connected' : 'Not Connected'}</div>
            </div>
          </div>
          <button class="px-3 py-1.5 text-xs font-medium rounded-lg text-gray-400 bg-gray-100 cursor-not-allowed dark:bg-white/5" disabled>
            Coming Soon
          </button>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="pt-4 border-t border-gray-100 dark:border-white/10">
        <h4 class="text-sm font-semibold text-red-600 mb-3 uppercase tracking-wider">Danger Zone</h4>
        <button id="btnSignOut" class="w-full flex items-center justify-center px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors dark:border-red-900/30 dark:hover:bg-red-900/20 dark:text-red-400">
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          Sign Out
        </button>
      </div>
    </div>
  `

  const btnLinkGoogle = root.querySelector('#btnLinkGoogle')
  if (btnLinkGoogle) {
    btnLinkGoogle.addEventListener('click', async () => {
      try {
        setBtnLoading(btnLinkGoogle, true, 'Connecting...', 'Connect')
        
        const redirectTo = buildRedirectUrl('google', 'link')
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { 
            redirectTo,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent'
            }
          }
        })
      } catch (err) {
        console.error('Link Google failed:', err)
        setBtnLoading(btnLinkGoogle, false, '', 'Retry')
      }
    })
  }

  const btnSignOut = root.querySelector('#btnSignOut')
  if (btnSignOut) {
    btnSignOut.addEventListener('click', async () => {
      if (confirm('Are you sure you want to sign out?')) {
        await supabase.auth.signOut()
        window.location.href = 'index.html'
      }
    })
  }
}

export default { mountAccountSettings, mountProfileSettings }
