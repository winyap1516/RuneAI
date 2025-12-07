RuneAI｜核心功能 PRD（v0 系列）
0. 愿景 & 目标

让用户把网页、地址、文件与灵感收进个人空间，形成“可被 AI 使用的素材池”。

AI 小助理在私人空间内，基于用户收藏与知识库，自动做规划（行程/待办）与产出（日报/摘要/创作）。

“符文卡片”把重要内容固化为结构化 JSON，可复用、可检索、可溯源。

1. 范围（Scope）
v0.1（MVP：先把“壳”跑通）

收藏系统（网页/地点）：新增、编辑、分类、标签、搜索、导出/导入 JSON。

Dashboard：卡片列表、侧边栏分类、搜索框、顶部欢迎区、右上角用户菜单。

用户系统外壳：登录/注册/登出（前端本地存储）、资料与偏好（语言/主题/AI语气）。

多语言：中文 / English / Bahasa Melayu。

数据持久化：localStorage（先不接后端）。

v0.2（AI 助理基础）

基于“当前筛选的收藏”生成：①旅行行程草案（日期/时段/路线），②日报/周报（摘要、洞见、待办）。

卡片操作区新增按钮：Plan Trip、Daily Digest，调用 Mock AI（后续接真实 API）。

结果以可编辑卡片呈现，可一键保存为“符文卡片”。

v0.3（符文 & 私人知识库）

符文卡片：固定化记录（结构化 JSON），支持标签/关系（引用哪些收藏/文件）。

知识库：登记 PDF/Doc/表格等文件（先 URL 登记，后续接上传解析）。

AI 可“读取已保存的符文与知识库元数据”进行创作（先 Mock，后接 API）。

Out of scope（本期不做）：在线爬取全文解析、多人协作、权限系统、真后端/向量库、地图导航/POI 搜索。

2. 信息架构（IA / 导航）

Links（默认页）

All Links / 自定义分类

AI Features

AI Digest（日报/周报）

Chat / AI Assistant（后续）

Runes（v0.3）

All Runes / 类型筛选

Knowledge（v0.3）

Files / Sources

User

Profile / Settings

3. 数据模型（前端本地存储，v0.x）

所有数据暂存 localStorage，键名约定见下。

3.1 收藏项（网页/地点统一为 Bookmark）

localStorage.key = "linkData"

{
  "id": 1730959200000,
  "type": "web|place",
  "title": "OpenAI",
  "url": "https://openai.com",
  "desc": "自动摘要或手填",
  "category": "AI Research",
  "tags": ["ai","research"],
  "place": {
    "address": "Jalan ...",
    "city": "Kuala Lumpur",
    "geo": {"lat": 3.139, "lng": 101.686},
    "open_hours": ""
  },
  "created_at": "2025-11-07T10:00:00Z",
  "source": "manual|ai"
}

3.2 分类

localStorage.key = "categories"
["All Links","AI Research","Travel","Food"]

3.3 符文卡片（v0.3）

localStorage.key = "runes"

{
  "rune_id": "r-1730959",
  "name": "KL One-day Trip Plan",
  "type": "itinerary|summary|idea|note",
  "description": "吉隆坡一日游行程草案",
  "links_ref": ["1730959200000"], 
  "kb_ref": ["file-001"],
  "content": { "md": "..." , "json": {} },
  "tags": ["travel","kl"],
  "created_at": "2025-11-07T10:20:00Z"
}

3.4 知识库文件（v0.3）

localStorage.key = "kbFiles"

{
  "file_id": "file-001",
  "name": "Cafe List.xlsx",
  "type": "excel",
  "url": "https://.../cafe.xlsx",
  "size": 123456,
  "tags": ["food","KL"],
  "created_at": "2025-11-07T10:10:00Z"
}

3.5 用户与偏好

localStorage.key = "user"

{
  "id": "u-001",
  "email": "user@ex.com",
  "nickname": "小葱",
  "avatar": "",
  "language": "zh",
  "theme": "light|dark|auto",
  "aiStyle": "professional|casual|creative",
  "rememberMe": true,
  "autoLogoutMinutes": 0,
  "lastLoginAt": "2025-11-07T10:00:00Z"
}

4. 核心流程（必须打通）
4.1 收藏流程（网页/地点）

点击 + Add Link → 弹窗输入 URL（或选择“添加地点”切换到地址模式）。

选择分类、标签（可新建）。

保存后卡片插入列表顶部；侧边栏分类同步更新。

支持编辑、移动分类、删除、导出 JSON、导入 JSON。

验收：

URL 与地点都可保存；搜索按标题/标签/分类生效。

去重：相同域名/同一地点避免重复提示。

刷新后数据仍在。

4.2 AI 助理：行程 & 日报（v0.2）

入口 A：顶部 AI Digest；入口 B：卡片列表上方 Plan Trip / Daily Digest 按钮。

读取“当前筛选集”（分类 + 关键词 + 选中卡片）。

Mock AI 生成结果：

行程模板：日期 -> 时段 -> 地点 -> 交通/预算/备注

日报模板：摘要 -> 亮点 -> 待办 -> 风险

预览卡片可编辑；一键保存为“符文卡片”。

验收：

未选择卡片时，默认使用当前分类内的前 N 条。

生成过程有 loading、失败兜底、可重试。

成功后保存为符文卡片；符文页可见。

4.3 符文 & 知识库（v0.3）

保存符文：从 AI 结果或手动创建，填写名称/类型/标签，关联引用的收藏与文件。

知识库登记：录入文件名称、类型、URL（先不做真实上传）。

AI 创作（Mock）：从指定符文 + 文件清单生成一段内容（摘要/大纲/清单）。

验收：

符文可检索/筛选；可查看其引用关系。

知识库能新增/编辑/删除；刷新后存在。

5. 文案与多语言（最低覆盖）

登录/注册/登出、保存/取消、添加/编辑/删除、导入/导出、设置、语言、主题、AI 风格、行程、日报、符文、知识库、标签、分类、搜索占位提示……

放置 /languages/zh.json / en.json / ms.json，所有界面文本通过 data-i18n 绑定。

6. 非功能 & 隐私

个人空间默认私有；本地开发不上传任何密钥与私密数据。

主题与语言即时切换；移动端布局正常；核心路径无控制台错误。

未来引入 API/Edge 时，AI 密钥仅在服务端保存。

7. 成功标准（v0 系列）

用户可把网页/地点收进来、整理好（分类/标签/搜索），并导出/导入 JSON。

一键得到行程草案或日报（Mock 也行），并保存为符文卡片。

可以把文件登记进知识库，并在符文中引用它们。

刷新页面后，所有内容保持；无主要报错。

8. 风险与后续

URL 解析/地图定位暂用“手填 + 简单校验”；后续接地图 API。

AI 结果质量依赖素材与提示词；后续由后端统一封装。

文件解析（PDF/Excel）放在 v1 接向量库与解析管线。

9. 版本路线图

v0.1：收藏系统 + 用户与偏好 + 导入/导出 + Dashboard

v0.2：AI 助理（行程/日报）+ 保存为符文

v0.3：符文中心 + 知识库（文件登记）+ AI 创作（Mock）

v1.0：后端 API（Auth/存储/向量检索）+ 真解析 + 多设备同步

10. 当前迭代给 Solo 的任务清单（v0.1）

 Links：新增/编辑/删除/分类/标签/搜索/导出/导入

 Sidebar：分类管理（新增/重命名/删除）、高亮当前项

 Dashboard：顶部欢迎区、右上角菜单（Profile/Settings/Logout）

 用户外壳：登录/注册 Modal、资料与偏好（本地存储）

 多语言：三语词包与 data-i18n 绑定（≥20 词条）

 Mock AI 入口位（按钮 + Loading/失败态，占位回调）

导入/导出要求：

导出当前“收藏（linkData）/分类（categories）/符文（runes）/知识库（kbFiles）”为单个 JSON。

导入时合并数据并去重（以主键 id / 域名 / file_id 为基准）。