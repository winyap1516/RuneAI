/* @vitest-environment jsdom */
// 中文注释：重发验证邮件单元测试（mock supabaseClient）

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/js/services/supabaseClient.js', () => {
  const auth = {
    resend: vi.fn(async () => ({ error: null })),
  };
  return { supabase: { auth } };
});

import { resendVerify } from '../src/js/views/authView.js';

describe('Resend verification email', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('resendVerify should return ok', async () => {
    const res = await resendVerify('a@b.com');
    expect(res?.ok).toBe(true);
  });
});
