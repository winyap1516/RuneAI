// 中文注释：Stripe Webhook 入口（/stripe-webhook）
// 作用：接收支付回调，幂等入账，发放或回退用户额度
// 安全：校验 Stripe 签名；所有写入使用 Service Role Key；绝不在前端暴露 Secret

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@12";

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

serve(async (req) => {
  const headers = corsHeaders();
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), { status: 405, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb = createClient(supabaseUrl, serviceKey);
  const stripe = new Stripe(stripeSecret, { apiVersion: '2022-11-15' });

  try {
    // 中文注释：读取原始请求体并校验 Stripe 签名
    const sig = req.headers.get('Stripe-Signature') || '';
    const rawBody = await req.text();
    const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);

    // 中文注释：幂等门槛——先写入 stripe_events（带 payload），唯一冲突则直接返回 200
    const id = event.id;
    const { data: logged, error: logErr } = await sb.rpc('log_stripe_event', { p_event_id: id, p_type: event.type, p_payload: event });
    if (logErr) {
      // 若记录失败（例如表不可写），按安全策略返回错误以避免重复发放
      console.error('[StripeWebhook] log_stripe_event failed:', logErr);
      return new Response(JSON.stringify({ error: 'WEBHOOK_LOG_FAILED' }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
    if (logged === false) {
      // 已存在事件 → 幂等跳过
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
    // 中文注释：记录原始事件用于审计
    console.log('[StripeWebhook] event=', event.type, 'id=', id);

    // 中文注释：处理支付成功与退款
    switch (event.type) {
      case 'checkout.session.completed': {
        const session: any = event.data.object;
        const uid = session?.metadata?.user_id;
        const planId = session?.metadata?.plan_id;
        if (!uid || !planId) break;
        // 读取计划与调用事务函数进行幂等发放
        const { data: plan } = await sb.from('plans').select('*').eq('id', planId).single();
        const grant = plan?.grant_amount ?? 0;
        const amount = session?.amount_total ?? plan?.price_cents ?? null;
        const currency = session?.currency ?? plan?.currency ?? 'usd';

        await sb.rpc('apply_purchase_and_grant', {
          p_user_id: uid,
          p_plan_id: planId,
          p_amount: amount,
          p_currency: currency,
          p_payment_intent: session?.payment_intent ?? null,
        });
        // 中文注释：补充写 purchases 的事件与会话标识（便于追踪）；由于 apply 中已插入，此处仅更新标识
        await sb.from('purchases').update({ stripe_event_id: id, stripe_session_id: session?.id ?? null }).eq('stripe_payment_intent', session?.payment_intent ?? '');
        break;
      }
      case 'charge.refunded': {
        const charge: any = event.data.object;
        const pi = charge?.payment_intent;
        const refundId = charge?.refunds?.data?.[0]?.id ?? null;
        if (!pi) break;
        // 默认标记退款（flag），不自动扣减额度，避免用户体验问题
        await sb.rpc('apply_refund_flag', { p_payment_intent: pi, p_refund_id: refundId });
        break;
      }
      default:
        // 其他事件类型：记录但不处理
        break;
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch (e) {
    // 中文注释：校验失败或内部错误
    console.error('[StripeWebhook] error:', e);
    return new Response(JSON.stringify({ error: 'WEBHOOK_ERROR', message: String(e?.message || e) }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
  }
});
