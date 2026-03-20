#!/usr/bin/env bash
# Start Truv Brain — run from anywhere
set -e

BRAIN_DIR="/Users/cameronwolf/Downloads/Projects/truv-brain"

cd "$BRAIN_DIR"

# Load environment variables
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Activate Python venv (for outreach_intel CLI in same terminal)
if [ -f venv/bin/activate ]; then
  source venv/bin/activate
fi

# Install deps if needed
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

# Start Vercel dev (frontend + API routes)
echo "Starting Truv Brain at http://localhost:3000"
vercel dev
