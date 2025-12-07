// 中文注释：冲突处理模块（基础 UI 占位）
// 作用：在检测到服务端返回冲突时，以最小代价提示用户并收集选择（后续可扩展为弹窗合并）

/**
 * 展示冲突信息（占位实现：alert + 控制台）
 * @param {{conflict:boolean,reason:string,server_snapshot:object,client_payload:object}} c
 */
// 计算基础冲突策略
// 当 server.updated_at > local.base_server_ts 视为冲突
export function computeStrategy(serverUpdatedAt, baseServerTs) {
  try {
    const s = serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : 0;
    const b = baseServerTs ? new Date(baseServerTs).getTime() : 0;
    if (s > b) return 'server-wins';
    if (b >= s) return 'client-wins';
    return 'manual';
  } catch {
    return 'manual';
  }
}

// 字段级合并（最小实现）：按策略选择版本；可扩展为字段逐一比较
export function mergeFields(server, client, strategy = 'manual') {
  if (strategy === 'server-wins') return { ...server };
  if (strategy === 'client-wins') return { ...client };
  // manual：默认保留服务器版本并带上客户端差异（占位）
  return { ...server, _client_overlay: client };
}

// 展示冲突信息（占位实现：alert + 控制台）
export function showConflict(c) {
  try {
    console.warn('[Conflict]', c);
    const strategy = computeStrategy(c?.server_snapshot?.updated_at, c?.client_payload?.base_server_ts);
    alert(`检测到冲突：${c?.reason || 'UNKNOWN'}\n策略建议：${strategy}`);
  } catch {}
}

export default { showConflict, computeStrategy, mergeFields };
