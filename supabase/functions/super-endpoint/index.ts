import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
serve(async (req)=>{
  // ✅ CORS 预检请求
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "content-type, apikey, authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS, GET"
      }
    });
  }
  // ✅ 健康检查与环境变量读取验证（GET 请求）
  if (req.method === "GET") {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    return new Response(JSON.stringify({ ok: true, env_has_supabase_url: Boolean(SUPABASE_URL) }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
  // 中文注释：读取请求体并校验 URL
  const { url } = await req.json();
  if (!url) {
    return new Response(JSON.stringify({
      error: "Missing URL"
    }), {
      headers: {
        "Access-Control-Allow-Origin": "*"
      },
      status: 400
    });
  }
  // ✅ 环境变量
  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  // ✅ OpenAI 调用负载（要求严格 JSON 输出）
  const payload = {
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "你是一个网页信息提取 AI，请返回 JSON 格式，包含 title、description、category、tags。"
      },
      {
        role: "user",
        content: `请分析此网页内容，并生成简洁描述：${url}`
      }
    ],
    response_format: {
      type: "json_object"
    }
  };
  
  // 中文注释：带超时与重试的请求封装
  async function requestWithRetry(input: Request | string, init: RequestInit, retries = 2, timeoutMs = 12000): Promise<Response> {
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
        await new Promise(r => setTimeout(r, 500 * (attempt + 1))); // 指数退避
      }
    }
    throw new Error("unreachable");
  }

  let parsed: { title?: string; description?: string; category?: string; tags?: string[] } = {};
  try {
    const aiResponse = await requestWithRetry("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify(payload)
    });
    const result = await aiResponse.json();
    const content = result.choices?.[0]?.message?.content || "{}";
    parsed = JSON.parse(content || "{}");
  } catch (e) {
    // 中文注释：AI 失败时返回占位数据，避免前端完全断流
    parsed = {
      title: url.replace(/^https?:\/\//, '').split('/')[0] || 'Untitled',
      description: `AI 摘要生成失败，返回占位描述。URL: ${url}`,
      category: 'All Links',
      tags: ["bookmark"]
    };
  }
  // 文本清洗与长度限制（与前端一致）：防止 XSS 与过长文本
  function sanitize(t?: string, max?: number) {
    if (!t) return '';
    // 预处理：\r\n → \n，折叠多余空白
    let s = String(t).replace(/\r\n?/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n');
    // 去除危险标签
    s = s.replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, '').replace(/<\s*iframe[\s\S]*?<\s*\/\s*iframe\s*>/gi, '');
    // 基本转义
    s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // 控制字符
    s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    return (typeof max === 'number' && s.length > max) ? s.slice(0, max) : s;
  }
  const title = sanitize(parsed.title, 200) || (url.replace(/^https?:\/\//, '').split('/')[0] || 'Untitled');
  const description = sanitize(parsed.description, 2000) || 'AI 摘要生成失败，返回占位描述。';
  const category = sanitize(parsed.category, 200) || 'All Links';
  const tags = Array.isArray(parsed.tags) ? parsed.tags.map(x => sanitize(String(x), 64)) : ["bookmark"];
  // ✅ 自动写入数据库
  const { error } = await supabase.from("links").insert([
    {
      url,
      title,
      description,
      category,
      tags
    }
  ]);
  if (error) console.error("Supabase Insert Error:", error);
  // 中文注释：统一响应结构（包含 url），由前端直接使用
  return new Response(JSON.stringify({
    data: {
      url,
      title,
      description,
      category,
      tags
    },
    error: null
  }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
});
