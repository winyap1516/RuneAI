// 中文注释：Stripe Webhook 本地模拟脚本（开发/测试用）
// 用法：
// 1) 推荐使用 Stripe CLI：`stripe listen --forward-to http://localhost:<port>/functions/v1/stripe-webhook`
// 2) 或手动发送示例事件（无法通过签名校验，仅用于接口连通性）：
//    node tests/stripe_webhook_simulator.js

import http from 'http';

const payload = {
  id: 'evt_test_123',
  type: 'checkout.session.completed',
  data: {
    object: {
      metadata: { user_id: '00000000-0000-0000-0000-000000000000', plan_id: 'one-off-50' },
      payment_intent: 'pi_test_123',
      amount_total: 499,
      currency: 'usd'
    }
  }
};

const body = JSON.stringify(payload);

const req = http.request({
  method: 'POST',
  hostname: 'localhost',
  port: 54321,
  path: '/functions/v1/stripe-webhook',
  headers: {
    'Content-Type': 'application/json',
    'Stripe-Signature': 'test' // 提示：此模拟不会通过签名校验
  }
}, (res) => {
  let raw = '';
  res.on('data', c => raw += c);
  res.on('end', () => {
    console.log('status=', res.statusCode, 'body=', raw);
  });
});

req.on('error', (e) => console.error(e));
req.write(body);
req.end();

