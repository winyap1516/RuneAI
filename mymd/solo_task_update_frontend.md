🧩 Solo 任务说明：前端改造方案（接入 Supabase Function）
🎯 目标

当前前端 main.js 直接用 supabase.from('links').insert() 写数据库，
现在要改成通过 Supabase Edge Function（super-endpoint） 调用后端，由后端写入数据库。

🔧 主要修改内容
1️⃣ 移除或注释掉以下函数：
// 不再直接调用数据库
saveLinkToSupabase()
syncLocalCache()


这些逻辑由 Edge Function 完成。
保留 cacheToLocal() 作为离线备用。

2️⃣ 修改 AI 调用逻辑

在 callSupabaseAI() 函数中，只需要调用 Function：

const res = await fetch(`${SUPABASE_PROJECT_URL}/functions/v1/super-endpoint`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ url })
});


✅ 不要带上 Authorization 或 apikey
因为小葱已关闭 JWT 验证，允许匿名访问。

3️⃣ 调整按钮事件逻辑

在 saveLinkBtn 的点击事件中：

保留原本的输入校验、UI 状态、渲染逻辑；

调用 Function 获取结果；

移除直接插入数据库的部分。

最终逻辑应是：

const data = await callSupabaseAI(normalized);
const newItem = {
  id: Date.now(),
  url: normalized,
  title: data.title,
  description: data.description,
  category: data.category,
  tags: data.tags || []
};

// 本地渲染
linkData.unshift(newItem);
saveLinks();
renderCards();

// 不再执行 supabase.insert()

4️⃣ 添加测试功能（可选）

在页面底部添加一个按钮：

<button id="testFunctionBtn">Test Edge Function</button>


在 JS 中加上：

document.getElementById("testFunctionBtn").addEventListener("click", async () => {
  const testUrl = "https://openai.com";
  const res = await fetch(`${SUPABASE_PROJECT_URL}/functions/v1/super-endpoint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: testUrl })
  });
  const data = await res.json();
  console.log("Function 测试返回:", data);
  alert("✅ Function 调用成功（见控制台）");
});


用于验证 Function 是否通畅。

5️⃣ 确认文件结构

最终文件结构保持不变：

index.html
main.js


只需确保以下变量已正确定义：

const SUPABASE_PROJECT_URL = "https://oxtmsuxtlpbkzunumyou.supabase.co";
const SUPABASE_FUNCTION_URL = `${SUPABASE_PROJECT_URL}/functions/v1/super-endpoint`;

✅ 验收标准

点击 “Add Link” 输入网址后，Function 可返回 AI 生成结果；

页面可正常渲染新卡片；

控制台日志中显示：

[AI] 成功返回：{ title: ..., description: ... }


数据能在 Supabase 数据表中看到；

无跨域（CORS）或 401 报错。

📎 附加说明

Edge Function 已由小葱配置完成；

JWT 验证关闭，允许匿名调用；

Solo 无需修改 Supabase 控制台；

专注于前端逻辑调整与调试。