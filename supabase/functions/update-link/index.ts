import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 中文注释：链接更新函数（支持 AI 状态同步）
// 功能：更新当前登录用户的 links 记录（按 user_id + url 定位）
// 安全：必须携带 Authorization: Bearer <JWT>；仅允许已登录用户调用
// CORS：允许 authorization, apikey, content-type 头；支持 OPTIONS 预检
serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  try {
    // 中文注释：解析请求体并做基础校验
    const body = await req.json().catch(() => ({}));
    const url = String(body?.url || '').trim();
    const title = body?.title ?? undefined;
    const description = body?.description ?? undefined;
    const category = body?.category ?? undefined;
    const tagsInput = body?.tags ?? undefined;
    const ai_status = body?.ai_status ?? undefined;
    const source = body?.source ?? undefined;
    if (!url) {
      return new Response(JSON.stringify({ error: "Missing URL" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 中文注释：初始化 Supabase 客户端（优先使用 SERVICE_ROLE_KEY；本地可回退到 ANON KEY）
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || '';
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || '';
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || '';
    const RUNTIME_KEY = SERVICE_KEY || ANON_KEY;
    if (!SUPABASE_URL || !RUNTIME_KEY) {
      return new Response(JSON.stringify({ error: "SERVER_NOT_CONFIGURED" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(SUPABASE_URL, RUNTIME_KEY);

    // 中文注释：鉴权（从 Authorization 获取 JWT 并解析 user）
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const uid = userData.user.id;

    // 中文注释：清洗 tags（限制数量与类型）
    const tags = Array.isArray(tagsInput)
      ? tagsInput.slice(0, 6).map((t) => String(t).slice(0, 24))
      : undefined;

    // 中文注释：构造更新 payload（只更新传入字段）
    const patch: Record<string, unknown> = {};
    if (title !== undefined) patch.title = title;
    if (description !== undefined) patch.description = description;
    if (category !== undefined) patch.category = category;
    if (tags !== undefined) patch.tags = tags;
    if (ai_status !== undefined) patch.ai_status = ai_status;
    if (source !== undefined) patch.source = source;

    // 中文注释：执行更新（按 user_id + url 约束）
    const { error } = await supabase
      .from('links')
      .update(patch)
      .eq('user_id', uid)
      .eq('url', url);
    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
