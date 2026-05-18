#!/usr/bin/env zsh
# ─────────────────────────────────────────────────────────────
#  AES Customer Portal — full-stack starter
#
#  What it does:
#    1. Kills anything running on :8080 (backend) and :3000 (frontend)
#    2. Clears backend.log
#    3. Starts the Spring Boot backend (java -jar)
#    4. Polls :8080 until it's ready (max 90 s)
#    5. Starts the Next.js frontend (npm run dev)
#    6. Tails both logs so you can see everything in one terminal
#
#  Usage:  ./start.sh
#  Stop:   Ctrl-C  (both processes are killed automatically)
# ─────────────────────────────────────────────────────────────

set -euo pipefail

# ── paths ──────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/aes-backend"
FRONTEND_DIR="$SCRIPT_DIR/aes-frontend"
JAR="$BACKEND_DIR/target/aes-backend-1.0.0.jar"
LOGS_DIR="$SCRIPT_DIR/logs"
BACKEND_LOG="$LOGS_DIR/backend.log"
FRONTEND_LOG="$LOGS_DIR/frontend.log"
BACKEND_PORT=8080
FRONTEND_PORT=3000

# ── colours ────────────────────────────────────────────────────
RED="\033[0;31m"; GREEN="\033[0;32m"; YELLOW="\033[1;33m"
CYAN="\033[0;36m"; BOLD="\033[1m"; RESET="\033[0m"

log()  { echo "${BOLD}${CYAN}[AES]${RESET} $*"; }
ok()   { echo "${BOLD}${GREEN}[AES]${RESET} $*"; }
warn() { echo "${BOLD}${YELLOW}[AES]${RESET} $*"; }
err()  { echo "${BOLD}${RED}[AES]${RESET} $*"; }

# ── cleanup on exit ────────────────────────────────────────────
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    echo ""
    log "Shutting down…"
    [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null && ok "Frontend stopped."
    [[ -n "$BACKEND_PID"  ]] && kill "$BACKEND_PID"  2>/dev/null && ok "Backend stopped."
    exit 0
}
trap cleanup INT TERM

# ═══════════════════════════════════════════════════════════════
# 1. Kill anything already on the target ports
# ═══════════════════════════════════════════════════════════════
kill_port() {
    local port=$1
    local pids
    pids=$(lsof -ti :"$port" -sTCP:LISTEN 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
        warn "Port $port is in use (pid $pids) — killing…"
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        sleep 2
        # force-kill if still alive
        local leftover
        leftover=$(lsof -ti :"$port" -sTCP:LISTEN 2>/dev/null || true)
        [[ -n "$leftover" ]] && echo "$leftover" | xargs kill -KILL 2>/dev/null || true
        ok "Port $port is free."
    else
        ok "Port $port is free."
    fi
}

log "─── Step 1/5  Checking ports ───────────────────────────────"
kill_port $BACKEND_PORT
kill_port $FRONTEND_PORT

# ═══════════════════════════════════════════════════════════════
# 2. Clear log files
# ═══════════════════════════════════════════════════════════════
log "─── Step 2/5  Clearing log files ───────────────────────────"
mkdir -p "$LOGS_DIR"
rm -f "$BACKEND_LOG" "$FRONTEND_LOG"
ok "Log files cleared."

# ═══════════════════════════════════════════════════════════════
# 3. Start backend
# ═══════════════════════════════════════════════════════════════
log "─── Step 3/5  Starting backend ─────────────────────────────"

if [[ ! -f "$JAR" ]]; then
    warn "JAR not found — building first (this may take a minute)…"
    (cd "$BACKEND_DIR" && mvn -q -DskipTests package)
    ok "Backend built."
fi

nohup java -jar "$JAR" > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
ok "Backend started (pid $BACKEND_PID) — logging to $BACKEND_LOG"

# ═══════════════════════════════════════════════════════════════
# 4. Wait for backend to be ready
# ═══════════════════════════════════════════════════════════════
log "─── Step 4/5  Waiting for backend on :$BACKEND_PORT ────────"
MAX_WAIT=90
WAITED=0
INTERVAL=3
until lsof -i :"$BACKEND_PORT" -sTCP:LISTEN >/dev/null 2>&1; do
    if (( WAITED >= MAX_WAIT )); then
        err "Backend did not start within ${MAX_WAIT}s. Check $BACKEND_LOG"
        exit 1
    fi
    printf "  waiting… %ss\r" "$WAITED"
    sleep $INTERVAL
    (( WAITED += INTERVAL ))
done

# Extra 2 s grace so Spring finishes registering all endpoints
sleep 2
ok "Backend is up! (took ${WAITED}s)"

# ═══════════════════════════════════════════════════════════════
# 5. Start frontend
# ═══════════════════════════════════════════════════════════════
log "─── Step 5/5  Starting frontend ────────────────────────────"
(cd "$FRONTEND_DIR" && npm run dev >> "$FRONTEND_LOG" 2>&1) &
FRONTEND_PID=$!
ok "Frontend started (pid $FRONTEND_PID) — logging to $FRONTEND_LOG"

echo ""
ok "═══════════════════════════════════════════════════════════"
ok "  Backend  → http://localhost:$BACKEND_PORT"
ok "  Frontend → http://localhost:$FRONTEND_PORT"
ok "  Press Ctrl-C to stop both."
ok "═══════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════════
# Tail both logs so output is visible in the terminal
# ═══════════════════════════════════════════════════════════════
tail -F "$BACKEND_LOG" "$FRONTEND_LOG" 2>/dev/null &
TAIL_PID=$!

# Wait until either child dies, then clean up
wait $BACKEND_PID 2>/dev/null || true
wait $FRONTEND_PID 2>/dev/null || true
kill $TAIL_PID 2>/dev/null || true
