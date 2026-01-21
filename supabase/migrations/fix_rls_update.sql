-- Phase 4: Init & RLS Fixes (Idempotent)
-- 说明：确保 links 表结构正确且允许用户 update 自己的记录（包括 ai_status）

BEGIN;

-- 1. 确保 ai_status 列存在
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'links' AND column_name = 'ai_status') THEN
        ALTER TABLE links ADD COLUMN ai_status TEXT DEFAULT 'pending';
    END IF;
    -- 新增：确保 generation_meta 列存在（用于存储 AI 生成的元信息，如模型与token统计）
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'links' AND column_name = 'generation_meta') THEN
        ALTER TABLE links ADD COLUMN generation_meta JSONB;
    END IF;
    -- 新增：确保 client_id 列存在（用于幂等 upsert）；部分旧函数可能引用该列
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'links' AND column_name = 'client_id') THEN
        ALTER TABLE links ADD COLUMN client_id TEXT;
    END IF;
END $$;

-- 2. 确保 RLS 开启
ALTER TABLE links ENABLE ROW LEVEL SECURITY;

-- 3. 确保 UPDATE 策略存在
-- 先尝试删除旧策略以防冲突（如果名称不同则可能共存，但通常我们希望覆盖）
DROP POLICY IF EXISTS "Users can update their own links" ON links;
DROP POLICY IF EXISTS "Users can delete their own links" ON links;
DROP POLICY IF EXISTS "Users can insert their own links" ON links;
DROP POLICY IF EXISTS "Users can select their own links" ON links;

-- 重新创建策略
CREATE POLICY "Users can select their own links" ON links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own links" ON links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own links" ON links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own links" ON links FOR DELETE USING (auth.uid() = user_id);

-- 4. 扩展 generation_logs 的状态枚举，支持 queued/started/success/failed（幂等执行）
DO $$
BEGIN
    -- 删除旧的 CHECK 约束（若存在）
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'generation_logs' AND constraint_type = 'CHECK' AND constraint_name = 'generation_logs_status_check'
    ) THEN
        ALTER TABLE generation_logs DROP CONSTRAINT generation_logs_status_check;
    END IF;
    -- 添加新的 CHECK 约束
    ALTER TABLE generation_logs 
        ADD CONSTRAINT generation_logs_status_check CHECK (status IN ('queued','started','success','failed'));
END $$;

-- 5. 为 links.client_id 创建唯一索引（若列存在）
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'links' AND column_name = 'client_id') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS idx_links_client_id ON links(client_id);
    END IF;
END $$;

COMMIT;
