🧠 Edge Functions 安全策略与部署指南

适用于 Rune AI / YinGAN OS / Supabase Edge Function 集成环境
作者：小葱 & GPT 哥
版本：v1.0 （2025-11-04）

🧩 一、当前系统架构概览

Rune AI 使用 Supabase 作为后端，Edge Functions 承担 AI 数据写入与数据库同步逻辑。
目前系统包含以下 Functions：

Function 名称	功能	安全级别	当前状态
super-endpoint	AI 自动解析网页并写入数据库	公开调用（无登录验证）	✅ 已启用
delete-link	删除链接记录（前端同步删除）	公开调用	✅ 已启用
update-link	更新记录内容（编辑同步）	公开调用	✅ 已启用
🔐 二、JWT 验证开关说明
选项位置

Supabase → Edge Functions → 某个 Function → Details > Verify JWT with legacy secret

✅ 建议状态：关闭

当前 Rune AI 为前端浏览器应用，使用 anon key 调用 Supabase API，
如果 开启 JWT 验证，浏览器发出的 fetch 请求将被 403 拦截（因为没有 token）。

所以：

✅ 开发阶段 / 公开调用接口 → 关闭 JWT 验证（OFF）

🔒 生产阶段 / 用户隔离逻辑 → 开启 JWT 验证（ON）

🧭 区别说明
状态	描述	适用场景
✅ 关闭 JWT 验证	任何前端可直接请求（CORS 控制）	浏览器端、匿名访问、展示类应用
🔒 开启 JWT 验证	需要 Bearer token 验证 (Authorization: Bearer <jwt>)	登录用户系统、私有项目、管理员操作
🌐 三、CORS （跨域）策略建议
✅ 当前配置（推荐）

在 Edge Function 顶部加上：

if (req.method === "OPTIONS") {
  return new Response("ok", {
    headers: {
      "Access-Control-Allow-Origin": "*",   // 可改为指定域名
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

规则	推荐值	说明
Access-Control-Allow-Origin	"*" 或 "http://localhost:5173"	开发阶段使用 * ，生产可限定域名
Access-Control-Allow-Headers	"Content-Type"	必填
Access-Control-Allow-Methods	"POST, GET, OPTIONS"	可选

💡 生产时建议改为：
"Access-Control-Allow-Origin": "https://runeai.app"

🧩 四、Supabase 密钥使用策略
Key 类型	用途	存放位置	安全等级
anon key	前端浏览器访问	.env 或 公开脚本	低 (可公开)
service role key	Edge Function 服务器写入	Supabase 后台环境变量	高 (绝对保密)

禁止 在 前端代码 中写入 service role key 。
Edge Function 会自动从 Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") 读取。

🧱 五、Function 安全建议模板

每个 Function 建议都包含以下安全头：

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, apikey, Authorization",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
};


并在 Response 中返回：

return new Response(JSON.stringify(result), {
  headers: { ...corsHeaders, "Content-Type": "application/json" }
});

🧩 六、后续安全升级计划 （可交给 Solo ）
阶段	内容	说明
v1.0	关闭 JWT，使用 anon key 公开 AI 接口	前端 → Edge Function → Supabase
v1.5	前端 添加 登录（Supabase Auth）	AI 解析与个人数据绑定
v2.0	开启 JWT 验证、设置 Row Level Security	用户隔离、自定义角色
v2.1	监控 Edge Functions 调用频率	防止滥用 AI 调用
🧩 七、RLS （Row Level Security）策略提醒

目前 links 表的 RLS 建议：

create policy "Public read access"
on public.links
for select
using (true);

create policy "Public write access"
on public.links
for insert
with check (true);


⚠️ 仅限匿名应用使用。
若启用 JWT 验证，需改为：

using (auth.uid() = user_id)

✅ 总结建议
项目	当前状态	建议操作
Verify JWT with legacy secret	✅ 关闭	允许前端 fetch 访问
CORS Header	✅ 已启用	保留 * 开发，生产改域名
Service Role Key 存储	✅ 安全	放在 Supabase Secret 里
RLS 策略	✅ 仅 select/insert	开发用，生产建议 auth 隔离
🧠 最后提示

Edge Function 是 AI 与 数据库 之间的“心脏”。
安全设计 = 开放调用 + 可控写入 + 可升级验证。