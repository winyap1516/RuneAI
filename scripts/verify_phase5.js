// verify_phase5.js - Phase 5 自动合并与 Tombstone 验证脚本
// 作用：模拟 Client A/B 行为，直接调用 RPC 验证 LWW、Conflict Backup 和 Tombstone 逻辑
// 使用：node scripts/verify_phase5.js

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { config } from 'https://deno.land/x/dotenv/mod.ts';

// 加载 .env (Deno style, adapt if running in Node with dotenv)
// Node 环境适配：
// const { createClient } = require('@supabase/supabase-js');
// require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:65432';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || ''; // Use ANON key for simulation
// 注意：真实测试需确保 RLS 允许或使用 Service Key 绕过（仅限测试环境）
// 这里为了模拟真实客户端，应先登录获取 Token

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 模拟两个设备
const clientA = { id: 'client-A' };
const clientB = { id: 'client-B' };

async function login() {
  // 使用固定测试账号 (local-dev@test.com / password)
  // 若不存在需先创建。这里假设已存在或使用匿名测试。
  // 简化：使用 Service Key 绕过 Auth 直接调用 RPC（仅用于集成测试逻辑验证）
  // 真实场景应使用 supabase.auth.signInWithPassword
  console.log('ℹ️ Using Anon Key (assuming RLS allows or dev mode)...');
  
  // 尝试匿名登录或使用测试账号
  const { data: { session }, error } = await supabase.auth.signInWithPassword({
    email: 'dev@local',
    password: 'password123' // 假设的本地测试密码
  });
  
  if (error) {
    console.warn('⚠️ Login failed (expected if not seeded), proceeding with Anon Key might fail RLS.');
    // 如果是本地开发且 RLS 开启，必须有 Token。
    // 建议：在测试前先 Seed 一个用户。
  }
  return session?.access_token;
}

async function runTest() {
  console.log('🚀 Starting Phase 5 Verification...');
  
  // 1. 准备：登录
  const token = await login();
  // 如果没有 token，后续调用可能会失败（取决于 RLS）
  
  const user_id = (await supabase.auth.getUser()).data.user?.id;
  if (!user_id) {
    console.error('❌ No authenticated user. Cannot run RLS-protected RPC.');
    // process.exit(1); // 暂时继续，看是否是 Service Key
  } else {
    console.log(`✅ Authenticated as ${user_id}`);
  }

  // 2. 测试 Case 1: 基础创建
  console.log('\n🧪 [Case 1] Basic Create (Client A)');
  const item_id = crypto.randomUUID();
  const cid_1 = `change_${Date.now()}_A`;
  const now = new Date().toISOString();
  
  const payload_1 = {
    client_change_id: cid_1,
    resource_type: 'website',
    resource_id: null, // create with null id (or local id)
    op: 'create',
    payload: { url: `https://test-${Date.now()}.com`, title: 'Title A', tags: ['a'] },
    field_timestamps: { url: now, title: now, tags: now }
  };

  const { data: res1, error: err1 } = await supabase.rpc('apply_client_changes', {
    p_user_id: user_id,
    p_changes: [payload_1]
  });

  if (err1) console.error('❌ Case 1 Failed:', err1);
  else {
    console.log('✅ Case 1 Result:', JSON.stringify(res1));
    const serverId = res1.applied[0].server_id;
    if (!serverId) throw new Error('Server ID not returned');
    
    // 3. 测试 Case 2: 字段级合并 (Client B changes tags, Client A changes title)
    console.log('\n🧪 [Case 2] Field Merge (A: Title, B: Tags)');
    const t1 = new Date(Date.now() + 1000).toISOString();
    const t2 = new Date(Date.now() + 2000).toISOString(); // B is later
    
    const changeA = {
      client_change_id: `change_${Date.now()}_A2`,
      resource_type: 'website',
      resource_id: serverId,
      op: 'update',
      payload: { title: 'Title A Modified' },
      field_timestamps: { title: t1 }
    };
    
    const changeB = {
      client_change_id: `change_${Date.now()}_B1`,
      resource_type: 'website',
      resource_id: serverId,
      op: 'update',
      payload: { tags: ['b', 'merged'] },
      field_timestamps: { tags: t2 }
    };

    // 模拟并发：顺序提交
    await supabase.rpc('apply_client_changes', { p_user_id: user_id, p_changes: [changeA] });
    const { data: res2 } = await supabase.rpc('apply_client_changes', { p_user_id: user_id, p_changes: [changeB] });
    
    // 验证：查询最终状态
    const { data: final } = await supabase.from('websites').select('*').eq('id', serverId).single();
    console.log('🔍 Final Record:', final.data);
    
    if (final.data.title === 'Title A Modified' && final.data.tags[1] === 'merged') {
      console.log('✅ Case 2 Passed: Both fields updated.');
    } else {
      console.error('❌ Case 2 Failed: Merge incorrect.');
    }

    // 4. 测试 Case 3: 同字段冲突 (LWW)
    console.log('\n🧪 [Case 3] Conflict LWW (A@t1 vs B@t2)');
    const t3 = new Date(Date.now() + 3000).toISOString();
    const t4 = new Date(Date.now() + 4000).toISOString(); // B wins
    
    const conflictA = {
      client_change_id: `change_${Date.now()}_A3`,
      resource_type: 'website',
      resource_id: serverId,
      op: 'update',
      payload: { description: 'Desc A' },
      field_timestamps: { description: t3 }
    };
    
    const conflictB = {
      client_change_id: `change_${Date.now()}_B2`,
      resource_type: 'website',
      resource_id: serverId,
      op: 'update',
      payload: { description: 'Desc B (Winner)' },
      field_timestamps: { description: t4 }
    };

    await supabase.rpc('apply_client_changes', { p_user_id: user_id, p_changes: [conflictA] }); // A 先
    const { data: res3 } = await supabase.rpc('apply_client_changes', { p_user_id: user_id, p_changes: [conflictB] }); // B 后
    
    const { data: final3 } = await supabase.from('websites').select('*').eq('id', serverId).single();
    console.log('🔍 Final Desc:', final3.data.description);
    
    // 检查 conflict_backups 是否有记录（B 覆盖 A 时通常不视为冲突，因为 B 更新。
    // 冲突通常指：Server 已经是 t4，然后 A 拿着 t3 来更新 -> A 被拒绝并记录备份）
    
    // 模拟 A 落后更新：
    const conflictOld = {
      client_change_id: `change_${Date.now()}_A_Old`,
      resource_type: 'website',
      resource_id: serverId,
      op: 'update',
      payload: { description: 'Desc Old' },
      field_timestamps: { description: t3 } // t3 < t4 (Server)
    };
    const { data: resOld } = await supabase.rpc('apply_client_changes', { p_user_id: user_id, p_changes: [conflictOld] });
    console.log('🔍 Old Update Result:', JSON.stringify(resOld));
    
    if (resOld.conflicts_logged > 0) {
      console.log('✅ Case 3 Passed: Conflict logged for stale update.');
    } else {
      console.error('❌ Case 3 Failed: Should log conflict.');
    }
    
    // 5. 测试 Case 4: Tombstone 删除
    console.log('\n🧪 [Case 4] Tombstone Deletion');
    const tDelete = new Date(Date.now() + 99999).toISOString(); // Future delete
    
    const delChange = {
      client_change_id: `change_${Date.now()}_Del`,
      resource_type: 'website',
      resource_id: serverId,
      op: 'delete',
      payload: { deleted: true },
      field_timestamps: { deleted: tDelete }
    };
    
    const { data: res4 } = await supabase.rpc('apply_client_changes', { p_user_id: user_id, p_changes: [delChange] });
    console.log('🔍 Delete Result:', JSON.stringify(res4));
    
    const { data: final4 } = await supabase.from('websites').select('deleted, deleted_at').eq('id', serverId).single();
    if (final4.deleted === true) {
      console.log('✅ Case 4 Passed: Marked as deleted.');
    } else {
      console.error('❌ Case 4 Failed: Not marked deleted.');
    }
  }
}

runTest().catch(e => console.error('Fatal:', e));
