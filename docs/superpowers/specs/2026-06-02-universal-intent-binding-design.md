# Universal Intent-Binding Replay Guard — Design

Date: 2026-06-02
Status: Approved (design); pending spec review → implementation plan
Scope: `programs/laplace`, `programs/hashlock`, `programs/validity`, `app/packages/sdk`, `app/packages/registry`, `docs/`

## 1. Problem

Every criterion must bind its accept/reject decision to **one exact intent**, or a fulfillment
accepted for intent A can be replayed against intent B. The protocol already forwards every intent
field to each criterion via `CriterionVerificationRequest`
(`programs/laplace/src/instructions/fulfill_with_criterion.rs:91-106`) — that is the universal
binding channel. But only **hashlock** currently consumes it, and it does so with its own private
hashing code:

- **Hashlock** (fixed in commit `b3ab71d`): hard-binds. The adapter recomputes
  `criterion_data_hash = SHA256(domain ‖ version ‖ criterion_program ‖ intent_id ‖ maker ‖ receiver
  ‖ refund_recipient ‖ asset ‖ amount ‖ expiry ‖ hash_fn_id ‖ SHA256(secret))` from the request and
  rejects on mismatch. The field-serialization lives only in the `hashlock` crate.
- **Validity (SP1)**: soft-binds, **unenforced**. The adapter
  (`programs/validity/src/verify_criterion.rs:28-66`) only checks that the Groth16 proof verifies
  against `config.fixed_public_inputs ‖ suffix` and that `config_hash == criterion_data_hash`. It
  never references the per-intent fields. Because `criterion_data_hash == config_hash`, multiple
  intents can share one `ValidityConfig`, and the same `(proof, suffix)` then settles **any** of
  them. Binding is delegated to the maker (bake intent fields into `fixed_public_inputs`) + the SP1
  guest, but `fixed_public_inputs` is frozen at config-creation, so a reusable config cannot even
  carry a per-intent `intent_id`.
- **Custom criteria**: no shared contract; each program is on its own.

The replay guard must become a **protocol-wide pattern**, reused by both official adapters and
exposed to custom ones, with a single canonical definition mirrored byte-for-byte in the SDK.

## 2. Goal & non-goals

**Goal.** One canonical intent-binding primitive, defined once on-chain and mirrored in the SDK,
that every criterion derives its decision from. Both official adapters (hashlock, validity) adopt it
with **adapter-enforced** binding. The SDK shape elevates binding from a hashlock internal to a
first-class protocol value available to all criteria.

**Non-goals.**
- Forcing custom criteria to bind. The core cannot introspect a CPI'd program; adoption is
  documented + tooled, not enforceable on-chain. (Inherent to the CPI architecture.)
- Generating a fresh bound SP1 proof fixture in this environment (SP1 toolchain unavailable). The
  positive validity proof test is deferred (see §8).
- Changing the escrow lifecycle, account model, or the `CriterionVerificationRequest` wire shape.

## 3. Decisions (resolved forks)

1. **Validity enforcement: mandatory adapter-enforced public-input prefix.** Not an opt-in flag. Real
   by-construction protection, uniform with hashlock. Accepts the cost: a guest-authoring contract +
   the Fibonacci positive fixture becomes a rejection test.
2. **Verification: unit + rejection tests now; positive bound-proof test deferred** with a documented
   TODO + harness stub.
3. **Primitive location: a public `binding` module in the existing `laplace` crate** (adapters
   already depend on `laplace`), not a new crate.
4. **Output form: a single 32-byte `intent_binding_hash`.** Cheap as a ZK public-input prefix; one
   uniform primitive. Trade-off accepted: hashlock's commitment byte-layout changes vs. `b3ab71d`
   (nested hash + shared domain). Acceptable — nothing is on mainnet.

## 4. Shared on-chain primitive — `programs/laplace/src/binding.rs`

```rust
pub const INTENT_BINDING_DOMAIN: &[u8] = b"laplace-intent-bind-v1";

/// Canonical, replay-resistant 32-byte binding over an intent's identity. Every criterion derives
/// its accept/reject decision from this value. Excludes created_slot and the intent PDA (a maker
/// does not know them at commit time), fulfillment_data, and criterion_data_hash.
pub fn intent_binding_hash(req: &CriterionVerificationRequest) -> [u8; 32];
//  = SHA256(
//      INTENT_BINDING_DOMAIN
//      ‖ u16be(interface_version)
//      ‖ criterion_program            (32)
//      ‖ intent_id                    (32)
//      ‖ maker                        (32)
//      ‖ receiver                     (32)
//      ‖ refund_recipient             (32)
//      ‖ asset_canonical              ([0] = SOL; [1] ‖ mint ‖ token_program = SPL)
//      ‖ u64be(amount)
//      ‖ u64be(expiry_slot)
//    )
```

Notes:
- All integers big-endian. `asset_canonical` excludes the SPL `vault` (deterministic ATA of the
  intent PDA + mint → adds no binding).
- Binds `criterion_program` (prevents pointing a commitment at a different criterion). Does **not**
  bind `protocol_program` — parity with the proven hashlock layout; noted as optional future
  hardening, out of scope here.
- A `intent_binding_hash_from_parts(...)` inner fn backs both the request entry point and unit-test
  vectors.
- `binding` is exported from the `laplace` crate (`pub mod binding; pub use binding::*;` as
  appropriate) so adapters reuse it.

## 5. Hashlock adoption — `programs/hashlock`

```text
criterion_data_hash = SHA256( intent_binding_hash(req) ‖ hash_fn_id ‖ SHA256(secret) )
```

- Delete hashlock's local field-serialization (`encode_asset` + the inline field concatenation in
  `hash_hashlock_commitment`); call `laplace::binding::intent_binding_hash`.
- Keep `hash_fn_id` (= 0 SHA256) for future preimage-hash agility; keep
  `HASH_FUNCTION_ID_SHA256` in hashlock constants. Remove the now-unused
  `HASHLOCK_COMMITMENT_DOMAIN` (the domain moves to the shared `INTENT_BINDING_DOMAIN`).
- Guarantee is unchanged; only the byte layout (nested hash + shared domain) changes.

## 6. Validity adoption — `programs/validity` (mandatory enforced prefix)

Adapter reconstructs and verifies:

```text
public_inputs = intent_binding_hash(req) ‖ config.fixed_public_inputs ‖ fulfillment.suffix
verify_proof(proof, public_inputs, config.sp1_vkey_hash, GROTH16_VK_5_0_0_BYTES)
```

- `criterion_data_hash` **stays `= config_hash`** → configs remain reusable across intents; the
  config PDA seed (`[VALIDITY_SEED, criterion_data_hash]`) and the
  `config.config_hash == request.criterion_data_hash` constraint are unchanged. Per-intent binding
  now comes from the adapter-injected 32-byte prefix, so a proof for intent A no longer verifies for
  intent B (different `intent_id` ⇒ different prefix).
- **Guest-authoring contract:** the SP1 guest MUST commit the 32-byte `intent_binding_hash` as its
  **leading** public input, followed by its own fixed values, then suffix values.
- **`fixed_public_inputs` semantics narrow:** it carries only criterion-specific constants and MUST
  NOT carry intent-identity fields (the adapter injects those). `hash_config` and the
  `ValidityConfig` account layout are unchanged.
- Wire format `ValidityFulfillment { proof, public_inputs_suffix }` is **unchanged** — the fulfiller
  still submits only proof + suffix; the adapter builds the prefix.

## 7. Custom criteria

- Core cannot force adoption (no introspection of a CPI'd program).
- The SDK exposes `intentBindingHash(ctx)` and documents the contract: *a conformant criterion MUST
  bind its accept/reject decision to `intent_binding_hash`, recomputed from the verification
  request.*
- `Condition.custom` accepts either a literal `criterionDataHash` (as today) **or**
  `bind: (tag: Uint8Array) => Uint8Array` deriving it from the binding tag.
- Registry marks non-official criteria as binding-unverified (see §9).

## 8. SDK reshape — `app/packages/sdk`

- **New `src/binding.ts`:** `intentBindingHash(ctx: CommitContext): Uint8Array`, a byte-for-byte
  mirror of the Rust helper. Move the existing `concatBytes` / `u16be` / `u64be` / asset-encoding
  helpers out of `criteria/index.ts` into here.
- **`PreparedCriterion` gains:**
  - `bindingTag: ReadonlyUint8Array` — **always set**, the `intentBindingHash(ctx)` value.
  - `requiredPublicInputPrefix?: ReadonlyUint8Array` — set by validity (= `bindingTag`); used by
    guest authors / client-side sanity checks.
- **`Condition.hashlock`:** `criterionDataHash = SHA256(bindingTag ‖ hash_fn_id ‖ SHA256(secret))`.
- **`Condition.validity`:** becomes ctx-aware — `criterionDataHash = configHash` (unchanged),
  `requiredPublicInputPrefix = bindingTag`.
- **`Condition.custom`:** literal `criterionDataHash` or `bind(tag)`.
- **`buildCreateIntent`:** shape unchanged — it already calls `criterion.prepare(ctx)`. It computes
  `bindingTag` once and every criterion's `prepare` consumes the binding (today only hashlock does).
- **Optional `assertBoundPublicInputs({ ctx, fixedPublicInputs, suffix, proofPublicInputs })`**
  helper: reconstructs `bindingTag ‖ fixed ‖ suffix` and checks a proof's public inputs match before
  submitting (catches guest/layout mistakes client-side).
- Fulfillment builders (`hashlockFulfillment`, `validityFulfillment`) keep their wire shapes.

## 9. Registry — `app/packages/registry`

- Add `CriterionEntry.conformance.enforcement: 'adapter' | 'convention' | 'none'` (alongside the
  existing `binds`). Records **how** binding is guaranteed. Hashlock → `adapter`; validity →
  `adapter` (was convention); unverified/custom → `convention` or `none`. Keep `binds: 'full'` for
  both official criteria.
- Update the `verify`/`commitment` strings and notes for both official criteria to describe the
  shared primitive.

## 10. Tests / fixtures

**Rust:**
- Unit vectors for `intent_binding_hash` (stable, checked-in expected bytes).
- Hashlock commitment via the shared helper (`SHA256(tag ‖ hash_fn_id ‖ SHA256(secret))`).
- Validity public-input prefix construction (`tag ‖ fixed ‖ suffix`).
- **Convert the Fibonacci fixture test → rejection test:** the existing unbound proof must now be
  REJECTED (proves the guard fires). Documented TODO + harness stub for a positive bound-proof test
  once SP1 tooling is available.

**SDK:**
- Rust↔TS parity vectors for `intentBindingHash` (same inputs → same 32 bytes).
- Updated `criteria` / `build-create-intent` tests (new layout, `bindingTag`,
  `requiredPublicInputPrefix`).
- Localnet hashlock e2e still green (proves Rust↔TS parity of the new layout via real
  create/fulfill/close).
- Validity e2e asserts an unbound proof is rejected.

**Registry:** conformance/binding-enforcement field tests updated.

## 11. Docs

- `docs/conditional-escrow.md`: new "Universal Intent Binding" section; updated hashlock + validity +
  guest-contract subsections.
- `docs/criteria-registry.md`: binding-enforcement column.
- `docs/product-vision.md`: drop the stale "hashlock not intent-bound" gap; note universal binding.

## 12. Consequential / breaking changes

- **Hashlock commitment bytes change** vs. `b3ab71d` (nested hash + shared `laplace-intent-bind-v1`
  domain). Re-derivation; devnet-only, acceptable.
- **Validity gains a hard guest-authoring contract**; `fixed_public_inputs` must no longer hold
  intent fields. Existing/example guests must commit the binding tag as leading public input.
- **The Fibonacci positive test becomes a rejection test.** Positive bound-proof coverage deferred.

## 13. Open / deferred

- Positive validity proof fixture (needs SP1 toolchain) — tracked as a TODO + test harness stub.
- Optional future hardening: also bind `protocol_program` into `intent_binding_hash`.
- Encrypted-disclosure guest under `guests/` must be updated to the binding-tag layout when that
  criterion is built out (out of scope here).

## 14. Touched files (anticipated)

- `programs/laplace/src/binding.rs` (new), `programs/laplace/src/lib.rs` (export module).
- `programs/hashlock/src/verify_criterion.rs`, `programs/hashlock/src/constants.rs`.
- `programs/validity/src/verify_criterion.rs` (+ `state.rs`/`constants.rs` as needed), validity tests.
- `app/packages/sdk/src/binding.ts` (new), `criteria/index.ts`, `instructions.ts`, `constants.ts`,
  plus SDK tests under `app/packages/sdk/test/`.
- `app/packages/registry/src/criteria.ts`, `types.ts`, registry tests.
- `docs/conditional-escrow.md`, `docs/criteria-registry.md`, `docs/product-vision.md`.

## 15. Implementation & audit resolution (2026-06-02)

Implemented on branch `feat/universal-intent-binding` via a multi-agent workflow (Sonnet foundation +
adopters, Opus audit panel). The Opus auditors returned **0 blockers, 3 majors, 3 minors, 5 nits**.

The three "majors" were **one root cause**: the litesvm e2e tests (`programs/{validity,hashlock}/
tests/test_laplace_e2e.rs`) read `target/deploy/*.so` via a **CWD-relative path** and, on miss, did
`return` → reported a **vacuous `ok`**; and the workspace `.so` were **stale** (pre-binding). So the
binding guard was never exercised against real bytecode. (The audit's corroborating `strings`/`grep`
on the `.so` was a **false-negative method** — macOS `strings`/`grep` cannot read SBF rodata; even
known literals like `validity-config-v1` return 0. The mtime-based staleness evidence was valid.)

Resolution (all verified):
- **Rebuilt** all three programs with `anchor build --ignore-keys` (toolchain present).
- **Fail-closed harness:** `load_programs`/`load_e2e_programs`/`test_initialize` now resolve the
  `.so` at the workspace root via `CARGO_MANIFEST_DIR` and **panic** if missing — a green run can no
  longer hide skipped e2e coverage. The e2e suites now genuinely execute; the validity rejection
  test passes against the new bytecode (proves the guard fires).
- **Minor (encrypted-disclosure guest, §13 deferred):** added a non-conformance banner +
  `validity_fixed_public_inputs` doc so the stale example can't be copied as conformant.
- **Nits:** `binding.ts` hardened (`u16be`/`u64be` range guards, `intentId` 32-byte guard, hoisted
  domain encode); added a **locked Rust↔TS hashlock-commitment vector** (`78920cfb…`) in
  `test_hashlock.rs` + `binding.test.ts` (closes the "no hashlock commitment test / tautological
  round-trip" gap).
- **Accepted deferrals:** positive bound SP1 proof fixture (needs SP1 toolchain); SDK *localnet*
  integration tests stay skipped (need a running validator) — the Rust litesvm e2e provides the real
  on-chain round-trip coverage in the meantime.

Final verification: **Rust 47 passed / 0 failed / 1 ignored** (e2e executed, not skipped); **TS
typecheck clean, sdk 59 passed / 8 skipped, registry 12 passed**. Uncommitted on the feature branch.
</content>
</invoke>
