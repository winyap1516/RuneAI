# Backend Migration Plan: Edge Functions to Python (FastAPI)

## 1. Overview
This document outlines the strategy to migrate the existing Supabase Edge Functions backend to a robust Python (FastAPI) service. The goal is to improve reliability, debuggability, and handle long-running AI tasks with proper state management.

## 2. Architecture Comparison

| Feature | Current (Edge Functions) | New (Python/FastAPI) |
|---------|--------------------------|----------------------|
| **Runtime** | Deno (V8) | Python 3.10+ |
| **State** | Stateless / Transient | Stateful Worker / DB Persistence |
| **Timeout** | Strict limits (e.g., 60s) | No hard limit (BackgroundTasks) |
| **DB Access**| HTTP (Supabase Client) | Direct TCP (SQLAlchemy/Psycopg2) |
| **Scaling** | Auto-scale (Serverless) | Containerized (Cloud Run / K8s) |

## 3. Deployment Strategy (Rollout)

### Phase 1: Local Development & Validation (Current Status)
- [x] Local Postgres Setup
- [x] FastAPI Core Implementation
- [x] Background Worker for AI Mock
- [x] E2E Testing Script

### Phase 2: Staging Deployment (Cloud Run + Supabase DB)
1. **Infrastructure**:
   - Create a Google Cloud Project (or AWS/Azure equivalent).
   - Set up Artifact Registry for Docker images.
   - Configure Cloud Run service.
2. **Database**:
   - Connect Cloud Run to Supabase Postgres (Production DB) using connection pooling (Supavisor is built-in to Supabase on port 6543, use Transaction Mode).
   - **Critical**: Use `DATABASE_URL` env var securely via Secrets Manager.
3. **Secrets**:
   - `OPENAI_API_KEY`: Mount as secret.
   - `DATABASE_URL`: Mount as secret.
   - `SERVICE_ROLE_KEY`: If needed for RLS bypass (use sparingly).

### Phase 3: Traffic Switch
1. Update Frontend API Client to point to new Python Backend URL (e.g., `api.yingan.com`) instead of Supabase Functions URL.
2. Keep Edge Functions running as backup/read-only if possible.
3. Monitor `generation_logs` for success rates.

## 4. Rollback Strategy
If critical failures occur (e.g., Worker crashing, DB lockups):
1. **Revert Frontend**: Point API client back to Supabase Edge Functions URL.
2. **Data Consistency**: The Schema added (`generation_logs`, `ai_status`) is additive. Old Edge Functions ignore these columns, so no DB rollback is strictly required unless data corruption occurs.
3. **Stop Worker**: Scale Cloud Run to 0.

## 5. Monitoring & Metrics
- **Logs**: Structured JSON logs (implement `python-json-logger` later).
- **APM**: Sentry for error tracking.
- **Business Metrics**:
  - `generation_logs` analysis: Success vs Failure rate.
  - Average Job Duration (start to finish).

## 6. Risks & Mitigation
- **Schema Drift**: Python models must match Supabase DB.
  - *Mitigation*: Use Alembic for migrations. Do not run `Base.metadata.create_all()` in prod.
- **Connection Limits**: Direct connections to Postgres can exhaust pool.
  - *Mitigation*: Use Supabase Transaction Pool (Port 6543) or PgBouncer.
- **Worker Loss**: `BackgroundTasks` are lost if the container crashes.
  - *Mitigation*: For high reliability, move to Celery + Redis later. Current implementation handles retries via client re-submission (idempotency checks).

## 7. Next Steps
1. **Environment**: Ensure Docker Desktop is running to start the local DB.
2. **Run**: `docker-compose up -d`
3. **Test**: `./tests/e2e.sh`
4. **Iterate**: Replace `time.sleep(2)` with actual OpenAI call.
