
import { getPendingChanges } from './sync/changeLog.js';
import { isLoggedIn, isCloudReady } from './services/supabaseClient.js';
import storageAdapter from './storage/storageAdapter.js';
import { logger } from './services/logger.js';
import { config } from './services/config.js';

export async function runSyncDiagnostics() {
  console.group('🔍 Sync Diagnostics');
  
  // 1. Check Config
  console.log('1. Config Check:');
  console.log('   Cloud Ready:', isCloudReady());
  console.log('   Supabase URL:', config.supabaseUrl ? 'OK' : 'MISSING');
  console.log('   Anon Key:', config.supabaseAnonKey ? 'OK' : 'MISSING');

  // 2. Check Auth
  console.log('2. Auth Check:');
  try {
    const logged = await isLoggedIn();
    console.log('   Is Logged In:', logged);
    const user = storageAdapter.getUser();
    console.log('   Local User:', user ? `${user.id} (${user.email})` : 'NONE');
  } catch (e) {
    console.error('   Auth Check Failed:', e);
  }

  // 3. Check Pending Changes
  console.log('3. Pending Changes:');
  try {
    const changes = await getPendingChanges(100);
    console.log(`   Count: ${changes.length}`);
    if (changes.length > 0) {
      console.table(changes.map(c => ({ 
        id: c.client_change_id.slice(0,8), 
        op: c.op, 
        type: c.resource_type, 
        res_id: c.resource_id 
      })));
    } else {
      console.log('   No pending changes (Queue is empty)');
    }
  } catch (e) {
    console.error('   Failed to read changes:', e);
  }

  // 4. Check ID Mapping
  console.log('4. ID Mapping Check (Sample):');
  try {
    const map = JSON.parse(localStorage.getItem('rune_server_id_map') || '{}');
    const websites = map.website || {};
    const keys = Object.keys(websites);
    console.log(`   Mapped Websites: ${keys.length}`);
    if (keys.length > 0) {
      console.log(`   Sample: ${keys[0]} -> ${websites[keys[0]]}`);
    }
  } catch (e) {
    console.error('   Failed to read mapping:', e);
  }

  console.groupEnd();
  return 'Done';
}

// Expose to window for easy access
window.runSyncDiagnostics = runSyncDiagnostics;
