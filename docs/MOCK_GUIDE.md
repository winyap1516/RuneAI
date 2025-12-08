# 前端 Mock 模式开发指南

本指南说明如何在脱离 Supabase 后端的情况下，使用本地 LocalStorage 模拟完整的后端服务，以进行 UI 开发与调试。

## 1. 开启 Mock 模式

在项目根目录的 `.env` 文件中设置：

```env
VITE_USE_MOCK=true
```

或者在浏览器控制台中临时强制开启（需刷新）：
```javascript
window.forceMock(true);
```

## 2. 功能特性

Mock 服务 (`src/js/services/mockService.js`) 提供以下特性：

*   **完全持久化**：所有增删改查（卡片、分类、订阅）均保存于浏览器的 `LocalStorage` / `IndexedDB`，刷新页面数据不丢失。
*   **API 兼容**：完全替代 Supabase API，前端逻辑无需修改。
*   **Seed 机制**：初次启动时自动加载 `public/mock/mock_bundle_v1` 下的 JSON 数据作为初始状态。
*   **网络模拟**：模拟网络延迟（默认 200-500ms）和随机失败（默认 10% 概率，可配置）。

## 3. 控制台调试 (Console Tools)

Mock 服务挂载了全局对象 `window.mock`，可在 Chrome DevTools 中直接调用：

### 重置数据 (Reset)
清空所有本地修改，恢复到初始 Seed 状态：
```javascript
await window.mock.reset();
// 页面数据将自动重置
```

### 调整网络模拟
修改延迟时间（毫秒）：
```javascript
window.mock.setDelay(1000); // 设置为 1秒延迟
```

修改错误率（0.0 - 1.0）：
```javascript
window.mock.setFailRate(0.5); // 50% 概率请求失败
window.mock.setFailRate(0);   // 关闭错误注入
```

查看当前配置：
```javascript
console.log(window.mock.config);
```

## 4. 目录结构与数据源

*   **Mock Service**: `src/js/services/mockService.js` (核心逻辑)
*   **Seed Data**:
    *   `public/mock/mock_bundle_v1/mock_cards.json` (默认卡片)
    *   `public/mock/mock_bundle_v1/mock_categories.json` (默认分类)

## 5. 开发注意事项

*   **Mock vs Real**: 当 `VITE_USE_MOCK=true` 时，系统会强制禁用 `linkController` 中的云端同步逻辑，确保不会意外连接到 Supabase。
*   **Auth**: Mock 模式下会自动注入一个 `local-dev` 用户，无需登录即可访问 Dashboard。
*   **Generate Now**: 模拟生成卡片，不会真正调用 AI Edge Function。

---
**Happy Coding without Backend!** 🚀
