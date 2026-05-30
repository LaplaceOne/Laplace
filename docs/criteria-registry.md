# Laplace — Criteria & Registry Model

How the front-ends know which criteria exist, where they live per cluster, and
how a criterion is *configured and registered* (not authored). Reflects the
current code: the Laplace core does **not** whitelist criteria, and **no on-chain
registry program exists yet**.

## 1. Three layers of "criterion"

1. **Criterion program** — an on-chain program implementing the
   `verify_criterion` interface. Authored and deployed out-of-band (CLI/SDK), not
   by any website. Official today: `hashlock`, `validity`.
2. **Criterion configuration** — per-use parameters committed by the intent.
   - hashlock: just the hashlock value (`criterion_data_hash = sha256(secret)`);
     **stateless**, no on-chain config account.
   - validity: a **stateful** `ValidityConfig` account (`guest_elf_hash`,
     `sp1_vkey_hash`, `fixed_public_inputs`) at PDA `[VALIDITY_SEED, config_hash]`;
     the intent's `criterion_data_hash = config_hash`.
3. **Registry entry** — front-end metadata that maps a criterion to its program
   IDs per cluster plus display/UX info. Lives off-chain in `@laplace/registry`.

## 2. The interface every criterion implements

The core forwards a canonical request by CPI and releases escrow only if the CPI
succeeds. Criteria must honor:

```
instruction discriminator = first 8 bytes of sha256("global:verify_criterion")
                           = 8c 7b 8b 85 67 d5 72 ab
interface version          = 2
max fulfillment data       = 1024 bytes
```

Request payload (security boundary — criteria must bind these to prevent cross-
intent replay): `protocol_program, intent, intent_id, maker, receiver,
refund_recipient, asset, amount, expiry_slot, created_slot, criterion_program,
criterion_data_hash, fulfillment_data`.

`fulfill_with_criterion(fulfillment_data, criterion_account_count)` forwards only
the first `criterion_account_count` of `remaining_accounts` to the criterion;
later accounts are reserved for settlement. The core rejects passing protected
accounts (intent, receiver, SPL vault) to the criterion.

## 3. Official criteria

### Hashlock (`9FWQGf16ZB5wdrwg3gDCmUcpRJNVuzp1uG12C6z5RVTw`)
- **Stateful?** No. **`criterion_account_count`:** 0.
- **Commitment:** `criterion_data_hash = SHA256(secret)`.
- **Fulfillment:** `fulfillment_data = secret` (non-empty, ≤1024 bytes); adapter
  accepts iff `SHA256(fulfillment_data) == criterion_data_hash`.
- **Caveat (current code):** the adapter checks only the preimage; it does **not**
  bind to intent fields. Secrets must be unique + high-entropy. The richer
  "criterion commitment" hash in `conditional-escrow.md` is not yet implemented.

### Validity / SP1 (`CuSVyvxRCfnsvvDWWqP8xRw8fNbGRwTdam5iKsqY3Kq1`)
- **Stateful?** Yes — `ValidityConfig` PDA. **`criterion_account_count`:** 1 (the
  config account).
- **Config:** `config_hash = hash_config(guest_elf_hash, sp1_vkey_hash,
  fixed_public_inputs)` with domain `"validity-config-v1"` + spec version.
- **Commitment:** intent `criterion_data_hash = config_hash`.
- **Fulfillment:** `ValidityFulfillment { proof, public_inputs_suffix }`; adapter
  reconstructs `public_inputs = fixed_public_inputs || suffix` and verifies the
  Groth16 proof against `sp1_vkey_hash` (`GROTH16_VK_5_0_0_BYTES`, ~270–280k CU).
- **Lifecycle instr:** `create_validity(args)` (anyone can pay; PDA from
  `config_hash`).

### Future official criteria (named, not built)
`Signature`, `EncryptedDisclosure`, `CrossChainLockProof`, `MultiCriterion`.

## 4. Off-chain registry — `@laplace/registry` (ships now)

Single source of truth for front-ends. No governance, no chain calls — a curated,
versioned dataset reviewed in PRs.

```ts
type Cluster = "localnet" | "devnet" | "mainnet-beta";

interface ClusterConfig {
  cluster: Cluster;
  rpcUrl: string;
  programs: { laplace: Address; hashlock: Address; validity: Address };
  stablecoins: { symbol: string; mint: Address; decimals: number }[];
}

interface CriterionDescriptor {
  key: "hashlock" | "validity";
  displayName: string;
  status: "official" | "experimental";
  programId: Record<Cluster, Address>;
  stateful: boolean;             // hashlock=false, validity=true
  criterionAccountCount: number; // hashlock=0, validity=1
  fulfillmentKind: "preimage" | "sp1-proof";
  commitment: "sha256-preimage" | "validity-config-hash";
  docsUrl: string;
  warnings?: string[];           // e.g. hashlock "use unique high-entropy secrets"
}

// Optional, user/community-contributed validity configs for reuse in the UI:
interface ValidityConfigEntry {
  label: string;
  cluster: Cluster;
  configHash: string;            // hex
  guestElfHash: string;
  sp1VkeyHash: string;           // 0x… from vk.bytes32()
  fixedPublicInputs: string;     // hex
  authorNote?: string;
}
```

### Trust model
- **Official** descriptors are vetted in-repo. The Laplace core does not enforce
  this list — a maker may target any program address. The UI clearly labels
  anything not in the official set and warns before interacting.
- `ValidityConfigEntry`s are conveniences; the binding security comes from
  `config_hash` on-chain, so a wrong entry simply fails verification.

## 5. Program IDs (status)

Declared in `Anchor.toml` (localnet). Devnet addresses are filled in after deploy
and committed to the registry per cluster:

```
laplace  = Bkb7WhLQcnz52gYrSdExPoxZUs8b2fzwjzQwrhcv8ACG
hashlock = 9FWQGf16ZB5wdrwg3gDCmUcpRJNVuzp1uG12C6z5RVTw
validity = CuSVyvxRCfnsvvDWWqP8xRw8fNbGRwTdam5iKsqY3Kq1
```

> Action item: deploy the three programs to devnet and record the resulting
> addresses in `@laplace/registry` under `cluster: "devnet"`.

## 6. On-chain registry program (future, not MVP)

When curation needs to be trust-minimized or governed, add a Laplace registry
program holding criterion entries (program ID, interface version, status, metadata
hash) with an admin/governance authority. Front-ends would then read the registry
account set instead of (or in addition to) the curated file, behind the **same**
`@laplace/registry` interface so app code does not change. Open questions: who
governs listings, how versions/deprecations are signaled, and whether entries are
permissionless-with-reputation or admin-gated.

## 7. Adding a criterion (process)

1. Author + deploy the criterion program implementing `verify_criterion`
   (out-of-band).
2. For stateful criteria, define the config account + commitment hashing.
3. Add a `CriterionDescriptor` to `@laplace/registry` (per-cluster program IDs,
   flags, warnings, docs).
4. If it needs a bespoke create/fulfill UX, add a recipe to `/app/create` and a
   fulfillment plugin in `@laplace/sdk`; otherwise it is still usable via
   `/app/manual`.
5. Optionally spin off a dedicated product (e.g. Disclosure for encrypted
   disclosure).
