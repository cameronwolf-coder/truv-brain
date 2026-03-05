#!/bin/bash
# Refresh Meta Ads long-lived token
# Run when token is about to expire (~every 55 days)
# Usage: bash scripts/meta-ads/refresh_token.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env"

# Read current values from .env
META_ACCESS_TOKEN=$(grep "^META_ACCESS_TOKEN=" "$ENV_FILE" | cut -d= -f2-)
META_APP_SECRET=$(grep "^META_APP_SECRET=" "$ENV_FILE" | cut -d= -f2-)
META_APP_ID=$(grep "^META_APP_ID=" "$ENV_FILE" | cut -d= -f2-)

if [ -z "$META_ACCESS_TOKEN" ] || [ -z "$META_APP_ID" ] || [ -z "$META_APP_SECRET" ]; then
    echo "ERROR: Missing META_ACCESS_TOKEN, META_APP_ID, or META_APP_SECRET in .env"
    echo "Run setup first: bash scripts/meta-ads/setup.sh"
    exit 1
fi

echo "Refreshing Meta Ads token..."

RESPONSE=$(curl -s "https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=$META_APP_ID&client_secret=$META_APP_SECRET&fb_exchange_token=$META_ACCESS_TOKEN")

NEW_TOKEN=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)
EXPIRES=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('expires_in',''))" 2>/dev/null)

if [ -z "$NEW_TOKEN" ]; then
    echo "ERROR: Could not refresh token."
    echo "Response: $RESPONSE"
    echo ""
    echo "Generate a new token from: https://developers.facebook.com/tools/explorer/"
    echo "Then run: bash scripts/meta-ads/setup.sh"
    exit 1
fi

DAYS=$((EXPIRES / 86400))

# Update .env
sed -i '' "s|META_ACCESS_TOKEN=.*|META_ACCESS_TOKEN=$NEW_TOKEN|" "$ENV_FILE"

echo "Token refreshed successfully! Expires in ~$DAYS days."
echo "Restart Claude Code for the new token to take effect."
