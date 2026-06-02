# Laplace Lifecycle Event Emission — Design

Date: 2026-06-02
Status: Approved (design); pending spec review → implementation plan
Scope: `programs/laplace`, `programs/validity`, `app/packages/sdk`, `target/idl/`, devnet redeploy

## 1. Problem

A future "view whole Laplace status" dashboard needs off-chain history and analytics
(settled volume, completed deals, per-intent timelines). That data does **not** survive on-chain:

- `fulfill`/`refund` flip `Intent.status` in place, but `close_intent` uses Anchor `close = maker`,
  which **deletes the account** after the handler returns
  (`programs/laplace/src/instructions/close_intent.rs:8-16`). Once closed, `getProgramAccounts`
  can never see the intent again — and rent-reclaim incentivizes makers to close.
- The programs emit **zero events** today — verified: no `emit!` / `#[event]` / `emit_cpi!` anywhere
  across `programs/laplace`, `programs/validity`, `programs/hashlock` (only one `msg!` in
  `laplace::initialize`).
- There is **no settlement timestamp** on `Intent` (`created_slot` exists; no settled/fulfilled slot).

So lifecycle transitions are only recoverable from the transaction log. This design adds a clean,
decodable event stream so an indexer (Design A, separate follow-on) can be built without parsing raw
instructions or racing account deletion.

This is **Design B** ("touch the programs first"). It is a complete, verifiable vertical slice:
programs emit → SDK decodes → tests prove it → devnet redeployed. The indexer **service** (DB,
ingestion, API) is explicitly out of scope (Design A).

## 2. Goal & non-goals

**Goal.** Emit rich, bounded Anchor events at every Intent lifecycle transition plus validity config
creation, and give the SDK a hand-written decoder so the events are typed and consumable. The event
payloads must let an indexer build a complete view **from logs alone**, without extra `getAccountInfo`
round-trips.

**Non-goals.**
- Building the indexer service (DB schema, ingestion worker, dashboard) — that is Design A.
- Adding any field to the `Intent` account (no `settled_slot`); settlement timing is derived off-chain
  from the event transaction's slot. (See §3, decision 2.)
- Changing the escrow lifecycle, account model, instruction account lists, or the
  `CriterionVerificationRequest` wire shape.
- Criterion-verified events emitted from inside `validity`/`hashlock` `verify_criterion` (rejected; see §3).

## 3. Decisions (resolved with the user)

Grounded by a read-only "understand" workflow (5 parallel analyses + completeness critic) and a live
devnet check.

1. **Mechanism: plain `emit!`, not `emit_cpi!`.** Verified rationale: `emit_cpi!` requires enabling the
   `event-cpi` Cargo feature (changes verifiable-build bytecode), injects an `event_authority` PDA +
   the program account into **every** annotated instruction — which on `fulfill_with_criterion` collide
   with the `criterionAccountCount`-based remaining-accounts slicing
   (`fulfill_with_criterion.rs:59-74`) — and breaks the exact account-count tests
   (`build-create-intent.test.ts`, `build-settlement.test.ts`). It buys **zero** codegen benefit:
   Codama `renderers-js@2.2.0` renders no event code in either case (verified: no event handling in its
   dist; `nodes-from-anchor` even strips the event struct out of `definedTypes`). `emit!` has no Cargo
   change, no account-list change, no CU hit, no test breakage.
2. **No `settled_slot` field — events only.** No consumer needs settlement slot as a queryable account
   field, and a `u64` slot is not `memcmp`-range-filterable, so `getProgramAccounts` gains nothing. The
   slot is recoverable from the `IntentFulfilled`/`IntentRefunded` transaction's slot. Adding the field
   is the only high-risk change (grows `Intent::LEN` against a codebase with **no `realloc`** anywhere,
   verified). Decoupling events (safe) from layout (risky) ships the indexing win immediately.
3. **Migration: not applicable.** Live devnet check returned **0 Intent accounts and 0 ValidityConfig
   accounts** on `api.devnet.solana.com`. Any bytecode change is a free in-place upgrade (program IDs
   are keypair-fixed and identical across clusters); nothing to migrate.
4. **Scope: laplace lifecycle + `ValidityConfigCreated`.** `IntentCreated/Fulfilled/Refunded/Closed`
   plus a single `ValidityConfigCreated` in the validity program (its one account-creation lifecycle,
   zero interface/CU/migration risk). Hashlock stays event-free (stateless, empty `VerifyCriterion{}`).
   Criterion-verified events inside `verify_criterion` are **rejected**: laplace's top-level
   `IntentFulfilled` already records every success (laplace observes `invoke()?` returning `Ok`), and
   nested-CPI events would force indexers to parse inner-instruction logs and couple to every criterion
   program.
5. **Field granularity: rich-bounded.** Full intent identity per event (all in scope — the whole
   `Intent` struct is loaded at each emit point), excluding large/variable payloads. `fulfillment_data`
   is excluded (it is moved into `verify_criterion` before the handler-level fulfill emit, so not in
   scope; verified `fulfill_with_criterion.rs:74`); `fixed_public_inputs` carried as length only (up to
   `MAX_FIXED_PUBLIC_INPUTS_LEN = 1024` B).

## 4. On-chain events

### 4.1 `programs/laplace/src/events.rs` (new module, wired in `lib.rs`)

Reuses the existing `EscrowAsset` and `IntentStatus` types (both already derive
`AnchorSerialize`/`AnchorDeserialize`, `Copy`).

```rust
#[event] pub struct IntentCreated {
    pub intent: Pubkey, pub id: [u8;32], pub maker: Pubkey, pub receiver: Pubkey,
    pub refund_recipient: Pubkey, pub criterion_program: Pubkey,
    pub criterion_data_hash: [u8;32], pub criterion_interface_version: u16,
    pub asset: EscrowAsset, pub amount: u64, pub expiry_slot: u64, pub created_slot: u64,
}
#[event] pub struct IntentFulfilled {
    pub intent: Pubkey, pub id: [u8;32], pub maker: Pubkey, pub receiver: Pubkey,
    pub criterion_program: Pubkey, pub asset: EscrowAsset, pub amount: u64, pub slot: u64,
}
#[event] pub struct IntentRefunded {
    pub intent: Pubkey, pub id: [u8;32], pub maker: Pubkey, pub refund_recipient: Pubkey,
    pub asset: EscrowAsset, pub amount: u64, pub slot: u64,
}
#[event] pub struct IntentClosed {
    pub intent: Pubkey, pub id: [u8;32], pub maker: Pubkey,
    pub final_status: IntentStatus, pub slot: u64,
}
```

### 4.2 Emit points (one per instruction, after all CPIs/transfers succeed)

| Event | Location (verified) | slot source |
|---|---|---|
| `IntentCreated` | `create_intent.rs:56` — after the asset-lock match, before `Ok` | `intent.created_slot` |
| `IntentFulfilled` | `fulfill_with_criterion.rs:81` — handler level after the release match (fires once for native + SPL) | `Clock::get()?.slot` |
| `IntentRefunded` | `refund_expired_intent.rs:36` — handler level after the refund match | `Clock::get()?.slot` |
| `IntentClosed` | inside `close_intent` handler **before return** (Anchor `close = maker` deallocates after the handler) | `Clock::get()?.slot` |

`IntentClosed` is the non-negotiable event: it is the only transition where the account vanishes and
cannot be reconstructed from account state. `final_status` records whether the closed intent had been
`Fulfilled` or `Refunded`.

### 4.3 `programs/validity/src/events.rs` (new module, wired in `lib.rs`)

```rust
#[event] pub struct ValidityConfigCreated {
    pub config: Pubkey, pub config_hash: [u8;32], pub guest_elf_hash: [u8;32],
    pub sp1_vkey_hash: [u8;32], pub fixed_public_inputs_len: u32, pub payer: Pubkey,
}
```

Emit at `create_validity.rs:46` (after `config.bump = ctx.bumps.config;`, before `Ok`).
`fixed_public_inputs` carried as length only.

## 5. SDK — hand-written event decoder

**New `app/packages/sdk/src/events.ts`.** Mirrors the existing hand-written codec pattern in
`app/packages/sdk/src/criteria/index.ts` (`validityFulfillmentEncoder` via `getStructEncoder`/
`getStructDecoder`).

- **Discriminator** per event = `sha256("event:<Name>")[0..8]` (Anchor convention for `emit!`;
  `@noble/hashes` is already a dependency).
- **Payload decode** via `getStructDecoder` over the event fields, **reusing the generated type codecs**
  `getEscrowAssetDecoder` / `getIntentStatusDecoder` from `generated/laplace/types` — only the event
  envelope (discriminator + struct) is hand-written.
- `parseLaplaceEvents(logs: string[]): LaplaceEvent[]` — scans for `Program data: <base64>` lines,
  base64-decodes, matches a known 8-byte discriminator, decodes; returns a discriminated union
  (`{ kind: 'IntentCreated', ... } | { kind: 'IntentFulfilled', ... } | ...`); ignores unknown lines.
- `fetchAndParseEvents(rpc, signature)` — `getTransaction(sig, {maxSupportedTransactionVersion:0})`
  then `parseLaplaceEvents(meta.logMessages)`. (`client.#send` returns only the signature today.)
- Exported from `app/packages/sdk/src/index.ts`. A header comment documents that the decoder is
  intentionally hand-maintained because Codama `renderers-js@2.2.0` does not render events; re-running
  `npm run codegen` will **not** regenerate it.

## 6. Tests

- **Rust e2e (litesvm):** add a send helper that returns `TransactionMetadata` (current
  `send_ix`/`send_ixs`/`try_send_ix` discard it), then assert each lifecycle transaction's `.logs`
  contains the expected event (discriminator match / decode). Cover create→fulfill (hashlock and
  validity e2e), refund, and close. Rebuild `.so` with `anchor build --ignore-keys` **before**
  `cargo test` (litesvm runs the prebuilt `target/deploy/*.so`).
- **TS unit (`app/packages/sdk/test/events.test.ts`):** round-trip — Borsh-encode a known event (disc +
  struct) → `parseLaplaceEvents` → assert decoded fields; one per event type; one negative case
  (non-matching discriminator ignored).
- **TS integration (`LAPLACE_LOCALNET=1`):** `createIntent` → `fetchAndParseEvents` → assert
  `IntentCreated` decodes with the right intent PDA / maker / amount.
- **Unchanged (verified):** account-count tests and `ROLE_MEMCMP_OFFSET` / `Intent::LEN` assertions —
  `emit!` touches neither the account layout nor instruction account lists.

## 7. Build, codegen, deploy

1. `export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"`
2. `anchor build --ignore-keys` — rebuilds `.so` and regenerates `target/idl/*.json` (now with
   `events[]`). (Plain `anchor build` fails with a program-ID mismatch.)
3. `npm run codegen -w @laplace/sdk` — produces nothing for events (expected); keeps the rest of the
   generated client in sync.
4. `cargo test` (after the rebuild) + `npm run test -w @laplace/sdk`.
5. `scripts/deploy.sh devnet ~/.config/solana/devnet-deployer.json` — upgrades in place (same program
   IDs; devnet empty, nothing to migrate). `scripts/verify-deploy.sh devnet` to confirm.
6. Commit regenerated `target/idl/*.json` alongside the source.

## 8. File-by-file change list

**New**
- `programs/laplace/src/events.rs`
- `programs/validity/src/events.rs`
- `app/packages/sdk/src/events.ts`
- `app/packages/sdk/test/events.test.ts`

**Edit**
- `programs/laplace/src/lib.rs` (declare/`pub use` the `events` module; `instructions.rs` if wiring needs it)
- `programs/laplace/src/instructions/create_intent.rs`, `fulfill_with_criterion.rs`,
  `refund_expired_intent.rs`, `close_intent.rs` (add `emit!`)
- `programs/validity/src/lib.rs`, `programs/validity/src/create_validity.rs` (add `emit!`)
- `app/packages/sdk/src/index.ts` (export events)
- Rust e2e test files: a metadata-returning send helper + event assertions
  (`programs/hashlock/tests/...`, `programs/validity/tests/...`)
- `target/idl/laplace.json`, `target/idl/validity.json` (regenerated, committed)

**Out of scope (→ Design A)**
- Indexer service: DB schema, ingestion (`getSignaturesForAddress`+`getTransaction` backfill /
  `logsSubscribe` realtime), API, dashboard. A live `logsSubscribe` SDK helper is deferred to Design A
  unless requested.

## 9. Risks & mitigations

- **Stale `.so` false-green:** litesvm e2e runs `target/deploy/*.so`; new event assertions silently
  pass against the old binary if not rebuilt. Mitigation: `anchor build --ignore-keys` before
  `cargo test` (documented in §7; matches the project memory note).
- **Verifiable-build reproducibility:** any bytecode change must be rebuilt under the pinned toolchain
  (anchor-cli 1.0.2, frozen `Cargo.lock`; validity also pins `sp1-solana` by git rev). `emit!` keeps the
  change minimal; no feature flags flipped.
- **Decoder drift:** the hand-written `events.ts` is not codegen-maintained. Mitigation: a round-trip
  unit test pins discriminators + field order; a header comment warns maintainers.
- **Log truncation:** `emit!` events live in tx logs, which some RPC providers can truncate under very
  large log volume. Accepted per decision 1 (rich-bounded payloads stay small; no confirmed need for
  truncation-resistant inner-instruction data). Revisit only if the Design A indexer proves it needs it.
