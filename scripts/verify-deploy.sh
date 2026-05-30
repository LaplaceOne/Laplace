#!/usr/bin/env bash
# Show each deployed program's ID, upgrade authority, and data length on a cluster.
# Use after deploy.sh / set-upgrade-authority.sh to confirm identity + authority.
#
# Usage: scripts/verify-deploy.sh <devnet|mainnet|localnet>
set -euo pipefail

CLUSTER="${1:?usage: verify-deploy.sh <devnet|mainnet|localnet>}"
case "$CLUSTER" in
  devnet)   URL=devnet ;;
  mainnet)  URL=mainnet-beta ;;
  localnet) URL=localhost ;;
  *) echo "error: cluster must be devnet|mainnet|localnet" >&2; exit 1 ;;
esac

export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

for P in laplace hashlock validity; do
  PID="$(solana address -k "target/deploy/$P-keypair.json")"
  echo "== $P ($PID) =="
  solana program show "$PID" --url "$URL" 2>/dev/null \
    | grep -E "Program Id|Authority|Last Deployed|Data Length|Balance" \
    || echo "  NOT DEPLOYED on $CLUSTER"
  echo
done
