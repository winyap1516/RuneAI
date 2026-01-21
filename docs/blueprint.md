RuneAI / YinGAN — Blueprint v1.0（正式版）

本文档为 RuneAI / YinGAN 项目的正式工程蓝图（Blueprint）。
覆盖系统架构、模块说明、数据结构、同步协议、AI 扩展、阶段开发计划与验收标准。
面向开发者、自动化智能体（solo）、维护者。

1. 项目定位（Project Overview）

RuneAI / YinGAN 是一套 本地优先（Local-First）+ 云同步（Supabase）+ AI 扩展 的个人知识系统。

目标包括：

管理内容（收藏、地点、知识库、符文）

跨设备数据同步（自动）

离线可用（PWA）

内置 AI 助理（摘要、规划、分析）

向量化（Embedding）知识检索（RAG）

自动推送（WhatsApp / Telegram）

可扩展的符文结构（Runes：多模态内容）

这套系统未来将成为 你的个人数字操作系统（Personal AI OS）。

2. 系统架构（System Architecture）
2.1 五层结构
┌──────────────────────────────┐
│  UI 层（Features / Components） │
└─────────────▲────────────────┘
              │
┌─────────────┴────────────────┐
│   应用逻辑层（Controllers）     │
└─────────────▲────────────────┘
              │
┌─────────────┴────────────────┐
│   服务层（Supabase / AI / Config） │
└─────────────▲────────────────┘
              │
┌─────────────┴────────────────┐
│   同步层（Local-First Sync）  │
└─────────────▲────────────────┘
              │
┌─────────────┴────────────────┐
│      数据层（Cache / DB）      │
└──────────────────────────────┘

2.2 前端目录结构（Final Version）
/js
  /features
  /components
  /controllers
  /sync
  /services
  /runes
/sw.js
/manifest.json
/supabase
  /functions
  /migrations
/docs
/tests

3. 核心功能模块（Modules）
3.1 UI Features
模块	文件	说明
Auth UI	auth_ui.js	登录、注册、登出、session 监听
Dashboard	dashboard.js	收藏主界面、数据呈现
Bookmark UI	bookmark_card.js	网站卡片
Knowledge UI	knowledge_ui.js	知识库卡片
Location UI	location_ui.js	地点卡片（地图扩展预留）
Settings UI	settings_ui.js	Token、Sync 状态、PWA
3.2 Controllers
控制器	文件	功能
LinkController	linkController.js	登录后启动同步、绑定 UI
DataController	dataController.js	封装 CRUD 操作，统一出口
NotificationController	notificationController.js	WhatsApp / Telegram 触发
3.3 Services
服务	文件	说明
Supabase Client	supabaseClient.js	安全初始化、Session、Edge 请求
Config	config.js	env 管理、启动验证
Logger	logger.js	全局日志
Quota	quota.js	用量控制（未来）
AI Client	aiClient.js	LLM / Embedding 调用
RAG Adapter	ragAdapter.js	向量检索封装
3.4 Sync Layer（Local-First 核心）
模块	文件	功能
Sync Agent	syncAgent.js	push/pull 队列管理
Change Log	changeLog.js	本地变更收集
Conflict Engine	conflict.js	冲突检测 & 规则
Conflict Modal	modal-conflict.js	冲突 UI 选择

该层是整个系统的“心脏”，负责跨设备数据一致性。

4. 数据模型（Data Models）
4.1 bookmarks（网址收藏）
id: uuid
owner_id: uuid
title: text
url: text
note: text
tags: text[]
created_at
updated_at

4.2 knowledge（知识库）
id
owner_id
title
content
embedding (optional)

4.3 locations（地点）
id
owner_id
name
lat
lng
metadata

4.4 runes（符文）
id
owner_id
type        # text/image/audio
payload
embedding
metadata
created_at

5. 同步系统（Sync Protocol）
5.1 push 请求结构
{
  "changes": [...],
  "client_req_id": "uuid",
  "last_pulled_at": "timestamp"
}

5.2 pull 请求结构
{
  "last_pulled_at": "timestamp"
}

5.3 响应结构（统一）
{
  "applied": [],
  "conflicts": [],
  "skipped_due_to_idempotency": []
}

5.4 冲突机制

Server version > Local version → 冲突

用户可选择：

Keep Local

Use Server

syncAgent 会根据选择重新生成变更并继续推送。

6. AI 系统（AI Engine）
6.1 aiClient

Summaries（网页/知识库）

Classification

Planning

Embedding

6.2 ragAdapter

封装：

vector-upsert（写入向量）

vector-query（搜索向量）

6.3 使用场景

智能摘要

智能搜索（Ask My Data）

行程规划

知识库整合

7. Runes 系统（Rune Engine）
7.1 Rune JSON Schema
{
  "id": "uuid",
  "type": "text/image/audio",
  "payload": {},
  "embedding": [],
  "owner_id": "uuid",
  "created_at": "timestamp"
}

7.2 Rune Engine 功能

创建符文

多模态处理（文本/图像/音频）

自动 embedding

存入数据库

参与 RAG

8. 通知系统（Notifications）
支持：

Telegram Bot API

WhatsApp Cloud API

功能：

Digest 推送

提醒通知

行程通知

部署方式：

Edge Functions + Cron 触发

9. PWA 支持（Offline First）

功能：

sw.js 缓存静态资源

离线可打开 App

数据本地可写

10. Roadmap（阶段计划）

你当前已完成：Phase 1–4
目前进行：Phase 5（Auth / Sync UI / Docs）

Phase 6 — Runes + 向量系统

Rune Engine 初版

Embedding Pipeline

vector-upsert

vector-query

Runes 在知识库中的引用

Phase 7 — AI 助理

自动摘要（Bookmarks / Knowledge）

智能问答（RAG）

行程规划（Locations）

自动分类/标签

Phase 8 — 通知系统

Telegram 推送

WhatsApp 推送

Daily digest 自动发送

Phase 9 — 用户体验升级

地图可视化

时间线视图（Timeline）

推荐系统（AI Insights）
# RuneAI (yinGAN-collector)

**RuneAI** 是一款本地优先（Local-First）的智能知识库应用，旨在帮助用户高效收藏网页、自动生成 AI 摘要（Runes），并支持按需订阅内容更新。

## 核心特性
- **本地优先**：基于 IndexedDB 构建，离线可用，通过后台 Sync Agent 实现多端数据最终一致性。
- **AI 驱动**：自动提取网页核心内容并生成结构化摘要（Rune），支持每日/每周聚合推送。
- **安全隐私**：采用 Supabase RLS（行级安全策略）确保数据隔离，敏感配额操作仅通过 Edge Functions 执行。

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 本地开发
启动前端开发服务器（支持热重载）：
```bash
npm run dev
```

### 3. 部署
项目构建产物位于 `dist/`，可直接部署至任何静态托管服务（Vercel/Netlify）。后端依赖 Supabase，请参考 `supabase/migrations` 目录初始化数据库。

## 技术栈
- **Frontend**: Vite + Vanilla JS (ES Modules)
- **Backend**: Supabase (Postgres, Edge Functions, Auth)
- **Storage**: IndexedDB (Local) + Postgres (Cloud)
11. 验收标准（Acceptance Criteria）
系统级

离线可运行（PWA）

数据跨设备稳定同步

冲突可操作

所有文档保持最新

全流程安全（Auth + RLS）

功能级

收藏系统 CRUD 完整

Locations 可记录位置并调用地图

Runes 支持文本/图片/音频

AI 可以基于 RAG 搜索回答

Digest / 提醒可通过 Telegram / WhatsApp 发送