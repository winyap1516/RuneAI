-- 中文注释：扩展 subscriptions 表以支持频道、目标ID、同意时间与更丰富的频率选项
-- 需求：
-- - channel：Telegram / WhatsApp / None
-- - target_id：Chat ID 或 Phone
-- - consent_time：开启订阅的时间戳
-- - frequency：Daily / Off （未来支持 Hourly、Weekly）

DO $$ BEGIN
  ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_frequency_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS target_id text,
  ADD COLUMN IF NOT EXISTS consent_time timestamptz;

-- 统一频率校验约束（包含 off/hourly/weekly）
DO $$ BEGIN
  ALTER TABLE public.subscriptions ADD CONSTRAINT subs_frequency_valid CHECK (frequency IN ('daily','off','hourly','weekly'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 默认值调整（不强制写默认，交由应用层控制）；如需默认 off：
-- ALTER TABLE public.subscriptions ALTER COLUMN frequency SET DEFAULT 'off';

-- 可选索引优化：按用户+enabled 查询
CREATE INDEX IF NOT EXISTS subs_user_enabled_idx ON public.subscriptions(user_id, enabled);
