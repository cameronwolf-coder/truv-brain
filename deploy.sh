#!/usr/bin/env bash
# truv-brain — build and deploy to AWS App Runner via ECR
#
# Usage:
#   ./deploy.sh              # Build + push + trigger deploy
#   ./deploy.sh build        # Build only (no push)
#   ./deploy.sh push         # Push existing image
#   ./deploy.sh create       # One-time: create ECR repo + App Runner service
set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text 2>/dev/null)}"
if [ -z "$AWS_ACCOUNT_ID" ]; then
  echo "[Deploy] Error: AWS_ACCOUNT_ID not set and 'aws sts get-caller-identity' failed." >&2
  echo "[Deploy] Set AWS_ACCOUNT_ID in your environment or .env file." >&2
  exit 1
fi
AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPO="truv-brain"
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"
IMAGE_TAG="${GIT_SHA:-$(git rev-parse --short HEAD)}"
APP_RUNNER_SERVICE_NAME="truv-brain"

# ---------------------------------------------------------------------------
# Functions
# ---------------------------------------------------------------------------

ecr_login() {
  echo "[Deploy] Logging in to ECR..."
  aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
}

build() {
  echo "[Deploy] Building image (tag: ${IMAGE_TAG})..."
  docker build \
    --platform linux/amd64 \
    --build-arg GIT_SHA="${IMAGE_TAG}" \
    -t "${ECR_REPO}:latest" \
    -t "${ECR_REPO}:${IMAGE_TAG}" \
    -t "${ECR_URI}:latest" \
    -t "${ECR_URI}:${IMAGE_TAG}" \
    .
  echo "[Deploy] Build complete."
}

push() {
  ecr_login
  echo "[Deploy] Pushing to ECR..."
  docker push "${ECR_URI}:latest"
  docker push "${ECR_URI}:${IMAGE_TAG}"
  echo "[Deploy] Pushed ${ECR_URI}:${IMAGE_TAG}"
}

create_infra() {
  echo "[Deploy] Creating ECR repository..."
  aws ecr create-repository \
    --repository-name "$ECR_REPO" \
    --region "$AWS_REGION" \
    --image-scanning-configuration scanOnPush=true \
    2>/dev/null || echo "  (already exists)"

  echo "[Deploy] ECR repo ready: ${ECR_URI}"
  echo ""
  echo "Next steps:"
  echo "  1. Build and push: ./deploy.sh"
  echo "  2. Create App Runner service in AWS Console with:"
  echo "     - Source: ECR image ${ECR_URI}:latest"
  echo "     - Port: 8080"
  echo "     - Health check: GET /health"
  echo "     - Min instances: 1"
  echo "     - CPU: 1 vCPU, Memory: 2 GB"
  echo "     - Auto deploy on push: enabled"
  echo "     - Add all env vars from .env"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
CMD="${1:-all}"

case "$CMD" in
  build)
    build
    ;;
  push)
    push
    ;;
  create)
    create_infra
    ;;
  all|deploy)
    build
    push
    echo ""
    echo "[Deploy] Done. App Runner will auto-deploy from :latest."
    echo "[Deploy] Monitor: https://${AWS_REGION}.console.aws.amazon.com/apprunner/home?region=${AWS_REGION}"
    ;;
  *)
    echo "Usage: ./deploy.sh [build|push|create|all]"
    exit 1
    ;;
esac
