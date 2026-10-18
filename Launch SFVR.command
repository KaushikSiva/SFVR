#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
sf_strike_node="$(command -v node || true)"
if [ -z "$sf_strike_node" ]; then sf_strike_node="/opt/homebrew/bin/node"; fi
if [ ! -x "$sf_strike_node" ]; then
  echo "Node.js is required. Install Node.js, then open this launcher again."
  read -r -p "Press Enter to close."
  exit 1
fi
"$sf_strike_node" scripts/start-headset.mjs
