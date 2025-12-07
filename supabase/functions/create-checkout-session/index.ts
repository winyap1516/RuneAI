// 中文注释：创建 Stripe Checkout Session（/create-checkout-session）
// 作用：根据计划创建结账会话，返回重定向 URL
// 安全：必须携带用户 JWT；Secret 与 Price ID 仅在后端函数环境中使用

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@12";

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

serve(async (req) => {
  const headers = corsHeaders();
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), { status: 405, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  try {
    // 中文注释：初始化服务端 Supabase 与 Stripe 客户端
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
    const frontendBase = Deno.env.get('FRONTEND_BASE_URL')!;
    const sb = createClient(supabaseUrl, serviceKey);
    const stripe = new Stripe(stripeSecret, { apiVersion: '2022-11-15' });

    // 中文注释：校验用户身份
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const { data: userData, error: userErr } = await sb.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
    // 中文注释：强制邮箱验证校验（未验证禁止创建结账会话）
    if (!userData.user.email_confirmed_at) {
      return new Response(JSON.stringify({ error: 'EMAIL_NOT_CONFIRMED' }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
    const uid = userData.user.id;

    // 中文注释：解析 plan_id 并读取计划数据
    const { plan_id } = await req.json();
    if (!plan_id) {
      return new Response(JSON.stringify({ error: 'INVALID_PAYLOAD' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
    const { data: plan, error: pErr } = await sb.from('plans').select('*').eq('id', plan_id).eq('active', true).single();
    if (pErr || !plan) {
      return new Response(JSON.stringify({ error: 'PLAN_NOT_FOUND' }), { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
    if (!plan.stripe_price_id) {
      return new Response(JSON.stringify({ error: 'PRICE_NOT_CONFIGURED' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    // 中文注释：创建 Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: plan.recurring ? 'subscription' : 'payment',
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      metadata: { user_id: uid, plan_id: plan.id },
      success_url: `${frontendBase}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendBase}/billing/cancel`,
    });

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
  }
});
