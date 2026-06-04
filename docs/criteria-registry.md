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
   - hashlock: `criterion_data_hash = SHA256(intent_binding_hash ‖ hash_fn_id ‖ SHA256(secret))`;
     **stateless**, no on-chain config account. Binding is adapter-enforced.
   - validity: a **stateful** `ValidityConfig` account (`guest_elf_hash`,
     `sp1_vkey_hash`, `fixed_public_inputs`) at PDA `[VALIDITY_SEED, config_hash]`;
     the intent's `criterion_data_hash = config_hash`. Per-intent binding comes from the
     adapter-injected `intent_binding_hash` prefix, not from `config_hash`.
3. **Registry entry** — front-end metadata that maps a criterion to its program
   IDs per cluster plus display/UX info. Lives off-chain in `@laplace-one/registry`.

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

### Hashlock (`DNotXVWh1ifzp9MHSd5H4F78SRHptF9p8vGfMmjtuWX2`)
- **Stateful?** No. **`criterion_account_count`:** 0.
- **Commitment:** `criterion_data_hash = SHA256(intent_binding_hash ‖ hash_fn_id ‖ SHA256(secret))`.
  `intent_binding_hash` is the universal primitive (domain `laplace-intent-bind-v1`; covers
  `interface_version`, `criterion_program`, `intent_id`, `maker`, `receiver`, `refund_recipient`,
  `asset_canonical`, `amount`, `expiry_slot`; `created_slot`/PDA/`protocol_program` excluded).
  `hash_fn_id` = `0x00` for SHA256 (reserved for future preimage-hash agility).
- **Verify:** adapter recomputes the commitment from the request's intent fields +
  `SHA256(fulfillment_data)` and accepts iff it equals `criterion_data_hash`.
- **Binding enforcement:** `adapter` — the adapter recomputes `intent_binding_hash` from the
  live `CriterionVerificationRequest` and rejects on any mismatch. A revealed secret cannot be
  replayed against a different intent. **Atomic swaps still work** — the shared secret unlocks every
  leg, because each leg recomputes the commitment with its own fields. Revealing a preimage on-chain
  is public/irreversible (it lands in calldata).

### Validity / SP1 (`EQfH4VFdxcFYh8prdAsB4XwKCZiiR5uta594bfiwhLsB`)
- **Stateful?** Yes — `ValidityConfig` PDA. **`criterion_account_count`:** 1 (the
  config account).
- **Config:** `config_hash = hash_config(guest_elf_hash, sp1_vkey_hash,
  fixed_public_inputs)` with domain `"validity-config-v1"` + spec version.
- **Commitment:** intent `criterion_data_hash = config_hash`. Configs remain reusable across
  intents; per-intent binding comes from the adapter-injected prefix, not from `config_hash`.
- **Verify:** adapter reconstructs
  `public_inputs = intent_binding_hash(req) ‖ fixed_public_inputs ‖ suffix` and verifies the
  Groth16 proof against `sp1_vkey_hash` (`GROTH16_VK_5_0_0_BYTES`, ~270–280k CU).
  The 32-byte `intent_binding_hash` is mandatorily prepended by the adapter.
- **Binding enforcement:** `adapter` — the adapter injects `intent_binding_hash` as the leading
  32-byte public-input prefix. A proof for intent A will not verify for intent B (different
  `intent_id` ⇒ different prefix). **Guest-authoring contract:** the SP1 guest MUST commit the
  32-byte `intent_binding_hash` as its leading public input; `fixed_public_inputs` carries only
  criterion-specific constants and MUST NOT include intent-identity fields.
- **Lifecycle instr:** `create_validity(args)` (anyone can pay; PDA from
  `config_hash`).

### Future official criteria (named, not built)
`Signature`, `EncryptedDisclosure`, `CrossChainLockProof`, `MultiCriterion`.

## 4. Off-chain registry — `@laplace-one/registry` (ships now)

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
  conformance: {
    binds: "full";               // both official criteria bind all intent-identity fields
    enforcement: "adapter" | "convention" | "none";
    // adapter   — the on-chain adapter recomputes intent_binding_hash and enforces it
    //             (hashlock, validity).
    // convention — documented contract; the core cannot verify CPI program behavior
    //             (custom/third-party criteria that voluntarily follow the contract).
    // none       — no known binding guarantee (unverified or legacy criteria).
  };
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

Declared in `Anchor.toml` and live on **localnet + devnet** (deployed; same IDs reserved
for mainnet-beta). The program keypair fixes the address across clusters, so the registry
uses one ID set per program:

```
laplace  = 5ozBamUtiAHCkiipAVL9E8v8r54HqZsHMDbkHdczpidu
hashlock = DNotXVWh1ifzp9MHSd5H4F78SRHptF9p8vGfMmjtuWX2
validity = EQfH4VFdxcFYh8prdAsB4XwKCZiiR5uta594bfiwhLsB
```

> Status: deployed to devnet (upgrade authority `D32VrfY9JEbXKLcbGkuTeJEoWkV24AhbzbLP3Duo1Ek7`)
> and recorded in `@laplace-one/registry` under every cluster.

## 6. On-chain registry program (future, not MVP)

When curation needs to be trust-minimized or governed, add a Laplace registry
program holding criterion entries (program ID, interface version, status, metadata
hash) with an admin/governance authority. Front-ends would then read the registry
account set instead of (or in addition to) the curated file, behind the **same**
`@laplace-one/registry` interface so app code does not change. Open questions: who
governs listings, how versions/deprecations are signaled, and whether entries are
permissionless-with-reputation or admin-gated.

## 7. Adding a criterion (process)

1. Author + deploy the criterion program implementing `verify_criterion`
   (out-of-band).
2. For stateful criteria, define the config account + commitment hashing.
3. Add a `CriterionDescriptor` to `@laplace-one/registry` (per-cluster program IDs,
   flags, warnings, docs).
4. If it needs a bespoke create/fulfill UX, add a recipe to `/app/create` and a
   fulfillment plugin in `@laplace-one/sdk`; otherwise it is still usable via
   `/app/manual`.
5. Optionally spin off a dedicated product (e.g. Disclosure for encrypted
   disclosure).
