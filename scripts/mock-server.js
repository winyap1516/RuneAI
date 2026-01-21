// 中文注释：本地 OpenAI Mock Server（无外部依赖，纯 Node HTTP）
// 作用：在本地开发与单测场景下，模拟 OpenAI Chat Completions 接口，避免暴露真实 API Key。
// 使用：`npm run mock-server` 启动，默认监听 5000 端口；Edge Functions 设置 `OPENAI_BASE_URL=http://localhost:5000/openai` 即可走本地。

const http = require('http');

// 中文注释：统一 JSON 读取（容错空 body）
function readJson(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
    });
  });
}

// 中文注释：统一返回函数
function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const { method, url } = req;
  // 中文注释：支持预检请求
  if (method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    });
    return res.end('ok');
  }

  // 中文注释：Mock 路由（兼容 OPENAI_BASE_URL=/openai 前缀）
  if (method === 'POST' && url === '/openai/v1/chat/completions') {
    const body = await readJson(req);
    const userMsg = Array.isArray(body?.messages) ? (body.messages.find(m => m.role === 'user')?.content || '') : '';
    // 中文注释：生成稳定可断言的 mock 回复（不依赖随机）
    const reply = `这是 mock 回复。输入摘要（截断）：${String(userMsg).slice(0, 48)}`;
    return json(res, 200, { id: 'mock-1', choices: [{ message: { content: reply } }] });
  }

  // 中文注释：默认 404
  json(res, 404, { error: 'NOT_FOUND', path: url, method });
});

const PORT = Number(process.env.MOCK_SERVER_PORT || 5000);
server.listen(PORT, () => {
  console.log(`Mock server listening on ${PORT}`);
});

