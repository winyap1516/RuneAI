// 中文注释：Auth Fallback 集成测试（简化版，无测试框架）
// 使用方法：在浏览器控制台或本地测试 Runner 中加载该脚本，观察控制台输出。

(function () {
  const log = (...args) => console.log('[AuthFallbackTest]', ...args);

  // 模拟环境（仅当未初始化时）
  if (!window.supabaseClient) {
    log('supabaseClient 未初始化，跳过 SDK 测试');
  }

  try {
    // 1) 清空并注入一个假的 localStorage token
    const fakeToken = 'FAKE_DEV_TOKEN_0123456789abcdef';
    localStorage.setItem('supabase.auth.token', JSON.stringify({ access_token: fakeToken }));
    log('写入 localStorage token 作为兜底');

    // 2) 调用 getAuthHeaders（实际项目中从模块导入）
    // 由于该文件为静态测试样例，开发者可在页面控制台执行：
    //   import('./js/services/supabaseClient.js').then(m => m.getAuthHeaders().then(console.log))
    log('请在控制台执行：import("./js/services/supabaseClient.js").then(m => m.getAuthHeaders().then(console.log))');
  } catch (e) {
    log('测试失败：', e);
  }
})();

