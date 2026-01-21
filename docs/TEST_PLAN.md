# 测试计划 (Test Plan)

## 1. 测试策略分级

鉴于项目处于快速迭代期，我们采用 **"关键路径优先"** 的测试策略。

### Level 1: 单元测试 (Unit Tests)
*   **对象**: `storageAdapter`, `utils/url.js`, `services/ai.js`
*   **工具**: Vitest (推荐) 或 Jest
*   **覆盖率目标**: 核心逻辑 80%+

### Level 2: 集成测试 (Integration Tests)
*   **对象**: `dashboard.js` 中的关键流程 (Generate, CRUD)
*   **工具**: 简单的手动测试脚本 (当前) -> Cypress (未来)

## 2. 关键测试用例 (Test Cases)

### 2.1 Storage Adapter
```javascript
test('addLink should generate ID and save to DB', async () => {
  const link = { url: 'https://example.com', title: 'Test' };
  const result = await storageAdapter.addLink(link);
  expect(result.id).toBeDefined();
  const stored = await storageAdapter.getLinks();
  expect(stored).toContainEqual(expect.objectContaining(link));
});
```

### 2.2 AI Service (Mock)
```javascript
test('createDigestForWebsite should handle errors gracefully', async () => {
  // Mock network failure
  vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network Error'));
  
  const website = { id: 1, url: '...' };
  await expect(ai.createDigestForWebsite(website, 'manual'))
    .rejects.toThrow('Network Error'); // 或者验证它返回了错误状态对象
});
```

### 2.3 Scheduler
*   **Case**: 设置定时任务，验证回调函数是否在指定时间后被调用。
*   **Case**: 页面不可见时，任务是否暂停/恢复（Page Visibility API）。

## 3. 手动验收清单 (Manual QA Checklist)

每次发布前需执行：

1.  **CRUD**: 新增链接 -> 编辑链接 -> 删除链接。
2.  **Generate**:
    *   单条生成 -> 检查 Cooldown -> 刷新页面 -> 检查 Cooldown 恢复。
    *   批量生成 -> 检查合并结果。
3.  **Edge Cases**:
    *   断网状态下点击生成。
    *   输入非法 URL。
    *   快速连续点击按钮（防抖/节流验证）。

## 4. 模拟环境 (Mocking)

为了测试稳定性，必须模拟以下外部依赖：
*   **IndexedDB**: 使用 `fake-indexeddb` 库在 Node 环境运行测试。
*   **Fetch/Network**: 使用 `msw` 或 `vi.mock` 拦截网络请求。
