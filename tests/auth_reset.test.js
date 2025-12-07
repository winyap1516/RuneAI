/* @vitest-environment jsdom */
// 中文注释：Auth Reset 单元测试（mock supabaseClient）

import { describe, it, expect, vi, beforeEach } from 'vitest';

// 中文注释：统一到 src/js 路径
vi.mock('../src/js/services/supabaseClient.js', () => {
  const auth = {
    signInWithPassword: vi.fn(async ({ email, password }) => ({ data: { user: { id: 'u1', email } }, error: null })),
    signUp: vi.fn(async ({ email, password }) => ({ data: { user: { id: 'u2', email } }, error: null })),
    signInWithOAuth: vi.fn(async () => ({ error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ data: { ok: true }, error: null })),
  };
  return { supabase: { auth } };
});

import { signIn, signUp, signInWithGoogle, sendReset } from '../src/js/views/authView.js';

describe('AuthView basic flows', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('signIn should return user', async () => {
    const data = await signIn('a@b.com', '123456');
    expect(data?.user?.email).toBe('a@b.com');
  });

  it('sendReset should return ok', async () => {
    const res = await sendReset('a@b.com');
    expect(res?.ok).toBe(true);
  });
});
