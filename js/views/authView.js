// 中文注释：认证视图纯函数封装（便于单元测试）
// 作用：提供登录/注册/Google 登录/发送重置邮件的简化接口，内部使用统一的 supabase 客户端

import { supabase } from '../services/supabaseClient.js';
import config from '../services/config.js';

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${config.frontendBaseUrl}/login.html` } });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle() {
  // 中文注释：统一 OAuth 重定向路径为 Dashboard（使用前端基址）
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${config.frontendBaseUrl}/dashboard.html` } });
  if (error) throw error;
}

export async function sendReset(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${config.frontendBaseUrl}/reset-password.html` });
  if (error) throw error;
  return data;
}

// 中文注释：重发邮箱验证邮件（注册验证）
// 作用：当用户未验证邮箱需要购买/生成等操作时，提供快速重发入口
export async function resendVerify(email) {
  const { error } = await supabase.auth.resend({ type: 'signup', email, options: { redirectTo: `${config.frontendBaseUrl}/dashboard.html` } });
  if (error) throw error;
  return { ok: true };
}

export default { signIn, signUp, signInWithGoogle, sendReset, resendVerify };
