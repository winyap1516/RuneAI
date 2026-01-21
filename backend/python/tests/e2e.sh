#!/bin/bash
# E2E Test for YinGan Backend
# Usage: ./e2e.sh
# Requires curl. Uses simple grep for parsing to avoid jq dependency issues.

API_URL="http://localhost:8003"
USER_EMAIL="test_e2e@example.com"
TEST_URL="https://example.com/article/1"

echo "=== 1. Starting E2E Test ==="

# 1. Call Sync
echo "Sending POST /sync..."
# Windows curl sometimes has issues with JSON quoting, trying standard format
RESPONSE=$(curl -s -X POST "$API_URL/sync" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$TEST_URL\", \"user_email\": \"$USER_EMAIL\"}")

echo "Response: $RESPONSE"

# Extract Link ID
# grep for "link_id":"UUID"
LINK_ID=$(echo $RESPONSE | grep -o '"link_id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$LINK_ID" ]; then
  echo "Error: Could not get link_id from response"
  exit 1
fi

echo "Got Link ID: $LINK_ID"

# 2. Wait for Worker
echo "Waiting 5 seconds for worker..."
sleep 5

# 3. Check Result
echo "Checking status GET /links/$LINK_ID..."
RESULT=$(curl -s "$API_URL/links/$LINK_ID")
echo "Result: $RESULT"

if [[ "$RESULT" == *"AI Generated Summary"* ]]; then
  echo "✅ SUCCESS: Description found!"
  exit 0
else
  echo "❌ FAILURE: Description not found or worker failed."
  exit 1
fi
