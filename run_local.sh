#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
  echo
  echo "stopping local type-study services..."
  jobs -pr | xargs -r kill
}

trap cleanup EXIT INT TERM

echo "starting process_input worker on http://127.0.0.1:8788"
(
  cd "$ROOT_DIR/backend/process_input"
  npm run dev:worker
) &

echo "starting normalization worker on http://127.0.0.1:8789"
(
  cd "$ROOT_DIR/backend/normalization"
  npm run dev
) &

echo "starting frontend on http://127.0.0.1:5173"
(
  cd "$ROOT_DIR"
  npm run dev
) &

echo
echo "local services are starting:"
echo "  frontend:      http://127.0.0.1:5173"
echo "  process_input: http://127.0.0.1:8788"
echo "  normalization: http://127.0.0.1:8789"
echo
echo "press Ctrl+C to stop all services"

wait
