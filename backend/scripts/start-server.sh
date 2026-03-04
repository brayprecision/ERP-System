#!/bin/bash
# BPERP Backend - Start script for NAS (Zorin OS / Linux)
# Usage: ./start-server.sh
# Or with env: DB_PATH=/home/user/bperp/bperp.db PORT=3000 ./start-server.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
cd "$BACKEND_DIR"

# Defaults - override with environment variables
export DB_PATH="${DB_PATH:-$BACKEND_DIR/bperp.db}"
export PORT="${PORT:-3000}"
export NODE_ENV="${NODE_ENV:-production}"

# Ensure .env exists or use defaults
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

echo "Starting BPERP backend..."
echo "  DB_PATH: $DB_PATH"
echo "  PORT: $PORT"
echo "  NODE_ENV: $NODE_ENV"

exec node server.js
