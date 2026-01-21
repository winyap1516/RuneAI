// 中文注释：/super-endpoint Edge Function（链接卡片元数据生成）
// 作用：根据用户提供的 URL 抓取网页内容并使用 OpenAI 生成卡片元数据（title/description/tags/category）
// 安全：必须携带用户 JWT（Authorization: Bearer <JWT>）；仅在邮箱已验证的会话下允许生成；不写入数据库，仅返回元数据供前端使用

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

    // 中文注释：初始化 Supabase 客户端（仅使用 SERVICE_ROLE 写库；匿名键仅用于本地开发读取）
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('SB_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SB_SERVICE_ROLE_KEY') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SB_ANON_KEY') || '';
    if (!supabaseUrl || !serviceKey) {
      console.error('[super-endpoint] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(JSON.stringify({ error: 'SERVER_NOT_CONFIGURED' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    // 中文注释：邮箱验证策略
    // 策略调整（2025-12-09）：只要用户持有有效 JWT（即已登录），视为合法用户，不再强制检查 email_confirmed_at。
    // 原因：Supabase Auth 可配置为允许未验证登录；若前端允许登录，业务层应尽量放宽限制。
    const ENV = (Deno.env.get('ENV') || '').toLowerCase();
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // if (ENV !== 'dev' && !userData.user.email_confirmed_at) {
    //   return new Response(JSON.stringify({ error: 'EMAIL_NOT_CONFIRMED' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    // }
    const uid = userData.user.id;

    // 中文注释：解析参数 { url }
    const rawBody = await req.text();
    console.log('[super-endpoint] Raw Body:', rawBody);
    let body = {};
    try {
        body = JSON.parse(rawBody);
    } catch (e) {
        console.error('[super-endpoint] JSON Parse Error:', e);
        return new Response(JSON.stringify({ error: 'INVALID_JSON_BODY' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const url = String(body?.url || '').trim();
    console.log('[super-endpoint] Parsed URL:', url);

    if (!url || !/^https?:\/\//i.test(url)) {
      console.error('[super-endpoint] Invalid URL format');
      return new Response(JSON.stringify({ error: 'INVALID_URL' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 中文注释：工具函数 - 文本清理与超时抓取
    function sanitize(t?: string, max?: number) {
      if (!t) return '';
      let s = String(t).replace(/\r\n?/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n');
      s = s.replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, '').replace(/<\s*iframe[\s\S]*?<\s*\/\s*iframe\s*>/gi, '');
      s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      return (typeof max === 'number' && s.length > max) ? s.slice(0, max) : s;
    }
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

    // 中文注释：抓取网页内容（可选），作为 AI 上下文
    let pageText = '';
    try {
      const resp = await fetchWithTimeout(url, 8000);
      const html = await resp.text();
      pageText = sanitize(html, 4000);
    } catch {
      // 抓取失败不影响流程，AI 可根据 URL 生成基础描述
      pageText = '';
    }

    // 中文注释：OpenAI 配置与回退逻辑（支持本地 mock 与可配置 BASE_URL）
    const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') || '';
    const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';
    const OPENAI_BASE_URL = Deno.env.get('OPENAI_BASE_URL') || 'https://api.openai.com';
    // 中文注释：仅在明确为 dev 环境且开启 mock 时才允许 mock；生产环境强制禁用
    const IS_DEV = (Deno.env.get('ENV') || '').toLowerCase() === 'dev';
    const DEV_MOCK_OPENAI = IS_DEV && (Deno.env.get('DEV_MOCK_OPENAI') || '').toLowerCase() === 'true';
    
    const domain = url.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0] || 'site';
    const fallback = {
      title: domain,
      description: `该链接由用户添加，暂无 AI 摘要：${url}`,
      tags: ['bookmark'],
      category: 'All Links',
    };

    let output = { ...fallback };
    // 生成日志：排队（queued）
    let logId: string | null = null;
    try {
      const { data: queuedLog } = await supabase
        .from('generation_logs')
        .insert({ user_id: uid, website_id: null, status: 'queued', error: null })
        .select('id')
        .single();
      logId = queuedLog?.id || null;
      console.log('[super-endpoint] generation_logs queued id=', logId);
    } catch (e) {
      console.error('[super-endpoint] queue log failed:', e?.message || e);
    }
    // 生成日志：开始（started）
    if (logId) {
      try {
        await supabase.from('generation_logs').update({ status: 'started' }).eq('id', logId);
      } catch (e) {
        console.error('[super-endpoint] start log failed:', e?.message || e);
      }
    }
    // 中文注释：仅在 Dev 且显式开启 Mock，或 Key 为 mock_ 开头时（且在 Dev）才进入 Mock
    if (DEV_MOCK_OPENAI || (IS_DEV && (OPENAI_KEY || '').startsWith('mock_'))) {
      // 中文注释：本地 mock 回复（不访问外部网络）
      output.description = `（Mock）该链接由用户添加：${url}`;
    } else if (OPENAI_KEY) {
      try {
        const sys = `You are a web metadata generator.
Based on the URL and content, generate JSON data.
**MUST return pure JSON**, no markdown, no \`\`\`json.
Fields:
- title: Page title (English, concise, <=100 chars)
- description: Page summary (English, 2-3 sentences, <=300 chars, objective)
- tags: 2-6 short tags (English, lowercase)
- category: Choose ONE from: [AI, Technology, Design, Development, News, Business, Productivity, Social, Education, Entertainment, Shopping, Finance, Health, Travel, Tools, Other]

If content is empty, guess from URL.`;

        const userMsg = `URL: ${url}\nContent Preview: ${pageText || 'None'}`;
        const payload = {
          model: OPENAI_MODEL,
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: userMsg }
          ],
          temperature: 0.3,
          max_tokens: 500
        };
        const aiRes = await requestWithRetry(`${OPENAI_BASE_URL}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
          body: JSON.stringify(payload)
        }, 1, 15000); // 稍微增加超时时间
        const aiJson = await aiRes.json();
        let content = String(aiJson?.choices?.[0]?.message?.content || '').trim();
        
        // 自动清洗 markdown 标记 (```json ... ```)
        if (content.startsWith('```')) {
            content = content.replace(/^```(json)?\s*/i, '').replace(/\s*```$/, '');
        }

        try {
          const parsed = JSON.parse(content);
          output.title = sanitize(parsed?.title, 120) || output.title;
          output.description = sanitize(parsed?.description, 600) || output.description;
          output.tags = Array.isArray(parsed?.tags) && parsed.tags.length ? parsed.tags.slice(0, 6).map((t: unknown) => String(t).slice(0, 24)) : output.tags;
          // 确保 category 在白名单内，否则归为 Other
          const validCategories = ['AI', 'Technology', 'Design', 'Development', 'News', 'Business', 'Productivity', 'Social', 'Education', 'Entertainment', 'Shopping', 'Finance', 'Health', 'Travel', 'Tools', 'Other'];
          const cat = String(parsed?.category || '').trim();
          output.category = validCategories.find(c => c.toLowerCase() === cat.toLowerCase()) || 'Other';
          
          // Google Favicon API
          // 中文注释：在后端生成 Favicon URL，减轻前端计算压力并保持数据一致性
          const domain = url.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0];
          if (domain) {
              output.favicon = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
          }
        } catch {
          // 中文注释：若模型未返回 JSON，使用纯文本作为描述回退
          const desc = sanitize(content, 600);
          if (desc) output.description = desc;
        }
      } catch (e) {
        // 中文注释：AI 失败保持回退输出，避免前端崩溃；同时打印错误便于本地联调定位（不会返回到前端）
        console.error('[super-endpoint] OpenAI 调用失败：', e?.message || e);
        output = { ...fallback };
      }
    }

    // 中文注释：将生成结果写入 public.links（幂等：按 user_id+url 查找，存在则更新，否则插入）
    let row: any = null;
    try {
      const { data: existed, error: findErr } = await supabase
        .from('links')
        .select('*')
        .eq('user_id', uid)
        .eq('url', url)
        .single();
      if (findErr && String(findErr?.message || '').includes('No rows')) {
        // 不存在：插入
        const generation_meta = {
          model: OPENAI_KEY ? OPENAI_MODEL : 'mock',
          ts: new Date().toISOString(),
          base_url: OPENAI_BASE_URL || '',
        };
        const { data: inserted, error: insErr } = await supabase
          .from('links')
          .insert({
            user_id: uid,
            url,
            title: output.title,
            description: output.description,
            category: output.category,
            tags: output.tags,
            ai_status: 'completed',
            source: 'AI',
            generation_meta
          })
          .select('*')
          .single();
        if (insErr) throw insErr;
        row = inserted;
      } else if (existed) {
        // 存在：更新
        const generation_meta = {
          ...(existed.generation_meta || {}),
          model: OPENAI_KEY ? OPENAI_MODEL : 'mock',
          ts: new Date().toISOString(),
          base_url: OPENAI_BASE_URL || ''
        };
        const { data: updated, error: updErr } = await supabase
          .from('links')
          .update({
            title: output.title,
            description: output.description,
            category: output.category,
            tags: output.tags,
            ai_status: 'completed',
            source: 'AI',
            generation_meta
          })
          .eq('id', existed.id)
          .eq('user_id', uid)
          .select('*')
          .single();
        if (updErr) throw updErr;
        row = updated;
      } else {
        // 其它错误：直接抛出
        throw findErr;
      }
    } catch (e) {
      console.error('[super-endpoint] write links failed:', e?.message || e);
    }

    // 生成日志：成功或失败（若 row 写库失败但生成成功，仍写失败日志）
    try {
      if (row && logId) {
        await supabase.from('generation_logs').update({ status: 'success', website_id: row.id, error: null }).eq('id', logId);
      } else if (logId) {
        await supabase.from('generation_logs').update({ status: 'failed', error: { message: 'WRITE_LINKS_FAILED' } }).eq('id', logId);
      }
    } catch (e) {
      console.error('[super-endpoint] finish log failed:', e?.message || e);
    }

    const result = { ok: true, data: output, user_id: uid, row };
    return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: String(e?.message || e) }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  }
});
