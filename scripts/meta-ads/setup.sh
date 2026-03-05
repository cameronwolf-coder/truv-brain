#!/bin/bash
# Meta Ads MCP - Interactive Setup
# Run: bash scripts/meta-ads/setup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

echo "=== Meta Ads MCP Setup ==="
echo ""

# Collect credentials
read -p "Paste your Meta Access Token: " META_TOKEN
read -p "Paste your App Secret: " META_SECRET
read -p "Paste your App ID (optional, Enter to skip): " META_APP_ID

if [ -z "$META_TOKEN" ] || [ -z "$META_SECRET" ]; then
    echo "ERROR: Token and App Secret are required."
    exit 1
fi

# Update .env with the new values
ENV_FILE="$PROJECT_DIR/.env"

if grep -q "META_ACCESS_TOKEN=" "$ENV_FILE" 2>/dev/null; then
    sed -i '' "s|META_ACCESS_TOKEN=.*|META_ACCESS_TOKEN=$META_TOKEN|" "$ENV_FILE"
    sed -i '' "s|META_APP_SECRET=.*|META_APP_SECRET=$META_SECRET|" "$ENV_FILE"
    echo "Updated META_ACCESS_TOKEN and META_APP_SECRET in .env"
else
    echo "" >> "$ENV_FILE"
    echo "META_ACCESS_TOKEN=$META_TOKEN" >> "$ENV_FILE"
    echo "META_APP_SECRET=$META_SECRET" >> "$ENV_FILE"
    echo "Added META_ACCESS_TOKEN and META_APP_SECRET to .env"
fi

if [ -n "$META_APP_ID" ]; then
    if grep -q "META_APP_ID=" "$ENV_FILE" 2>/dev/null; then
        sed -i '' "s|META_APP_ID=.*|META_APP_ID=$META_APP_ID|" "$ENV_FILE"
    else
        echo "META_APP_ID=$META_APP_ID" >> "$ENV_FILE"
    fi
    echo "Saved META_APP_ID to .env"
fi

echo ""

# Quick connection test
echo "Testing connection to Meta API..."
RESPONSE=$(curl -s -G -d "access_token=$META_TOKEN" "https://graph.facebook.com/v21.0/me/adaccounts?fields=name,account_id,account_status&limit=5")

if echo "$RESPONSE" | grep -q "error"; then
    echo "ERROR: Could not connect. Check your token."
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
else
    echo "CONNECTION SUCCESSFUL! Ad accounts found:"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
fi

echo ""
echo "Restart Claude Code for the MCP server to pick up the new token."
