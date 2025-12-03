# Phase 5 Pre-Merge Safety Checklist
# Run this before merging phase5/5.2/auto-merge-and-tombstone

# 1. Backup Database
echo "📦 Backing up Database..."
# Note: Adjust PGPASSWORD/PGUSER/PGDB as per your env
# PGPASSWORD=postgres pg_dump -h 127.0.0.1 -p 65432 -U postgres -d postgres -F c -b -v -f "./devops/audit/phase5/pre_merge_backup.dump"

# 2. Secret Scan
echo "🛡️ Scanning for secrets..."
# grep -r "service_role" . --exclude-dir=node_modules --exclude-dir=.git
# (Should return empty or only in .env.example / comments)

# 3. Verify Phase 4 Baseline
echo "✅ Verifying Phase 4 Baseline..."
node scripts/verify_phase4.js

echo "Ready to merge if above checks pass."
