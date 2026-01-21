# RuneAI — Subscription & Digest Specification (v1)

Version: v1.0  
Last Updated: 2025-11-29  
Author: 小葱 & GPT哥  

---

# 1. Overview
RuneAI 提供两大核心功能：

1. **Website Subscription**  
   用户可以订阅多个网站，系统自动或手动生成摘要（Digest）。

2. **AI Digest**  
   将多个订阅网站的内容组合成每日/单次的 Digest 卡片。

本规范定义 Subscription、Digest 的数据结构、UI 交互、行为流程、以及未来从 mock → Supabase 的迁移方式。

---

# 2. Data Models (LocalStorage / Mock Version)

## 2.1 Subscriptions
LocalStorage Key: `rune_subscriptions`

Structure:

[
{
"id": "sub_xxxxx", // unique id
"title": "Youtube com",
"url": "youtube.com",
"domain": "youtube.com",
"tags": ["bookmark"],
"subscribed": true, // true = 已订阅, false = 未订阅
"frequency": "daily", // 不再显示在 UI（未来迁移到 Setting 页面）
"createdAt": 1746538000
}
]

yaml
复制代码

### Notes:
- `frequency` 由用户统一在 Setting 页面调整  
- 卡片上不再显示 frequency  
- 订阅按钮只显示「Subscribe」→「Subscribed」

---

## 2.2 Digests
LocalStorage Key: `rune_digests`

[
{
"id": "digest_xxxxx",
"date": "2025-11-29",
"sites": [
{
"id": "sub_xxxxx",
"title": "Youtube com",
"url": "youtube.com",
"ai_summary": "...",
"tags": ["bookmark"]
}
],
"createdAt": 1746538200
}
]

yaml
复制代码

### Digest rules:
- 一个 Digest = 多个订阅网站的组合  
- “Generate Daily Digest” 会使用当前所有 `subscribed = true` 的网站  
- 单个网站可生成 Single Digest  

---

# 3. UI Specification

## 3.1 All Links Page
每个卡片必须包含：

### A. 当未订阅时
- Subscribe 按钮（灰色样式）
- 不显示：
  - frequency 按钮
  - Generate Digest Now 按钮
  - Unsubscribe 菜单

### B. 当已订阅时
- Subscribed 按钮（蓝紫渐变）  
- Generate Digest Now（缩小版按钮，与 Subscribe 样式一致）  
- 三点菜单包含：
  - Edit  
  - Generate Summary  
  - Unsubscribe（需要二次确认弹窗）  
  - Delete Link  

### C. 订阅逻辑
- Subscribe → subscribed = true  
- Unsubscribe → subscribed = false  
- Delete Link → 从 localStorage 永久删除  

---

## 3.2 Digest Page (List view)
每个 Digest 卡片包含：

- Digest Title: `AI Digest · YYYY-MM-DD`  
- 日期  
- Digest ID（短 SHA 样式）  
- Site count: “4 sites”  
- 右下角：Created Time  
- 点击卡片可展开进入 Detail 页面  
- 卡片必须有边框（1px #e8e8e8）和阴影（轻微）  
- 卡片大小不能太大，建议与 All Links 一致

---

## 3.3 Digest Detail Page
显示每个网站的摘要：

每个网站必须展示：

- 网站 icon  
- 网站名称  
- AI Summary 内容  
- 来源域名  
- 访问链接按钮  
- 可展开/收起 AI 原始 JSON（默认隐藏）

---

# 4. Behavior Logic

## 4.1 Generate Digest Now (Single)
触发流程：

1. 检查网站是否 subscribed  
2. 从 mockFunctions 生成 AI Summary  
3. 创建 digest_xxxxx  
4. 将 digest push 入 `rune_digests`  
5. 跳转到 Digest Detail 页面  
6. 不显示 raw JSON（默认隐藏）

---

## 4.2 Generate Daily Digest (Group)
- 使用所有 `subscribed = true` 的网站  
- 生成一个 Digest  
- Digest 内的顺序 = 按 title 排序  
- 生成后显示在 Digest 页面（顶部）

---

## 4.3 Delete Subscription or Link
- Delete Link 会影响未来的 Digest  
- 如果 Link 已被删除，Generate Digest 时不应包含它  
- Unsubscribe 仅取消简报推送，但不会删除 Link

---

# 5. Error Handling Specification

- 如果 mock 生成失败 → 显示 Toast：“生成失败，请稍后重试”  
- 如果 localStorage 数据损坏 → 自动 fallback 为空数组  
- 如果 domain 无法识别 → 使用 fallback icon  

---

# 6. Migration to Supabase (Future)
接下阶段将把以下内容迁移：

- `rune_subscriptions` → Supabase Table: `subscriptions`
- `rune_digests` → Supabase Table: `digests`
- `sites` → Supabase Table: `site_summaries`

未来 API 格式将遵守：

GET /subscriptions
POST /digest/generate
POST /digest/single
DELETE /subscription/:id

yaml
复制代码

---

# 7. Acceptance Checklist (给 Solo 的验收清单)

All Links 页面：
- [ ] 未订阅卡片不显示 frequency、Generate 按钮、Unsubscribe  
- [ ] 已订阅卡片样式一致  
- [ ] Generate Digest Now 按钮缩小为统一圆角按钮  
- [ ] Unsubscribe 在三点菜单内，需要二次确认弹窗  

Digest 页面：
- [ ] Digest 卡片变得紧凑  
- [ ] 有边框 + 微阴影  
- [ ] 显示创建时间与网站数量  
- [ ] 点击可进入 Detail  

Digest Detail：
- [ ] 网站摘要显示正确  
- [ ] AI Raw JSON 隐藏，点击才展开  

数据：
- [ ] localStorage 的 key 正确  
- [ ] 删除订阅不会再出现在 digest  

---

# 8. End
本规范为 RuneAI Digest + Subscription 系统的第一个正式版本（v1），后续会不断扩展。
