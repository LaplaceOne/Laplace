#!/usr/bin/env bash
# Build + deploy the Laplace programs (UPGRADEABLE) to a cluster, with the deployer as the initial
# upgrade authority. Transfer authority to a multisig afterwards via set-upgrade-authority.sh.
#
# Usage: scripts/deploy.sh <devnet|mainnet|localnet> <deployer-keypair.json>
set -euo pipefail

CLUSTER="${1:?usage: deploy.sh <devnet|mainnet|localnet> <deployer-keypair.json>}"
DEPLOYER="${2:?path to the funded deployer keypair}"
case "$CLUSTER" in
  devnet)   URL=devnet ;;
  mainnet)  URL=mainnet-beta ;;
  localnet) URL=localhost ;;
  *) echo "error: cluster must be devnet|mainnet|localnet" >&2; exit 1 ;;
esac

export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

echo ">> Building programs (program IDs come from target/deploy/*-keypair.json, must equal declare_id!)…"
anchor build

for P in laplace hashlock validity; do
  PID="$(solana address -k "target/deploy/$P-keypair.json")"
  echo ">> Deploying $P ($PID) to $CLUSTER (upgrade authority = deployer)…"
  solana program deploy "target/deploy/$P.so" \
    --program-id "target/deploy/$P-keypair.json" \
    --upgrade-authority "$DEPLOYER" \
    --url "$URL" \
    --keypair "$DEPLOYER"
done

echo ">> Done. Verify:    scripts/verify-deploy.sh $CLUSTER"
echo ">> Next (multisig): scripts/set-upgrade-authority.sh $CLUSTER $DEPLOYER <SQUADS_VAULT_PDA>"
