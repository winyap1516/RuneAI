// 中文注释：/send-worker Edge Function（可由 Supabase Scheduler 每 1 分钟触发）
// 作用：处理发送队列，逐条发送至 Telegram（后续可扩展 WhatsApp），写入 send_logs，更新队列与 digest 状态
// 注意：服务端速率控制（1 msg/s），指数退避（上限 15 分钟），最多重试 3 次

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function sendTelegram(text: string, chatId: string, token: string) {
  // 中文注释：调用 Telegram Bot API 发送消息，并做 1s 速率限制
  await sleep(1000);
  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  });
  const json = await resp.json();
  return { ok: json?.ok === true, response: json };
}

serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!; // 中文注释：仅服务端持有
    const supabase = createClient(supabaseUrl, serviceKey);

    // 中文注释：查询队列（queued 且 next_try 为空或到期），限制批量 10 条
    const { data: tasks } = await supabase
      .from('send_queue')
      .select('*')
      .eq('status', 'queued')
      .or('next_try.is.null,next_try.lte.now()')
      .limit(10);

    for (const t of tasks ?? []) {
      // 中文注释：进入处理状态，避免并发重复
      await supabase.from('send_queue').update({ status: 'processing' }).eq('id', t.id);
      try {
        const { data: digest } = await supabase.from('digests').select('*').eq('id', t.digest_id).single();
        // 中文注释：仅发送给启用且频率有效（非 off）的订阅；过滤 channel 不为 none
        const { data: subs } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', digest.user_id)
          .eq('enabled', true);

        let allOk = true;
        for (const s of subs ?? []) {
          const freq = s.frequency ?? 'daily';
          if (freq === 'off') continue;
          if (!s.channel || s.channel === 'none') continue;
          if (s.channel === 'telegram') {
            const text = `【${digest.title}】\n\n${digest.summary}\n\n退订回复 /stop`;
            const { ok, response } = await sendTelegram(text, s.target_id, telegramToken);
            await supabase.from('send_logs').insert({ digest_id: digest.id, channel: 'telegram', target: s.target_id, status: ok ? 'success' : 'failed', response });
            if (!ok) allOk = false;
          }
          // 中文注释：可扩展 WhatsApp/Twilio 等渠道
        }

        // 中文注释：队列完成与 Digest 状态更新
        await supabase.from('send_queue').update({ status: 'done' }).eq('id', t.id);
        if (allOk) await supabase.from('digests').update({ status: 'success' }).eq('id', digest.id);
      } catch (err) {
        // 中文注释：失败重试（指数退避），3 次后标记 failed
        const attempt = (t.attempt ?? 0) + 1;
        const nextTry = new Date(Date.now() + Math.min(60000 * Math.pow(2, attempt - 1), 15 * 60 * 1000)).toISOString();
        await supabase.from('send_queue').update({ attempt, status: attempt >= 3 ? 'failed' : 'queued', next_try: nextTry }).eq('id', t.id);
      }
    }

    return new Response(JSON.stringify({ ok: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: String(e?.message || e) }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  }
});
