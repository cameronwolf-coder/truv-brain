#!/usr/bin/env bash
# truv-brain — terminal-wide activator for Truv Brain
# Install on any machine: copy to ~/bin/ and chmod +x
set -euo pipefail

BRAIN_DIR="$HOME/Downloads/Projects/truv-brain"
VENV_DIR="$BRAIN_DIR/venv"

load_env() {
  if [ -f "$BRAIN_DIR/.env" ]; then
    set -a; source "$BRAIN_DIR/.env"; set +a
  fi
}

require_venv() {
  if [ -d "$VENV_DIR" ]; then
    source "$VENV_DIR/bin/activate"
  else
    echo "No venv found. Run: truv-brain install"
    exit 1
  fi
}

usage() {
  cat <<'EOF'
truv-brain — Truv marketing automation toolkit

Commands:
  (none) / claude    Open Claude Code in truv-brain
  dev                Start web app (API + Vite on :5173/:3001)
  shell              cd + activate venv (spawns subshell)
  py <args>          Run python with venv active
  intel <cmd>        Outreach intel CLI (dormant, closed-lost, create-list)
  scout <cmd>        Truv Scout CLI
  export <platform>  Export ad data (meta|google|linkedin|all)
  test               Run pytest suite
  install            Install npm + pip dependencies
  sync               Git pull latest
  help               Show this message
EOF
}

cmd="${1:-claude}"
shift 2>/dev/null || true

case "$cmd" in
  claude)
    cd "$BRAIN_DIR" && load_env
    exec claude
    ;;
  dev)
    cd "$BRAIN_DIR" && load_env
    [ ! -d node_modules ] && npm install
    npm run dev:local
    ;;
  shell)
    cd "$BRAIN_DIR" && load_env && require_venv
    echo "truv-brain shell active (exit to return)"
    exec "$SHELL"
    ;;
  py)
    cd "$BRAIN_DIR" && load_env && require_venv
    python "$@"
    ;;
  intel)
    cd "$BRAIN_DIR" && load_env && require_venv
    python -m outreach_intel.cli "$@"
    ;;
  scout)
    cd "$BRAIN_DIR" && load_env && require_venv
    python -m truv_scout.app "$@"
    ;;
  export)
    cd "$BRAIN_DIR" && load_env && require_venv
    python -m outreach_intel.ad_exporter "$@"
    ;;
  test)
    cd "$BRAIN_DIR" && load_env && require_venv
    pytest tests/ -v "$@"
    ;;
  install)
    cd "$BRAIN_DIR"
    echo "Installing npm dependencies..."
    npm install
    if [ ! -d "$VENV_DIR" ]; then
      echo "Creating Python venv..."
      python3 -m venv "$VENV_DIR"
    fi
    source "$VENV_DIR/bin/activate"
    echo "Installing Python dependencies..."
    pip install -r requirements.txt 2>/dev/null || true
    [ -f truv-scout/requirements.txt ] && pip install -r truv-scout/requirements.txt 2>/dev/null || true
    echo "Done."
    ;;
  sync)
    cd "$BRAIN_DIR"
    git pull --rebase
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    echo "Unknown command: $cmd"
    usage
    exit 1
    ;;
esac
