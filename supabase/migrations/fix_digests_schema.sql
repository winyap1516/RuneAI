-- Phase 4: Fix Digests Schema
-- 说明：补全 digests 表缺失字段，使其与 Edge Function 及业务逻辑对齐

-- 1. 添加缺失列
DO $$
BEGIN
    -- summary: 摘要内容 (text)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'digests' AND column_name = 'summary') THEN
        ALTER TABLE public.digests ADD COLUMN summary TEXT;
    END IF;

    -- website_id: 关联的网站ID (uuid, 可空)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'digests' AND column_name = 'website_id') THEN
        ALTER TABLE public.digests ADD COLUMN website_id UUID;
    END IF;

    -- title: 标题 (text) -> 其实 Edge Function 用的是 metadata->>title，但如果有专用列更好，这里暂时把 metadata 作为 JSONB 确保存在
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'digests' AND column_name = 'metadata') THEN
        ALTER TABLE public.digests ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- status: 状态 (text)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'digests' AND column_name = 'status') THEN
        ALTER TABLE public.digests ADD COLUMN status TEXT DEFAULT 'created';
    END IF;
END $$;

-- 2. 确保索引存在
CREATE INDEX IF NOT EXISTS digests_website_idx ON public.digests(website_id);
