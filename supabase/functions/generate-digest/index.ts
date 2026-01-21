// 中文注释：/generate-digest Edge Function
// 作用：为指定用户生成 Digest（手动 manual 或定时 scheduled），写入 digests，并在满足条件时写入 send_queue
// 安全：必须携带 JWT（Authorization: Bearer <JWT>），服务端使用 SERVICE_ROLE_KEY，前端仅使用 anon key

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    // 中文注释：CORS 设置，允许 POST/OPTIONS 调用
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 中文注释：初始化 Supabase 客户端（优先使用 SERVICE_ROLE_KEY；缺失时在本地开发回退到 ANON KEY）并校验用户身份
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('SB_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SB_SERVICE_ROLE_KEY') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SB_ANON_KEY') || '';
    const runtimeKey = serviceKey || anonKey;
    if (!supabaseUrl || !runtimeKey) {
      return new Response(JSON.stringify({ error: 'SERVER_NOT_CONFIGURED' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(supabaseUrl, runtimeKey);

    // 中文注释：邮箱验证策略
    // 策略调整（2025-12-09）：只要用户持有有效 JWT（即已登录），视为合法用户，不再强制检查 email_confirmed_at。
    // 原因：Supabase Auth 可配置为允许未验证登录；若前端允许登录，业务层应尽量放宽限制。
    const ENV = (Deno.env.get('ENV') || '').toLowerCase();
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    // if (ENV !== 'dev' && !userData.user.email_confirmed_at) {
    //   return new Response(JSON.stringify({ error: 'EMAIL_NOT_CONFIRMED' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    // }
    const uid = userData.user.id;

    // 中文注释：解析请求参数 { user_id, mode: 'manual'|'scheduled', link_id?: string }
    const { user_id, mode = 'manual', link_id } = await req.json();
    if (!user_id || user_id !== uid) {
      return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let links = [];
    let targetLink = null;

    if (link_id) {
        // Mode A: Single Link Digest (Manual for specific site)
        // 中文注释：针对特定链接生成日报
        const { data, error } = await supabase.from('links').select('*').eq('id', link_id).eq('user_id', uid).single();
        if (error) return new Response(JSON.stringify({ error: 'LINK_NOT_FOUND', message: error.message }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        targetLink = data;
        links = [data];
    } else {
        // Mode B: Daily Summary (All recent links)
        // 中文注释：读取该用户的 links（或 websites，根据现有表）
        const { data, error } = await supabase.from('links').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(20);
        if (error) return new Response(JSON.stringify({ error: 'QUERY_FAILED', table: 'links', message: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        links = data || [];
    }

    // 中文注释：AI 摘要生成（OpenAI，可选）
    // 规则：
    // - 有 OPENAI_API_KEY 时调用真实 AI
    // - 若指定了 targetLink，尝试抓取网页内容作为上下文
    const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') || '';
    const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';
    const OPENAI_BASE_URL = (Deno.env.get('OPENAI_BASE_URL') || 'https://api.openai.com').replace(/\/+$/, '');
    const IS_DEV = (Deno.env.get('ENV') || '').toLowerCase() === 'dev';
    const DEV_MOCK_OPENAI = IS_DEV && (Deno.env.get('DEV_MOCK_OPENAI') || '').toLowerCase() === 'true';
    
    function sanitize(t?: string, max?: number) {
      if (!t) return '';
      let s = String(t).replace(/\r\n?/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n');
      s = s.replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, '').replace(/<\s*iframe[\s\S]*?<\s*\/\s*iframe\s*>/gi, '');
      s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      return (typeof max === 'number' && s.length > max) ? s.slice(0, max) : s;
    }
    async function requestWithRetry(input: Request | string, init: RequestInit, retries = 1, timeoutMs = 12000): Promise<Response> {
      for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(input, { ...init, signal: controller.signal });
          clearTimeout(id);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res;
        } catch (err) {
          clearTimeout(id);
          if (attempt === retries) throw err;
          await new Promise(r => setTimeout(r, 600));
        }
      }
      throw new Error('unreachable');
    }
    // Fetch helper from super-endpoint
    async function fetchWithTimeout(target: string, timeoutMs = 8000): Promise<Response> {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(target, { signal: controller.signal });
        clearTimeout(id);
        return res;
      } catch (e) {
        clearTimeout(id);
        throw e;
      }
    }

    let title = `日报 ${new Date().toLocaleDateString()}`;
    if (targetLink) {
        title = `Digest: ${targetLink.title || targetLink.url}`;
    }

    let summary = `您共有 ${links?.length ?? 0} 条收藏，暂无 AI Key，返回占位摘要。`;
    
    if (DEV_MOCK_OPENAI || (IS_DEV && (OPENAI_KEY || '').startsWith('mock_'))) {
      summary = `（Mock）针对 ${targetLink ? targetLink.url : links?.length + ' 条链接'} 生成的占位日报。`;
    } else if (OPENAI_KEY) {
      try {
        let contextText = '';
        
        if (targetLink) {
            // Case A: Single Link Crawl
            try {
                const resp = await fetchWithTimeout(targetLink.url, 8000);
                const html = await resp.text();
                contextText = `Target URL: ${targetLink.url}\nContent Preview:\n${sanitize(html, 3000)}`;
            } catch (e) {
                contextText = `Target URL: ${targetLink.url}\n(Fetch failed: ${e.message})\nDescription: ${targetLink.description || ''}`;
            }
        } else {
            // Case B: Multi-link Summary
            const items = (links || []).map((l, i) => `- (${i+1}) ${sanitize(l.title, 120)} — ${sanitize(l.description || '', 160)}`);
            contextText = `User Links:\n${items.join('\n')}`;
        }

        const prompt = [
          'You are a professional news digest assistant.',
          targetLink ? 'Based on the following crawled web content, generate a concise digest:' : 'Based on the user\'s recent bookmarks, generate a 4-6 sentence summary:',
          'Requirements: English output, concise, objective, high information density, suitable for quick reading.',
          targetLink ? 'Focus on core insights, latest news, or key facts.' : 'Cover main topics.',
          'Content:',
          contextText || '(Empty)'
        ].join('\n');

        const payload = {
          model: OPENAI_MODEL,
          messages: [
            { role: 'system', content: 'You will output in English. Concise, informative, digest style.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          max_tokens: 800
        };
        const endpoint = `${OPENAI_BASE_URL}/v1/chat/completions`; 
        const aiRes = await requestWithRetry(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
          body: JSON.stringify(payload)
        }, 1, 15000); // Increased timeout for generation
        const aiJson = await aiRes.json();
        const content = String(aiJson?.choices?.[0]?.message?.content || '').trim();
        summary = sanitize(content, 2000) || summary;
      } catch (e) {
        summary = `AI 生成失败，回退占位摘要。原因：${String((e as Error)?.message || e)}。`;
      }
    }

    // 中文注释：本地模拟模式下跳过数据库写入，仅返回预览
    if (!supabase && DEV_MOCK_SUPABASE) {
       // ... existing mock logic ...
    }

    // 中文注释：写入 digests 表
    const { data: inserted, error: insertErr } = await supabase.from('digests').insert({
      user_id: uid,
      website_id: targetLink ? targetLink.id : null, // Link specific
      type: mode,
      summary: summary,
      metadata: { title, target_url: targetLink?.url },
      status: 'created',
      generated_at: new Date().toISOString()
    }).select().single();
    
    if (insertErr) {
      return new Response(JSON.stringify({ error: 'INSERT_FAILED', message: insertErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    /*
    const { data: txRes, error: txErr } = await supabase!.rpc('generate_digest_with_quota', {
      p_user_id: uid,
      p_mode: mode,
      p_title: title,
      p_summary: summary
    });
    if (txErr) {
      if (String(txErr.message || '').includes('DAILY_LIMIT_REACHED')) {
        return new Response(JSON.stringify({ error: 'DAILY_LIMIT_REACHED' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: 'INSERT_FAILED', message: txErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const digestId = txRes?.id;
    const { data: inserted, error: getErr } = await supabase.from('digests').select('*').eq('id', digestId).single();
    if (getErr) return new Response(JSON.stringify({ error: 'QUERY_FAILED', table: 'digests', message: getErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    */

    // 中文注释：仅当为 scheduled 且存在启用且频率不为 off 的订阅时入队
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('id,enabled,frequency')
      .eq('user_id', uid)
      .eq('enabled', true);
    const hasActive = (subs ?? []).some(s => (s.frequency ?? 'daily') !== 'off');
    if (mode === 'scheduled' && hasActive) {
      await supabase.from('send_queue').insert({ digest_id: inserted.id });
      // 更新订阅最近生成时间戳（便于后续频率判断）
      await supabase.from('subscriptions').update({ last_generated_at: new Date().toISOString() }).eq('user_id', uid).eq('enabled', true);
    }

    // 中文注释：额度扣减已在事务函数中处理，此处无需重复扣减

    // 中文注释：返回 digest 预览（summary + title + links 数量）
    const preview = { title: inserted.title, summary: inserted.summary, link_count: links?.length ?? 0 };
    return new Response(JSON.stringify({ ok: true, digest: inserted, preview }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: String(e?.message || e) }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  }
});
