import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import assert from 'assert';

// Try loading .env.local first, then .env
dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error('Error: Missing environment variables. Please check .env or .env.local');
  console.error('Current vars:', { 
    SUPABASE_URL: !!SUPABASE_URL, 
    SERVICE_KEY: !!SERVICE_KEY, 
    ANON_KEY: !!ANON_KEY 
  });
  process.exit(1);
}

// Admin Client (Service Role) - for data cleanup and verification
const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// User Client (Anon) - for testing RLS and Functions
const userClient = createClient(SUPABASE_URL, ANON_KEY);

async function main() {
  console.log('🚀 Starting Phase 4 Verification...');

  // 1. Auth: Sign Up / Sign In (Mock User)
  const email = `test_${Date.now()}@example.com`;
  const password = 'Password123!';
  console.log(`\n👤 Creating test user: ${email}`);
  
  const { data: authData, error: authError } = await userClient.auth.signUp({
    email,
    password,
  });

  if (authError) {
    console.error('SignUp failed:', authError.message);
    process.exit(1);
  }

  const userId = authData.user?.id;
  console.log(`✅ User created: ${userId}`);

  // 2. RLS Verification
  console.log('\n🔒 Verifying RLS (Direct Insert)...');
  // Try to insert directly (should succeed for own data)
  const { data: linkData, error: linkError } = await userClient.from('websites').insert({
    url: 'https://example.com',
    title: 'Direct Insert Test',
    user_id: userId // RLS should force this anyway or check it matches auth.uid()
  }).select().single();

  if (linkError) {
    console.error('RLS Insert failed:', linkError);
  } else {
    console.log('✅ RLS Insert allowed for own data.');
  }

  // 3. Function: sync-push (Create)
  console.log('\n📤 Testing /sync-push (Create)...');
  const changeId1 = `change_${Date.now()}_1`;
  const payload1 = {
    client_change_id: changeId1,
    resource_type: 'website',
    op: 'create',
    payload: {
      url: 'https://supabase.com',
      title: 'Supabase',
      description: 'The open source Firebase alternative.',
      category: 'Dev',
      tags: ['db', 'realtime']
    }
  };

  const { data: pushData1, error: pushError1 } = await userClient.functions.invoke('sync-push', {
    body: { changes: [payload1] }
  });

  if (pushError1) {
    console.error('sync-push failed:', pushError1);
  } else {
    let data = pushData1;
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { console.error('Failed to parse JSON', e); }
    }
    console.log('Response:', data);
    // Check if pushData1 is valid object
    if (data && Array.isArray(data.applied)) {
        assert(data.applied.length === 1, 'Should have 1 applied change');
        assert(data.applied[0].client_change_id === changeId1, 'Change ID match');
        assert(data.applied[0].server_id, 'Should return server_id');
        console.log('✅ sync-push (Create) successful.');
    } else {
        console.error('Invalid sync-push response:', data);
    }
  }

  // 4. Function: sync-push (Idempotency)
  console.log('\n🔁 Testing Idempotency (Repeat Push)...');
  const { data: pushDataRepeat, error: pushErrorRepeat } = await userClient.functions.invoke('sync-push', {
    body: { changes: [payload1] }
  });

  if (pushErrorRepeat) {
    console.error('Repeat push failed:', pushErrorRepeat);
  } else {
    let data = pushDataRepeat;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch {} }
    console.log('Response:', data);
    if (data && Array.isArray(data.applied)) {
        assert(data.applied.length === 1, 'Should return as applied (idempotent)');
        console.log('✅ Idempotency check passed.');
    }
  }

  // 5. Function: sync-push (Update with Conflict Check)
  console.log('\n📝 Testing /sync-push (Update)...');
  const data1 = typeof pushData1 === 'string' ? JSON.parse(pushData1) : pushData1;
  const serverId = data1?.applied?.[0]?.server_id;
  if (serverId) {
    const changeId2 = `change_${Date.now()}_2`;
    // Fetch current updated_at to simulate valid base_ts
    const { data: currentLink } = await userClient.from('websites').select('updated_at').eq('id', serverId).single();
    
    const payload2 = {
      client_change_id: changeId2,
      resource_type: 'website',
      resource_id: serverId,
      op: 'update',
      base_server_ts: currentLink.updated_at, // Valid timestamp
      payload: {
        title: 'Supabase (Updated)'
      }
    };

    const { data: pushData2, error: pushError2 } = await userClient.functions.invoke('sync-push', {
      body: { changes: [payload2] }
    });

    if (pushError2) {
      console.error('sync-push (Update) failed:', pushError2);
    } else {
      let data = pushData2;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch {} }
      console.log('Response:', data);
      if (data && Array.isArray(data.applied)) {
          assert(data.applied.length === 1, 'Update should apply');
          console.log('✅ sync-push (Update) successful.');
      }
    }
  } else {
    console.warn('Skipping Update test (no server_id from create step).');
  }

  // 6. Function: sync-pull
  console.log('\n📥 Testing /sync-pull...');
  const { data: pullData, error: pullError } = await userClient.functions.invoke('sync-pull', {
    method: 'GET'
  });

  if (pullError) {
    console.error('sync-pull failed:', pullError);
  } else {
    let data = pullData;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch {} }
    console.log(`Received: ${data?.websites?.length} websites`);
    assert(Array.isArray(data?.websites), 'Should return websites array');
    assert(data.websites.length >= 1, 'Should contain at least the pushed website');
    console.log('✅ sync-pull successful.');
  }

  // Cleanup (Optional)
  console.log('\n🧹 Cleanup...');
  await adminClient.auth.admin.deleteUser(userId);
  console.log('✅ Test user deleted.');

  console.log('\n🎉 Phase 4 Verification Complete!');
}

main().catch(e => console.error(e));
