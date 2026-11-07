#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! curl --silent --fail --max-time 2 "http://127.0.0.1:3000/api/me" >/dev/null 2>&1; then
  nohup node codespaces-browser.mjs > /tmp/elaf-sales-hub-cloud-login.log 2>&1 < /dev/null &
fi
sleep 3
echo ""
echo "===================================="
echo "ELAF CLOUD LOGIN • Remote server"
echo "Open forwarded private port 3000."
echo "One-time PIN (do not share in chat):"
if [[ -f "$HOME/.local/share/elaf-sales-hub/one-time-code.txt" ]]; then
  cat "$HOME/.local/share/elaf-sales-hub/one-time-code.txt"
else
  echo "Server did not start. Check /tmp/elaf-sales-hub-cloud-login.log"
fi
echo "===================================="
