🧩 RuneAI 蓝图：用户系统模块（v0.1 前端结构）
🪪 一、用户注册与登录系统

目标：
为用户提供基础身份体系，允许登录平台、保存偏好与数据。

1. 注册方式

📧 邮箱注册：输入邮箱、密码、确认密码。

🌐 第三方注册：支持 Google / GitHub / Apple 登录（未来阶段）。

🈯 语言可选：注册页支持中 / 英 / 马来语言切换（右上角语言按钮）。

2. 登录逻辑

用户输入邮箱 + 密码登录。

“记住我”选项（保存登录状态）。

登录成功后跳转至「主页 / 收藏夹」。

登录失败弹出错误提示（统一样式 Modal）。

3. 忘记密码

通过邮箱验证重设密码。

显示 3 步流程：输入邮箱 → 验证码 → 重设密码。

未来可扩展为 2FA 登录保护。

4. 注册后自动创建空间

注册成功后自动生成：

“我的收藏夹”

“AI 助手设置面板”

可选择是否导览平台功能（可跳过）。

🧑‍💼 二、用户资料与个性设置

目标：
提供个性化界面、视觉主题与交互偏好设定。

1. 资料编辑区

编辑头像（支持上传图片）。

修改昵称、简介。

预览个人资料卡（左侧展示区，右侧编辑区）。

2. 界面与语言设置

语言选择：中文 / English / Bahasa Melayu。

主题模式：浅色 / 深色 / 自动。

时间格式：12h / 24h。

字体大小调整（未来可扩展）。

3. AI 助手风格设置

可选语气风格：

「正式模式」：简洁、商务风格。

「轻松模式」：亲切、有表情符号。

「创意模式」：富有想象力，适合符文创作。

设置即时保存（可通过前端本地存储模拟）。

4. 安全与隐私设置

开关项：

「启用两步验证」（未来阶段）

「隐藏公开资料」

「删除账号」（弹窗二次确认）

密码修改区（当前密码 + 新密码 + 确认密码）

🧭 三、用户主页 / 仪表盘（Dashboard）

目标：
展示用户状态、收藏与 AI 助手摘要。

1. 用户欢迎区

显示问候语（根据时间变化，如 “早安，小葱 🌅”）。

显示登录状态 / 上次登录时间。

2. 收藏夹预览

最近收藏的网页 / 符文卡片缩略图。

支持「查看更多」跳转至收藏管理页。

3. AI 助手概览

展示当前语气风格 + 模型版本。

提供“前往聊天区”按钮。



🧩 RuneAI 用户系统模块前端蓝图（Solo 任务专用）
🎯 模块目标

在保持现有 RuneAI 前端风格的基础上（Sidebar + Dashboard 结构），
新增与完善 用户系统功能 的前端页面与按钮逻辑，
为未来接入 AI Agent 与 Supabase 账户系统打下基础。

⚙️ 注意：本任务只需完成前端层的界面、交互与本地存储逻辑（localStorage），不需要真实后端。

🧱 一、推荐目录结构

保留当前项目架构，在其中新增以下文件夹与模块文件：

runeai/
├── index.html                  # 主入口 (Dashboard)
├── landing.html                # (未来) 项目展示页
├── js/
│   ├── auth.js                 # 登录 / 注册 / 登出逻辑
│   ├── profile.js              # 用户资料编辑逻辑
│   ├── settings.js             # 偏好设置逻辑
│   ├── dashboard.js            # 主界面动态加载
│   ├── aiStyle.js              # AI 助手语气切换
│   └── language.js             # 多语言系统
├── components/
│   ├── modal_login.html        # 登录弹窗
│   ├── modal_signup.html       # 注册弹窗
│   ├── profile_form.html       # 用户资料编辑区
│   ├── settings_panel.html     # 偏好设置界面
│   └── card_userinfo.html      # 用户信息卡片（Dashboard 顶部问候）
├── languages/
│   ├── zh.json
│   ├── en.json
│   └── ms.json
└── style/
    ├── theme-light.css
    ├── theme-dark.css
    └── components.css


✅ 保持原始UI风格（浅灰背景、圆角卡片、简洁留白）
✅ Sidebar 与顶部导航不变
✅ 所有新组件需采用相同视觉语言

🧭 二、用户系统模块功能说明
1. 登录 / 注册模块（auth.js）

目标：
允许用户以 Email 注册或登录系统，并在前端保存状态。

UI设计：

弹窗式登录/注册（Modal）或独立页

支持中 / 英 / 马来三语言

包含输入框：邮箱、密码、确认密码（注册用）

登入后右上角显示头像 + 用户名

按钮逻辑：

[Login] → validateInput() → mockLogin() → localStorage.setUser()
[Register] → validateInput() → mockRegister() → localStorage.setUser()
[Logout] → clearLocalStorage() → reloadDashboard()


localStorage示例：

{
  "user": {
    "id": "uuid",
    "name": "Wen Cong",
    "email": "winyap1516@icloud.com",
    "language": "zh",
    "theme": "light",
    "aiStyle": "creative"
  }
}

2. 用户资料模块（profile.js）

目标：
允许用户修改个人资料（头像、昵称、简介等）。

UI：

独立卡片式表单（放在 Settings → Profile Tab）

可即时预览头像上传效果

字段定义：

字段	类型	说明
avatar	file	用户头像上传
nickname	text	用户昵称
bio	textarea	个人简介
email	readonly	邮箱（注册时填写）

逻辑：

修改后点 Save → 更新 localStorage

修改状态时显示右上角浮动提示「未保存更改」

3. 偏好设置模块（settings.js）

目标：
让用户自定义界面语言、主题、AI语气风格与账号安全选项。

UI结构：
分为四个子区块：

区块	功能	控件类型
🌐 语言 Language	中 / 英 / 马	下拉框
🎨 主题 Theme	浅色 / 深色 / 自动	单选组
🤖 AI 助手风格	正式 / 轻松 / 创意	单选组
🔒 安全 Security	登出 / 删除账号	按钮区

逻辑：

每项变更即时更新到 localStorage

[Logout] 清空 localStorage 并回到登录页

4. 仪表盘增强（dashboard.js）

目标：
在当前 Dashboard 顶部显示用户信息与欢迎语。

新增区块：

👋 早安，小葱 🌅
上次登录：2025年11月7日 19:00
AI 助手模式：创意 🎨


逻辑：

初始化时检测 localStorage 是否存在用户数据

若无 → 自动弹出登录Modal

若有 → 载入用户名、头像、风格偏好

右上角头像点击 → Dropdown：Profile / Settings / Logout

5. 多语言系统（language.js）

目标：
支持三语言界面切换。

结构：
/languages/*.json
示例（zh.json）：

{
  "login": "登录",
  "logout": "登出",
  "welcome": "欢迎回来",
  "settings": "设置"
}


逻辑：

用户切换语言 → 立即更新全局 UI 文本

所选语言同步存储于 localStorage

💡 三、交互与风格要求

所有新组件延续当前 UI 风格（如 Add Link 按钮、Link Card 样式）

采用一致的圆角、间距、阴影层级

交互反馈：Hover 动效 + Save 按钮渐变

所有按钮与输入框使用统一 class 规范（如 btn-primary, input-field）

🧩 四、Solo 执行任务表
阶段	任务	文件	状态
Step 1	登录注册模块	auth.js, modal_login.html, modal_signup.html	☐
Step 2	用户资料页	profile.js, profile_form.html	☐
Step 3	偏好设置页	settings.js, settings_panel.html	☐
Step 4	Dashboard 欢迎区	dashboard.js, card_userinfo.html	☐
Step 5	多语言系统	language.js, /languages/*.json	☐
Step 6	界面统一风格与按钮逻辑	所有前端文件	☐
🚀 五、后续阶段（暂不执行）

接入 Supabase Auth 替换 mockLogin

将用户设置写入数据库

AI 助手模块接入（语气风格同步）

AI Digest 每日摘要功能

✅ 最终目标交付标准

用户能在前端完成 登录、注册、登出、资料修改、设置保存；

页面在无后端支持的情况下能稳定运行；

所有交互逻辑可独立测试；

风格与现有 Dashboard 完全一致；

全部用户偏好保存于 localStorage。