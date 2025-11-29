🧩 RuneAI 前端任务说明：新增 Delete & Edit 同步功能
📌 背景

目前 RuneAI 的前端界面（index.html + main.js）已经具备以下能力：

可添加网页链接，并通过 Edge Function 自动生成卡片信息；

卡片能显示标题、描述、分类、标签；

数据库（Supabase links 表）自动同步新增记录。

但目前：

前端的 删除 和 编辑 功能仅更新前端 UI，未同步至数据库；

删除操作后数据库仍保留旧记录；

编辑操作后数据库未更新内容。

🧠 任务目标

让前端的 Delete 与 Edit 操作，同步调用 Supabase 的 Edge Function 实现后端更新。

⚙️ 任务拆分
🧱 1️⃣ 删除功能整合
✅ 任务内容

在 main.js 的删除函数中，添加 fetch() 调用：
调用 Supabase Edge Function：

https://<project>.supabase.co/functions/v1/delete-link


请求体格式（JSON）：

{
  "url": "https://example.com"
}


成功返回 { success: true } 时，从 UI 移除卡片。

📄 示例代码
async function deleteLink(url) {
  if (!confirm("确定要删除吗？")) return;

  const res = await fetch(`${SUPABASE_PROJECT_URL}/functions/v1/delete-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url })
  });

  const data = await res.json();
  if (data.success) {
    console.log("✅ 数据库已同步删除");
    // 从 UI 移除卡片
    document.querySelector(`[data-url="${url}"]`)?.remove();
  } else {
    console.warn("⚠️ 删除失败:", data.error);
  }
}

🧱 2️⃣ 编辑功能整合
✅ 任务内容

在 “编辑” 弹窗保存后，调用：

https://<project>.supabase.co/functions/v1/update-link


请求体格式：

{
  "url": "https://example.com",
  "title": "新标题",
  "description": "新摘要",
  "category": "新分类",
  "tags": ["AI", "Tech"]
}


成功后在前端即时更新 UI。

📄 示例代码
async function saveEdit(item) {
  const res = await fetch(`${SUPABASE_PROJECT_URL}/functions/v1/update-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item)
  });

  const data = await res.json();
  if (data.success) {
    console.log("✅ 数据库已更新");
    // 同步前端显示
    updateCardUI(item);
  } else {
    console.warn("⚠️ 更新失败:", data.error);
  }
}

⚙️ 3️⃣ 环境变量配置

在前端顶部添加以下常量：

const SUPABASE_PROJECT_URL = "https://<你的 supabase project>.supabase.co";


Edge Function 侧保持如下名称：

/functions/v1/super-endpoint → 新增

/functions/v1/delete-link → 删除

/functions/v1/update-link → 编辑

📡 测试流程

打开网页

贴入一个链接 → 自动生成卡片

点击「Edit」修改内容 → 保存 → 检查数据库是否更新

点击「Delete」删除卡片 → 检查数据库是否删除

✅ 验收标准
测试项目	预期结果
新增	数据写入 Supabase
删除	数据从 Supabase 中移除
编辑	数据更新到 Supabase
报错	提示信息准确，不影响 UI