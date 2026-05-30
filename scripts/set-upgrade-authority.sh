#!/usr/bin/env bash
# Transfer the upgrade authority of all three programs to a new authority — e.g. a Squads multisig
# vault PDA (deployer -> multisig), or later a Realms/SPL-Governance PDA (multisig -> DAO).
# The new authority is a PDA and cannot sign, hence --skip-new-upgrade-authority-signer-check.
#
# Usage: scripts/set-upgrade-authority.sh <devnet|mainnet|localnet> <current-authority.json> <new-authority-pubkey>
set -euo pipefail

CLUSTER="${1:?usage: set-upgrade-authority.sh <cluster> <current-authority.json> <new-authority-pubkey>}"
CURRENT="${2:?keypair of the CURRENT upgrade authority}"
NEW="${3:?pubkey of the NEW upgrade authority (e.g. Squads vault PDA or governance PDA)}"
case "$CLUSTER" in
  devnet)   URL=devnet ;;
  mainnet)  URL=mainnet-beta ;;
  localnet) URL=localhost ;;
  *) echo "error: cluster must be devnet|mainnet|localnet" >&2; exit 1 ;;
esac

export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

echo "!! Transferring upgrade authority of laplace/hashlock/validity to $NEW on $CLUSTER."
echo "!! After this, $CURRENT can no longer upgrade alone. Ctrl-C within 5s to abort."
sleep 5
for P in laplace hashlock validity; do
  PID="$(solana address -k "target/deploy/$P-keypair.json")"
  echo ">> $P ($PID): upgrade authority -> $NEW"
  solana program set-upgrade-authority "$PID" \
    --new-upgrade-authority "$NEW" \
    --upgrade-authority "$CURRENT" \
    --skip-new-upgrade-authority-signer-check \
    --url "$URL" \
    --keypair "$CURRENT"
done
echo ">> Done. Confirm with: scripts/verify-deploy.sh $CLUSTER  (Authority should be $NEW)"
