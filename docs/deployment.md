# Laplace — Deployment & Upgrade Governance

How to deploy the three on-chain programs (`laplace`, `hashlock`, `validity`) to devnet/mainnet as
**upgradeable** programs whose upgrade authority is a **multisig**, with a path to **DAO governance**.

> Programs are deployed with the upgradeable BPF loader (the default). The *upgrade authority* — the key
> that can push new bytecode — is what governance controls. Plan: **deployer key → Squads multisig → DAO**.

## 0. Program identities (canonical, post-`anchor keys sync`)

| Program | Program ID (all clusters) | Keypair |
| --- | --- | --- |
| laplace | `5ozBamUtiAHCkiipAVL9E8v8r54HqZsHMDbkHdczpidu` | `target/deploy/laplace-keypair.json` |
| hashlock | `DNotXVWh1ifzp9MHSd5H4F78SRHptF9p8vGfMmjtuWX2` | `target/deploy/hashlock-keypair.json` |
| validity | `EQfH4VFdxcFYh8prdAsB4XwKCZiiR5uta594bfiwhLsB` | `target/deploy/validity-keypair.json` |

These match `declare_id!`, `Anchor.toml`, and `@laplace/registry`. **The program keypairs in
`target/deploy/` are the program identities — `target/` is git-ignored, so back them up offline before any
deploy.** To deploy at *different* production addresses, replace those keypair files and re-run
`anchor keys sync`, then rebuild and update `@laplace/registry`.

> The program keypair only authorizes the *initial* deploy to that address. After deploy, all upgrades are
> gated by the separate **upgrade authority** (the multisig).

## 1. Prerequisites

- Solana CLI 4.x (Agave) and Anchor CLI **1.0.2** (match `anchor-lang`; `avm install 1.0.2 && avm use 1.0.2`).
- Rust pinned by `rust-toolchain.toml` (1.89.0).
- A funded **deployer keypair** (devnet: `solana airdrop`; mainnet: ~**9 SOL** to cover the three program
  rents, each program account ≈ 2× its `.so`).
- For mainnet: a created **Squads** multisig (https://squads.so) — note its **vault PDA** address.

## 2. Reproducible build

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
anchor build            # program IDs come from target/deploy/*-keypair.json == declare_id!
# (sp1-solana is pinned to rev 4181cae… in validity/Cargo.toml; build with a frozen Cargo.lock)
```
For mainnet, produce a **verifiable build** so third parties can confirm the on-chain bytecode matches source:
`anchor build --verifiable` (Docker) or `solana-verify`. Re-audit `sp1-solana`'s `groth16_vk` before any
`rev` bump.

## 3. Deploy (upgradeable) — devnet first, then mainnet

```bash
# devnet
scripts/deploy.sh devnet  ~/.config/solana/devnet-deployer.json
# mainnet (after devnet sign-off)
scripts/deploy.sh mainnet ~/secure/laplace-mainnet-deployer.json
```
This builds and runs `solana program deploy --upgrade-authority <deployer>` for each program (upgradeable,
deployer = initial authority). Verify:
```bash
scripts/verify-deploy.sh devnet     # prints Program Id, Authority, Data Length per program
```

## 4. Record the deployed IDs in the registry

If the production IDs differ from §0, update `app/packages/registry/src/constants.ts` (`PROGRAM_IDS`) and the
per-cluster `clusters.ts`/`criteria.ts`, then `npm run build -w @laplace/registry` and re-publish. Switching
clusters/addresses is a registry edit — app code does not change.

## 5. Transfer upgrade authority to the multisig (Squads)

Create a Squads multisig and copy its **vault PDA** address, then:
```bash
scripts/set-upgrade-authority.sh devnet ~/.config/solana/devnet-deployer.json <SQUADS_VAULT_PDA>
```
This runs, per program:
```
solana program set-upgrade-authority <PROGRAM_ID> \
  --new-upgrade-authority <SQUADS_VAULT_PDA> \
  --upgrade-authority <deployer> \
  --skip-new-upgrade-authority-signer-check   # the vault is a PDA and cannot sign
```
After this, the deployer can no longer upgrade unilaterally — upgrades require multisig approval. Confirm with
`solana program show <PROGRAM_ID>` (Authority == the Squads vault).

## 6. Upgrading through the multisig

```bash
# 1. write the new bytecode to a buffer (anyone can pay)
solana program write-buffer target/deploy/laplace.so --url <cluster>      # -> <BUFFER>
# 2. hand the buffer to the multisig
solana program set-buffer-authority <BUFFER> --new-buffer-authority <SQUADS_VAULT_PDA>
```
Then in Squads, create a transaction that invokes **BPFLoaderUpgradeable `Upgrade`** (program, buffer, spill =
deployer, authority = vault); members approve to threshold; execute. The program is upgraded atomically.

## 7. Future: DAO-driven governance

Progressive decentralization — two common end states (you can do both, in order):

1. **DAO controls the multisig.** Stand up a Realms / SPL-Governance DAO (token- or NFT-weighted). Make the DAO
   the controlling member/authority of the Squads multisig, so member/threshold changes require a DAO vote.
   The multisig stays the operational upgrade authority; humans still execute, but membership is DAO-governed.
2. **DAO is the upgrade authority directly.** Transfer each program's upgrade authority from the Squads vault
   to a **governance PDA** of an SPL-Governance (Realms) instance. Upgrades then require an on-chain proposal +
   token-holder vote; the governance program executes the `Upgrade` CPI on success. Use
   `set-upgrade-authority.sh <cluster> <current> <GOVERNANCE_PDA>` for the transfer.

Recommended sequence: **deployer → Squads (m-of-n core team) → Realms DAO**. Keep the program keypairs and any
remaining authority keys in cold storage / the multisig throughout.

## 8. Pre-mainnet checklist

- [ ] Production program keypairs generated on a secure machine, backed up; `anchor keys sync` re-run; registry updated.
- [ ] anchor-cli pinned to 1.0.2; build with frozen `Cargo.lock`; `sp1-solana` rev reviewed.
- [ ] Verifiable build published; bytecode matches source.
- [ ] Deployer-funded; devnet deploy + full lifecycle exercised (see `app/packages/sdk` e2e with `LAPLACE_LOCALNET`/devnet).
- [ ] Upgrade authority transferred to the Squads multisig; deployer no longer sole authority.
- [ ] **Known protocol caveat accepted/addressed:** the hashlock criterion is *not* intent-bound — secrets must
      be unique + high-entropy, and revealing a preimage is public/front-runnable (see `criteria-registry.md`).
- [ ] Upgrade-authority/governance policy documented; DAO migration timeline set.

## 9. Scripts

- `scripts/deploy.sh <cluster> <deployer-keypair>` — build + upgradeable deploy of all three programs.
- `scripts/set-upgrade-authority.sh <cluster> <current-authority> <new-authority-pubkey>` — transfer upgrade
  authority (deployer → multisig, or multisig → DAO governance PDA).
- `scripts/verify-deploy.sh <cluster>` — show each program's ID, upgrade authority, and data length.
