# Laplace Lifecycle Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit Anchor lifecycle events from the laplace + validity programs and give `@laplace/sdk` a hand-written decoder, so an off-chain indexer (Design A) can reconstruct full history from logs.

**Architecture:** Plain `emit!` (no `event-cpi`, no account-list/layout change) at handler-level emit points; a hand-written `events.ts` decoder mirroring the existing `validityFulfillment` codec (Codama drops events); behavioral coverage via litesvm e2e log assertions + TS round-trip + a localnet integration test; then a devnet upgrade-in-place.

**Tech Stack:** Anchor 1.0.2 / Rust 1.89, litesvm 0.10, `@solana/kit` codecs, `@noble/hashes`, vitest.

**Spec:** `docs/superpowers/specs/2026-06-02-laplace-lifecycle-events-design.md`

**Event discriminators (Anchor `sha256("event:<Name>")[..8]`, precomputed):**
- `IntentCreated` = `[184,46,156,205,169,254,11,108]`
- `IntentFulfilled` = `[168,116,104,206,0,206,46,195]`
- `IntentRefunded` = `[192,129,4,158,184,25,83,113]`
- `IntentClosed` = `[127,229,67,202,91,56,164,0]`
- `ValidityConfigCreated` = `[136,66,149,229,23,83,60,14]`

**Global preamble for every Rust build/test step:**
```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```
litesvm e2e loads the prebuilt `target/deploy/*.so`, so **`anchor build --ignore-keys` must run before `cargo test`** or tests run the old binary.

---

### Task 1: Laplace lifecycle events (Rust program) — TDD via hashlock e2e

**Files:**
- Create: `programs/laplace/src/events.rs`
- Modify: `programs/laplace/src/lib.rs`
- Modify: `programs/laplace/src/instructions/create_intent.rs`, `fulfill_with_criterion.rs`, `refund_expired_intent.rs`, `close_intent.rs`
- Modify: `programs/hashlock/Cargo.toml` (dev-dep), `programs/hashlock/tests/test_laplace_e2e.rs`

- [ ] **Step 1: Create the event structs (types only, no emit yet)**

Create `programs/laplace/src/events.rs`:
```rust
use anchor_lang::prelude::*;

use crate::{EscrowAsset, IntentStatus};

#[event]
pub struct IntentCreated {
    pub intent: Pubkey,
    pub id: [u8; 32],
    pub maker: Pubkey,
    pub receiver: Pubkey,
    pub refund_recipient: Pubkey,
    pub criterion_program: Pubkey,
    pub criterion_data_hash: [u8; 32],
    pub criterion_interface_version: u16,
    pub asset: EscrowAsset,
    pub amount: u64,
    pub expiry_slot: u64,
    pub created_slot: u64,
}

#[event]
pub struct IntentFulfilled {
    pub intent: Pubkey,
    pub id: [u8; 32],
    pub maker: Pubkey,
    pub receiver: Pubkey,
    pub criterion_program: Pubkey,
    pub asset: EscrowAsset,
    pub amount: u64,
    pub slot: u64,
}

#[event]
pub struct IntentRefunded {
    pub intent: Pubkey,
    pub id: [u8; 32],
    pub maker: Pubkey,
    pub refund_recipient: Pubkey,
    pub asset: EscrowAsset,
    pub amount: u64,
    pub slot: u64,
}

#[event]
pub struct IntentClosed {
    pub intent: Pubkey,
    pub id: [u8; 32],
    pub maker: Pubkey,
    pub final_status: IntentStatus,
    pub slot: u64,
}
```

- [ ] **Step 2: Wire the module into `lib.rs`**

In `programs/laplace/src/lib.rs`, add `pub mod events;` after `pub mod constants;` and `pub use events::*;` after `pub use constants::*;`:
```rust
pub mod binding;
pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use binding::*;
pub use constants::*;
pub use events::*;
pub use instructions::*;
pub use state::*;
```

- [ ] **Step 3: Verify it compiles**

Run: `export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH" && cargo check -p laplace`
Expected: PASS (events compile; not yet emitted — a `dead_code`/unused warning is acceptable).

- [ ] **Step 4: Add the base64 dev-dependency to the hashlock test crate**

In `programs/hashlock/Cargo.toml`, under `[dev-dependencies]`, add:
```toml
base64 = "0.22"
```

- [ ] **Step 5: Add event-decode helpers to the hashlock e2e**

In `programs/hashlock/tests/test_laplace_e2e.rs`, add these helpers near `send_ixs` and refactor `send_ixs` to reuse the metadata variant:
```rust
fn send_ixs_meta(
    svm: &mut LiteSVM,
    payer: &Keypair,
    ixs: Vec<anchor_lang::solana_program::instruction::Instruction>,
    extra_signers: &[&Keypair],
) -> litesvm::types::TransactionMetadata {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&ixs, Some(&payer.pubkey()), &blockhash);
    let mut signers: Vec<&dyn Signer> = vec![payer];
    signers.extend(extra_signers.iter().map(|signer| *signer as &dyn Signer));
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &signers).unwrap();
    svm.send_transaction(tx).unwrap()
}

fn event_discriminator(name: &str) -> [u8; 8] {
    let h = anchor_lang::solana_program::hash::hash(format!("event:{name}").as_bytes());
    let mut d = [0u8; 8];
    d.copy_from_slice(&h.to_bytes()[..8]);
    d
}

fn decode_event<T: anchor_lang::AnchorDeserialize>(
    meta: &litesvm::types::TransactionMetadata,
    name: &str,
) -> T {
    use base64::{engine::general_purpose::STANDARD, Engine};
    let disc = event_discriminator(name);
    for line in &meta.logs {
        if let Some(b64) = line.strip_prefix("Program data: ") {
            if let Ok(bytes) = STANDARD.decode(b64) {
                if bytes.len() >= 8 && bytes[..8] == disc {
                    return T::try_from_slice(&bytes[8..])
                        .expect("event payload should deserialize");
                }
            }
        }
    }
    panic!("event {name} not found in tx logs: {:?}", meta.logs);
}
```
Then change the body of the existing `send_ixs` to delegate (DRY):
```rust
fn send_ixs(
    svm: &mut LiteSVM,
    payer: &Keypair,
    ixs: Vec<anchor_lang::solana_program::instruction::Instruction>,
    extra_signers: &[&Keypair],
) {
    send_ixs_meta(svm, payer, ixs, extra_signers);
}
```

- [ ] **Step 6: Add the failing event assertions (RED)**

In `programs/hashlock/tests/test_laplace_e2e.rs`, capture metadata at the lifecycle send sites and assert the events. Apply each block inside the matching `#[test]` fn, replacing the corresponding `send_ix(...)`/`send_ixs(...)` call for that transition with a `send_ixs_meta(...)` capture:

In `hashlock_fulfillment_releases_escrow_to_receiver` (SOL): at the **create** send and the **fulfill** send:
```rust
// create
let meta = send_ixs_meta(&mut svm, &maker, vec![create_ix], &[]);
let ev: laplace::IntentCreated = decode_event(&meta, "IntentCreated");
assert_eq!(ev.intent, intent);
assert_eq!(ev.maker, maker.pubkey());
assert_eq!(ev.amount, ESCROW_AMOUNT);
assert!(matches!(ev.asset, laplace::EscrowAsset::NativeSol));
// fulfill
let meta = send_ixs_meta(&mut svm, &receiver, vec![fulfill_ix], &[]);
let ev: laplace::IntentFulfilled = decode_event(&meta, "IntentFulfilled");
assert_eq!(ev.intent, intent);
assert_eq!(ev.receiver, receiver.pubkey());
assert_eq!(ev.amount, ESCROW_AMOUNT);
```

In `hashlock_spl_fulfillment_releases_tokens_to_receiver` (SPL fulfill + close): at the **fulfill** send and the **close** send:
```rust
// fulfill (SPL)
let meta = send_ixs_meta(&mut svm, &receiver, vec![fulfill_spl_ix], &[]);
let ev: laplace::IntentFulfilled = decode_event(&meta, "IntentFulfilled");
assert_eq!(ev.intent, intent);
assert!(matches!(ev.asset, laplace::EscrowAsset::SplToken { .. }));
// close
let meta = send_ixs_meta(&mut svm, &maker, vec![close_spl_ix], &[]);
let ev: laplace::IntentClosed = decode_event(&meta, "IntentClosed");
assert_eq!(ev.intent, intent);
assert_eq!(ev.maker, maker.pubkey());
assert_eq!(ev.final_status, laplace::IntentStatus::Fulfilled);
```

In `hashlock_spl_refund_returns_tokens_after_expiry` (SPL refund): at the **refund** send:
```rust
let meta = send_ixs_meta(&mut svm, &maker, vec![refund_spl_ix], &[]);
let ev: laplace::IntentRefunded = decode_event(&meta, "IntentRefunded");
assert_eq!(ev.intent, intent);
assert_eq!(ev.amount, ESCROW_AMOUNT);
```
> Variable names (`create_ix`, `fulfill_ix`, `fulfill_spl_ix`, `close_spl_ix`, `refund_spl_ix`, `intent`, `maker`, `receiver`) follow the existing locals in each test; read the test body and bind the captured ix where it is currently passed to `send_ix`/`send_ixs`. If a test builds the ix inline, hoist it to a `let` first.

- [ ] **Step 7: Build and run — expect RED**

Run: `export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH" && anchor build --ignore-keys && cargo test -p hashlock --test test_laplace_e2e`
Expected: FAIL — `event IntentCreated not found in tx logs` (no `emit!` yet).

- [ ] **Step 8: Add `emit!` to the four handlers (GREEN)**

`create_intent.rs` — add `IntentCreated` to the `use crate::{...}` import, then build the event after the last field is set and emit after the asset-lock match (the lock fns consume `ctx`, so the event value is built first):
```rust
    intent.bump = ctx.bumps.intent;

    let created_event = IntentCreated {
        intent: ctx.accounts.intent.key(),
        id: ctx.accounts.intent.id,
        maker: ctx.accounts.intent.maker,
        receiver: ctx.accounts.intent.receiver,
        refund_recipient: ctx.accounts.intent.refund_recipient,
        criterion_program: ctx.accounts.intent.criterion_program,
        criterion_data_hash: ctx.accounts.intent.criterion_data_hash,
        criterion_interface_version: ctx.accounts.intent.criterion_interface_version,
        asset: ctx.accounts.intent.asset,
        amount: ctx.accounts.intent.amount,
        expiry_slot: ctx.accounts.intent.expiry_slot,
        created_slot: ctx.accounts.intent.created_slot,
    };

    match args.asset {
        EscrowAsset::NativeSol => lock_native_sol(ctx, args.amount)?,
        EscrowAsset::SplToken { .. } => lock_spl_tokens(ctx, args.amount)?,
    }

    emit!(created_event);
    Ok(())
```

`fulfill_with_criterion.rs` — add `IntentFulfilled` to the import; emit after the release match (`ctx` is still borrowed `&mut`, so readable):
```rust
    let asset = ctx.accounts.intent.asset;
    match asset {
        EscrowAsset::NativeSol => release_native_sol(&mut ctx, settlement_accounts)?,
        EscrowAsset::SplToken { .. } => release_spl_tokens(&mut ctx, settlement_accounts)?,
    }

    emit!(IntentFulfilled {
        intent: ctx.accounts.intent.key(),
        id: ctx.accounts.intent.id,
        maker: ctx.accounts.intent.maker,
        receiver: ctx.accounts.intent.receiver,
        criterion_program: ctx.accounts.intent.criterion_program,
        asset: ctx.accounts.intent.asset,
        amount: ctx.accounts.intent.amount,
        slot: Clock::get()?.slot,
    });

    Ok(())
```

`refund_expired_intent.rs` — add `IntentRefunded` to the import; emit after the refund match:
```rust
    let asset = ctx.accounts.intent.asset;
    match asset {
        EscrowAsset::NativeSol => refund_native_sol(&mut ctx)?,
        EscrowAsset::SplToken { .. } => refund_spl_tokens(&mut ctx)?,
    }

    emit!(IntentRefunded {
        intent: ctx.accounts.intent.key(),
        id: ctx.accounts.intent.id,
        maker: ctx.accounts.intent.maker,
        refund_recipient: ctx.accounts.intent.refund_recipient,
        asset: ctx.accounts.intent.asset,
        amount: ctx.accounts.intent.amount,
        slot: Clock::get()?.slot,
    });

    Ok(())
```

`close_intent.rs` — add `IntentClosed` to the import; emit **before** the asset match (Anchor `close = maker` deallocates after the handler returns; a failed SPL-vault close reverts the whole tx, discarding the log):
```rust
    require!(
        ctx.accounts.intent.status == IntentStatus::Fulfilled
            || ctx.accounts.intent.status == IntentStatus::Refunded,
        ErrorCode::IntentNotClosable
    );

    emit!(IntentClosed {
        intent: ctx.accounts.intent.key(),
        id: ctx.accounts.intent.id,
        maker: ctx.accounts.intent.maker,
        final_status: ctx.accounts.intent.status,
        slot: Clock::get()?.slot,
    });

    match ctx.accounts.intent.asset {
        EscrowAsset::NativeSol => {
            require!(
                ctx.remaining_accounts.is_empty(),
                ErrorCode::InvalidAssetAccounts
            );
            Ok(())
        }
        EscrowAsset::SplToken {
            token_program,
            vault,
            ..
        } => close_token_vault(ctx, vault, token_program),
    }
```

- [ ] **Step 9: Rebuild and run — expect GREEN**

Run: `export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH" && anchor build --ignore-keys && cargo test -p hashlock --test test_laplace_e2e`
Expected: PASS (all lifecycle event assertions satisfied).

- [ ] **Step 10: Commit**
```bash
git add programs/laplace/src/events.rs programs/laplace/src/lib.rs \
  programs/laplace/src/instructions/create_intent.rs \
  programs/laplace/src/instructions/fulfill_with_criterion.rs \
  programs/laplace/src/instructions/refund_expired_intent.rs \
  programs/laplace/src/instructions/close_intent.rs \
  programs/hashlock/Cargo.toml programs/hashlock/tests/test_laplace_e2e.rs Cargo.lock
git commit -m "feat(laplace): emit IntentCreated/Fulfilled/Refunded/Closed lifecycle events"
```

---

### Task 2: Validity config event (Rust program) — TDD via validity e2e

**Files:**
- Create: `programs/validity/src/events.rs`
- Modify: `programs/validity/src/lib.rs`, `programs/validity/src/create_validity.rs`
- Modify: `programs/validity/Cargo.toml` (dev-dep), `programs/validity/tests/test_laplace_e2e.rs`

- [ ] **Step 1: Create the event struct**

Create `programs/validity/src/events.rs`:
```rust
use anchor_lang::prelude::*;

#[event]
pub struct ValidityConfigCreated {
    pub config: Pubkey,
    pub config_hash: [u8; 32],
    pub guest_elf_hash: [u8; 32],
    pub sp1_vkey_hash: [u8; 32],
    pub fixed_public_inputs_len: u32,
    pub payer: Pubkey,
}
```

- [ ] **Step 2: Wire into `lib.rs`**

In `programs/validity/src/lib.rs`, add `pub mod events;` (after `pub mod create_validity;`) and `pub use events::*;` (after `pub use create_validity::*;`).

- [ ] **Step 3: Verify it compiles**

Run: `export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH" && cargo check -p validity`
Expected: PASS (unused-warning acceptable).

- [ ] **Step 4: Add base64 dev-dependency**

In `programs/validity/Cargo.toml` under `[dev-dependencies]`, add:
```toml
base64 = "0.22"
```

- [ ] **Step 5: Add helpers + failing assertion (RED)**

In `programs/validity/tests/test_laplace_e2e.rs` add the same `event_discriminator` + `decode_event` helpers from Task 1 Step 5, and a metadata-returning send. The existing `send_ixs` returns `Result<(), String>`; add:
```rust
fn send_ixs_meta(svm: &mut LiteSVM, payer: &Keypair, ixs: Vec<Instruction>) -> litesvm::types::TransactionMetadata {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&ixs, Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer]).unwrap();
    svm.send_transaction(tx).unwrap()
}
```
(Adjust the signer set to match the file's existing `send_ixs`.) In the test that creates a validity config (the one calling `create_validity_ix(...)`, ~line 205), capture the create-config send and assert:
```rust
let meta = send_ixs_meta(&mut svm, &payer, vec![create_cfg_ix]);
let ev: validity::ValidityConfigCreated = decode_event(&meta, "ValidityConfigCreated");
assert_eq!(ev.config, config_pda);
assert_eq!(ev.config_hash, config_hash);
assert_eq!(ev.payer, payer.pubkey());
```
> Bind `create_cfg_ix`/`config_pda`/`config_hash`/`payer` to the existing locals in that test (the ix currently passed to `send_ix`/`send_ixs`, the derived config PDA, the `args.config_hash`, and the fee payer).

- [ ] **Step 6: Build and run — expect RED**

Run: `export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH" && anchor build --ignore-keys && cargo test -p validity --test test_laplace_e2e`
Expected: FAIL — `event ValidityConfigCreated not found`.

- [ ] **Step 7: Emit the event (GREEN)**

In `programs/validity/src/create_validity.rs`, add `ValidityConfigCreated` to the `use crate::{...}` import and emit after `config.bump = ctx.bumps.config;`:
```rust
    config.bump = ctx.bumps.config;

    emit!(ValidityConfigCreated {
        config: ctx.accounts.config.key(),
        config_hash: ctx.accounts.config.config_hash,
        guest_elf_hash: ctx.accounts.config.guest_elf_hash,
        sp1_vkey_hash: ctx.accounts.config.sp1_vkey_hash,
        fixed_public_inputs_len: ctx.accounts.config.fixed_public_inputs.len() as u32,
        payer: ctx.accounts.payer.key(),
    });

    Ok(())
```

- [ ] **Step 8: Rebuild and run — expect GREEN**

Run: `export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH" && anchor build --ignore-keys && cargo test -p validity --test test_laplace_e2e`
Expected: PASS.

- [ ] **Step 9: Commit**
```bash
git add programs/validity/src/events.rs programs/validity/src/lib.rs \
  programs/validity/src/create_validity.rs programs/validity/Cargo.toml \
  programs/validity/tests/test_laplace_e2e.rs Cargo.lock
git commit -m "feat(validity): emit ValidityConfigCreated event"
```

---

### Task 3: Regenerate IDL + Codama client

**Files:** `target/idl/laplace.json`, `target/idl/validity.json`, `app/packages/sdk/src/generated/**` (regenerated)

- [ ] **Step 1: Rebuild IDL**

Run: `export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH" && anchor build --ignore-keys`
Expected: PASS.

- [ ] **Step 2: Confirm events landed in the IDL**

Run: `grep -c '"name": "IntentFulfilled"' target/idl/laplace.json && grep -c '"name": "ValidityConfigCreated"' target/idl/validity.json`
Expected: each prints `1` (or more).

- [ ] **Step 3: Re-run Codama codegen**

Run: `npm run codegen -w @laplace/sdk`
Expected: completes; `app/packages/sdk/src/generated` may show no diff (Codama `renderers-js@2.2.0` does not render events — expected; the decoder is hand-written in Task 4).

- [ ] **Step 4: Typecheck the SDK still builds**

Run: `npm run -s typecheck -w @laplace/sdk`
Expected: exit 0.

- [ ] **Step 5: Commit**
```bash
git add target/idl/laplace.json target/idl/validity.json app/packages/sdk/src/generated
git commit -m "chore(sdk): regenerate IDL + Codama client with lifecycle events"
```

---

### Task 4: SDK event decoder + unit tests (strict TDD)

**Files:**
- Create: `app/packages/sdk/src/events.ts`
- Create: `app/packages/sdk/test/events.test.ts`
- Modify: `app/packages/sdk/src/index.ts`

- [ ] **Step 1: Write the failing unit test**

Create `app/packages/sdk/test/events.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  getAddressEncoder, getStructEncoder, getBytesEncoder, fixEncoderSize,
  getU16Encoder, getU32Encoder, getU64Encoder,
} from '@solana/kit';
import { getEscrowAssetEncoder, getIntentStatusEncoder, IntentStatus } from '../src/generated/laplace/index.js';
import { parseLaplaceEvents, EVENT_DISCRIMINATORS } from '../src/events.js';

const PDA = '11111111111111111111111111111111';
const KEY = 'So11111111111111111111111111111111111111112';
const ID = new Uint8Array(32).fill(7);
const HASH = new Uint8Array(32).fill(9);

function programData(disc: Uint8Array, payload: Uint8Array): string {
  const data = new Uint8Array(disc.length + payload.length);
  data.set(disc, 0); data.set(payload, disc.length);
  return `Program data: ${Buffer.from(data).toString('base64')}`;
}

const fulfilledEncoder = getStructEncoder([
  ['intent', getAddressEncoder()],
  ['id', fixEncoderSize(getBytesEncoder(), 32)],
  ['maker', getAddressEncoder()],
  ['receiver', getAddressEncoder()],
  ['criterionProgram', getAddressEncoder()],
  ['asset', getEscrowAssetEncoder()],
  ['amount', getU64Encoder()],
  ['slot', getU64Encoder()],
]);

describe('parseLaplaceEvents', () => {
  it('decodes an IntentFulfilled event from a Program data log line', () => {
    const payload = fulfilledEncoder.encode({
      intent: PDA, id: ID, maker: KEY, receiver: KEY, criterionProgram: KEY,
      asset: { __kind: 'NativeSol' }, amount: 10_000n, slot: 42n,
    });
    const logs = [
      'Program log: Instruction: FulfillWithCriterion',
      programData(EVENT_DISCRIMINATORS.IntentFulfilled, new Uint8Array(payload)),
    ];
    const events = parseLaplaceEvents(logs);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'IntentFulfilled', intent: PDA, receiver: KEY, amount: 10_000n, slot: 42n });
  });

  it('ignores non-matching Program data lines', () => {
    const logs = [programData(new Uint8Array(8).fill(1), new Uint8Array([1, 2, 3]))];
    expect(parseLaplaceEvents(logs)).toHaveLength(0);
  });

  it('exposes the precomputed Anchor discriminators', () => {
    expect(Array.from(EVENT_DISCRIMINATORS.IntentCreated)).toEqual([184,46,156,205,169,254,11,108]);
    expect(Array.from(EVENT_DISCRIMINATORS.ValidityConfigCreated)).toEqual([136,66,149,229,23,83,60,14]);
  });
});
```

- [ ] **Step 2: Run the test — expect RED**

Run: `npm run -s test -w @laplace/sdk -- events`
Expected: FAIL — cannot resolve `../src/events.js`.

- [ ] **Step 3: Implement the decoder**

Create `app/packages/sdk/src/events.ts`:
```ts
// Hand-written Anchor event decoder. Codama renderers-js@2.2.0 does NOT render events, so this is
// intentionally manual and is the source of truth — `npm run codegen` will not regenerate it.
// Mirrors the on-chain #[event] structs in programs/laplace/src/events.rs and
// programs/validity/src/events.rs (Borsh field order must match exactly).
import {
  type Address, type ReadonlyUint8Array, type Decoder,
  getStructDecoder, getAddressDecoder, getBytesDecoder, fixDecoderSize,
  getU16Decoder, getU32Decoder, getU64Decoder,
} from '@solana/kit';
import { sha256 } from '@noble/hashes/sha256';
import {
  getEscrowAssetDecoder, getIntentStatusDecoder, type EscrowAsset, type IntentStatus,
} from './generated/laplace/index.js';

const utf8 = (s: string) => new TextEncoder().encode(s);
function disc(name: string): Uint8Array { return sha256(utf8(`event:${name}`)).slice(0, 8); }
const bytes32 = () => fixDecoderSize(getBytesDecoder(), 32);

export const EVENT_DISCRIMINATORS = {
  IntentCreated: disc('IntentCreated'),
  IntentFulfilled: disc('IntentFulfilled'),
  IntentRefunded: disc('IntentRefunded'),
  IntentClosed: disc('IntentClosed'),
  ValidityConfigCreated: disc('ValidityConfigCreated'),
} as const;

export interface IntentCreatedEvent {
  intent: Address; id: ReadonlyUint8Array; maker: Address; receiver: Address;
  refundRecipient: Address; criterionProgram: Address; criterionDataHash: ReadonlyUint8Array;
  criterionInterfaceVersion: number; asset: EscrowAsset; amount: bigint; expirySlot: bigint; createdSlot: bigint;
}
export interface IntentFulfilledEvent {
  intent: Address; id: ReadonlyUint8Array; maker: Address; receiver: Address;
  criterionProgram: Address; asset: EscrowAsset; amount: bigint; slot: bigint;
}
export interface IntentRefundedEvent {
  intent: Address; id: ReadonlyUint8Array; maker: Address; refundRecipient: Address;
  asset: EscrowAsset; amount: bigint; slot: bigint;
}
export interface IntentClosedEvent {
  intent: Address; id: ReadonlyUint8Array; maker: Address; finalStatus: IntentStatus; slot: bigint;
}
export interface ValidityConfigCreatedEvent {
  config: Address; configHash: ReadonlyUint8Array; guestElfHash: ReadonlyUint8Array;
  sp1VkeyHash: ReadonlyUint8Array; fixedPublicInputsLen: number; payer: Address;
}

export type LaplaceEvent =
  | ({ kind: 'IntentCreated' } & IntentCreatedEvent)
  | ({ kind: 'IntentFulfilled' } & IntentFulfilledEvent)
  | ({ kind: 'IntentRefunded' } & IntentRefundedEvent)
  | ({ kind: 'IntentClosed' } & IntentClosedEvent)
  | ({ kind: 'ValidityConfigCreated' } & ValidityConfigCreatedEvent);

const intentCreatedDecoder: Decoder<IntentCreatedEvent> = getStructDecoder([
  ['intent', getAddressDecoder()], ['id', bytes32()], ['maker', getAddressDecoder()],
  ['receiver', getAddressDecoder()], ['refundRecipient', getAddressDecoder()],
  ['criterionProgram', getAddressDecoder()], ['criterionDataHash', bytes32()],
  ['criterionInterfaceVersion', getU16Decoder()], ['asset', getEscrowAssetDecoder()],
  ['amount', getU64Decoder()], ['expirySlot', getU64Decoder()], ['createdSlot', getU64Decoder()],
]);
const intentFulfilledDecoder: Decoder<IntentFulfilledEvent> = getStructDecoder([
  ['intent', getAddressDecoder()], ['id', bytes32()], ['maker', getAddressDecoder()],
  ['receiver', getAddressDecoder()], ['criterionProgram', getAddressDecoder()],
  ['asset', getEscrowAssetDecoder()], ['amount', getU64Decoder()], ['slot', getU64Decoder()],
]);
const intentRefundedDecoder: Decoder<IntentRefundedEvent> = getStructDecoder([
  ['intent', getAddressDecoder()], ['id', bytes32()], ['maker', getAddressDecoder()],
  ['refundRecipient', getAddressDecoder()], ['asset', getEscrowAssetDecoder()],
  ['amount', getU64Decoder()], ['slot', getU64Decoder()],
]);
const intentClosedDecoder: Decoder<IntentClosedEvent> = getStructDecoder([
  ['intent', getAddressDecoder()], ['id', bytes32()], ['maker', getAddressDecoder()],
  ['finalStatus', getIntentStatusDecoder()], ['slot', getU64Decoder()],
]);
const validityConfigCreatedDecoder: Decoder<ValidityConfigCreatedEvent> = getStructDecoder([
  ['config', getAddressDecoder()], ['configHash', bytes32()], ['guestElfHash', bytes32()],
  ['sp1VkeyHash', bytes32()], ['fixedPublicInputsLen', getU32Decoder()], ['payer', getAddressDecoder()],
]);

const TABLE: { kind: LaplaceEvent['kind']; disc: Uint8Array; decoder: Decoder<any> }[] = [
  { kind: 'IntentCreated', disc: EVENT_DISCRIMINATORS.IntentCreated, decoder: intentCreatedDecoder },
  { kind: 'IntentFulfilled', disc: EVENT_DISCRIMINATORS.IntentFulfilled, decoder: intentFulfilledDecoder },
  { kind: 'IntentRefunded', disc: EVENT_DISCRIMINATORS.IntentRefunded, decoder: intentRefundedDecoder },
  { kind: 'IntentClosed', disc: EVENT_DISCRIMINATORS.IntentClosed, decoder: intentClosedDecoder },
  { kind: 'ValidityConfigCreated', disc: EVENT_DISCRIMINATORS.ValidityConfigCreated, decoder: validityConfigCreatedDecoder },
];

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Decode all recognized Laplace lifecycle events from a transaction's log messages. */
export function parseLaplaceEvents(logs: readonly string[]): LaplaceEvent[] {
  const out: LaplaceEvent[] = [];
  for (const line of logs) {
    const m = /^Program data: (.+)$/.exec(line);
    if (!m) continue;
    let data: Uint8Array;
    try { data = new Uint8Array(Buffer.from(m[1], 'base64')); } catch { continue; }
    if (data.length < 8) continue;
    const head = data.subarray(0, 8);
    const entry = TABLE.find((e) => bytesEqual(head, e.disc));
    if (!entry) continue;
    out.push({ kind: entry.kind, ...entry.decoder.decode(data.subarray(8)) });
  }
  return out;
}

/** Fetch a confirmed transaction by signature and decode its Laplace events. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAndParseEvents(rpc: any, signature: string): Promise<LaplaceEvent[]> {
  const tx = await rpc
    .getTransaction(signature, { maxSupportedTransactionVersion: 0, encoding: 'json', commitment: 'confirmed' })
    .send();
  const logs: string[] = tx?.meta?.logMessages ?? [];
  return parseLaplaceEvents(logs);
}
```

- [ ] **Step 4: Export from the SDK barrel**

In `app/packages/sdk/src/index.ts`, add after the `links.js` export:
```ts
export * from './events.js';
```

- [ ] **Step 5: Run the test — expect GREEN**

Run: `npm run -s test -w @laplace/sdk -- events`
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck**

Run: `npm run -s typecheck -w @laplace/sdk`
Expected: exit 0.

- [ ] **Step 7: Commit**
```bash
git add app/packages/sdk/src/events.ts app/packages/sdk/test/events.test.ts app/packages/sdk/src/index.ts
git commit -m "feat(sdk): hand-written lifecycle event decoder (parseLaplaceEvents)"
```

---

### Task 5: SDK integration test against localnet (real on-chain bytes)

**Files:** Create `app/packages/sdk/test/integration/events.test.ts`

- [ ] **Step 1: Write the gated integration test**

Create `app/packages/sdk/test/integration/events.test.ts` (mirrors the existing `integration/*` setup; uses `RUN` gate from `localnet.ts`):
```ts
import { describe, it, expect } from 'vitest';
import { RUN } from './localnet.js';
import { makeClientAndFunding, createHashlockIntent } from './helpers.js';
import { fetchAndParseEvents } from '../../src/events.js';

// Proves the hand-written decoder matches REAL on-chain event bytes (not just self-consistency).
describe.runIf(RUN)('events (localnet)', () => {
  it('decodes IntentCreated from a real createIntent transaction', async () => {
    const { laplace, rpc, maker } = await makeClientAndFunding();
    const { signature, intentPda } = await createHashlockIntent(laplace, maker);
    const events = await fetchAndParseEvents(rpc, signature);
    const created = events.find((e) => e.kind === 'IntentCreated');
    expect(created).toBeDefined();
    expect(created!.intent).toBe(intentPda);
    expect(created!.maker).toBe(maker.address);
  });
});
```
> Reuse the existing integration harness. Read `app/packages/sdk/test/integration/helpers.ts` and `localnet.ts`; if a `makeClientAndFunding`/`createHashlockIntent` equivalent already exists under a different name, use it. If not, build the client + a hashlock `createIntent` exactly as `hashlock-sol.test.ts` does, returning `{ signature, intentPda }` and exposing the `rpc`.

- [ ] **Step 2: Run gated test (no validator → skipped)**

Run: `npm run -s test -w @laplace/sdk -- integration/events`
Expected: PASS (0 ran / skipped) when `LAPLACE_LOCALNET` is unset — confirms it compiles and the gate works.

- [ ] **Step 3 (optional, if a localnet validator is available): run live**

Run (separate shell): `solana-test-validator` then deploy the rebuilt programs, then
`LAPLACE_LOCALNET=1 npm run -s test -w @laplace/sdk -- integration/events`
Expected: PASS — `IntentCreated` decodes with the correct intent PDA + maker.

- [ ] **Step 4: Commit**
```bash
git add app/packages/sdk/test/integration/events.test.ts
git commit -m "test(sdk): localnet integration test decoding real lifecycle events"
```

---

### Task 6: Devnet redeploy + verify

- [ ] **Step 1: Build (frozen) and deploy the upgraded programs**

Run:
```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
anchor build --ignore-keys
scripts/deploy.sh devnet ~/.config/solana/devnet-deployer.json
```
Expected: each program redeploys at its existing ID (upgrade in place).

- [ ] **Step 2: Verify on-chain**

Run: `scripts/verify-deploy.sh devnet`
Expected: all three programs show the deployer as Authority and a new `Last Deployed In Slot`.

- [ ] **Step 3: (No commit)** — bytecode is on-chain; the IDL was committed in Task 3.

---

## Self-Review

**Spec coverage:**
- §4.1/4.2 laplace events + emit points → Task 1. ✓
- §4.3 `ValidityConfigCreated` → Task 2. ✓
- §5 hand-written SDK decoder + `parseLaplaceEvents`/`fetchAndParseEvents` + barrel export → Task 4. ✓
- §6 Rust e2e log assertions → Tasks 1–2; TS unit round-trip → Task 4; TS integration → Task 5. ✓
- §7 IDL regen + Codama + devnet redeploy → Tasks 3, 6. ✓
- §3 decision 1 (`emit!`, no account/layout change) → no field added, no `event-cpi`; account-count/memcmp tests untouched. ✓
- §3 decision 2 (no `settled_slot`) → no Intent layout change in any task. ✓

**Placeholder scan:** No "TBD"/"handle edge cases"/empty test bodies — every code step contains full code; discriminators are precomputed constants. The only deferred items are explicitly-labeled optional/contingent steps (Task 5 Step 3 live run; integration-harness name reuse), with concrete fallbacks.

**Type consistency:** Rust event field names match the on-chain struct field order used by the decoders; SDK camelCase keys (`refundRecipient`, `criterionProgram`, `criterionDataHash`, `finalStatus`, `fixedPublicInputsLen`) are consistent between `events.ts` interfaces, decoders, and the unit test; `EVENT_DISCRIMINATORS` keys match the `LaplaceEvent['kind']` union and the Rust `event:<Name>` strings.
