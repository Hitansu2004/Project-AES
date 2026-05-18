#!/usr/bin/env zsh
# ─────────────────────────────────────────────────────────────
#  AES Customer Portal — graceful stop
#
#  Kills whatever is listening on :8080 (backend) and :3000
#  (frontend), then confirms both ports are free.
#
#  Usage:  ./stop.sh
# ─────────────────────────────────────────────────────────────

set -euo pipefail

RED="\033[0;31m"; GREEN="\033[0;32m"; YELLOW="\033[1;33m"
CYAN="\033[0;36m"; BOLD="\033[1m"; RESET="\033[0m"

log()  { echo "${BOLD}${CYAN}[AES]${RESET} $*"; }
ok()   { echo "${BOLD}${GREEN}[AES]${RESET} $*"; }
warn() { echo "${BOLD}${YELLOW}[AES]${RESET} $*"; }
err()  { echo "${BOLD}${RED}[AES]${RESET} $*"; }

stop_port() {
    local port=$1
    local label=$2
    local pids
    pids=$(lsof -ti :"$port" -sTCP:LISTEN 2>/dev/null || true)

    if [[ -z "$pids" ]]; then
        ok "$label (:$port) — already stopped."
        return
    fi

    warn "Stopping $label (pid $pids on :$port)…"
    echo "$pids" | xargs kill -TERM 2>/dev/null || true

    # Wait up to 8 s for graceful shutdown
    local waited=0
    while lsof -i :"$port" -sTCP:LISTEN >/dev/null 2>&1; do
        if (( waited >= 8 )); then
            warn "Still alive after 8s — force killing…"
            lsof -ti :"$port" -sTCP:LISTEN 2>/dev/null | xargs kill -KILL 2>/dev/null || true
            break
        fi
        sleep 1
        (( waited++ ))
    done

    ok "$label (:$port) stopped."
}

echo ""
log "═══════════════════════════════════════════════════════════"
log "  AES Customer Portal — stopping all services"
log "═══════════════════════════════════════════════════════════"
echo ""

stop_port 8080 "Backend (Spring Boot)"
stop_port 3000 "Frontend (Next.js)"

echo ""
ok "All services stopped. Have a good one!"
echo ""
