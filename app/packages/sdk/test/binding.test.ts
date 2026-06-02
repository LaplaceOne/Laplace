/**
 * Rust↔TS parity vectors for `intentBindingHash`.
 *
 * Expected hashes are locked-in from `programs/laplace/src/binding.rs` tests
 * (`sol_stability_vector` and `spl_stability_vector`). If either assertion fails,
 * the canonical byte layout has diverged between Rust and TypeScript.
 */
import { describe, it, expect } from 'vitest';
import { sha256 } from '@noble/hashes/sha256';
import { address } from '@solana/kit';
import { intentBindingHash, assertBoundPublicInputs, concatBytes } from '../src/binding.js';
import { Condition, hashHashlockCommitment, type CommitContext } from '../src/criteria/index.js';

// Fixtures mirror programs/laplace/src/binding.rs sol_args() and spl_args().
// Addresses are base58 of repeated-byte pubkeys:
//   [0x01;32] → 4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi
//   [0x03;32] → CktRuQ2mttgRGkXJtyksdKHjUdc2C4TgDzyB98oEzy8
//   [0x04;32] → GgBaCs3NCBuZN12kCJgAW63ydqohFkHEdfdEXBPzLHq
//   [0x05;32] → LbUiWL3xVV8hTFYBVdbTNrpDo41NKS6o3LHHuDzjfcY
//   [0xaa;32] → CVDFLCAjXhVWiPXH9nTCTpCgVzmDVoiPzNJYuccr1dqB
//   [0xbb;32] → DdqGmK5uamYN5vmuZrzpQhKeehLdwtPLVJdhu5P2iJKC
const CP = address('4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi');
const MAKER = address('CktRuQ2mttgRGkXJtyksdKHjUdc2C4TgDzyB98oEzy8');
const RECEIVER = address('GgBaCs3NCBuZN12kCJgAW63ydqohFkHEdfdEXBPzLHq');
const RR = address('LbUiWL3xVV8hTFYBVdbTNrpDo41NKS6o3LHHuDzjfcY');
const MINT = address('CVDFLCAjXhVWiPXH9nTCTpCgVzmDVoiPzNJYuccr1dqB');
const TOKEN_PROGRAM = address('DdqGmK5uamYN5vmuZrzpQhKeehLdwtPLVJdhu5P2iJKC');
const INTENT_ID = new Uint8Array(32).fill(0x02);

function solCtx(): CommitContext {
  return {
    cluster: 'localnet',
    criterionProgram: CP,
    interfaceVersion: 2,
    intentId: INTENT_ID,
    maker: MAKER,
    receiver: RECEIVER,
    refundRecipient: RR,
    asset: { sol: true },
    amount: 1_000_000_000n,
    expirySlot: 500_000n,
  };
}

function splCtx(): CommitContext {
  return {
    cluster: 'localnet',
    criterionProgram: CP,
    interfaceVersion: 2,
    intentId: INTENT_ID,
    maker: MAKER,
    receiver: RECEIVER,
    refundRecipient: RR,
    asset: { spl: { mint: MINT, tokenProgram: TOKEN_PROGRAM } },
    amount: 50_000_000n,
    expirySlot: 750_000n,
  };
}

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

describe('intentBindingHash — Rust↔TS parity vectors', () => {
  // These expected values are locked-in from programs/laplace/src/binding.rs.
  // A mismatch here means the canonical byte layout has diverged.

  it('SOL stability vector matches Rust', () => {
    const got = intentBindingHash(solCtx());
    expect(hex(got)).toBe('e58282acb895cf6f1cfd851a63462465b9c9a8209c883feca9c6132891655051');
  });

  it('SPL stability vector matches Rust', () => {
    const got = intentBindingHash(splCtx());
    expect(hex(got)).toBe('44f9b4056fb98817cef04357a163d90c06538f6b9e542033b8d6e43bb5059dcd');
  });

  it('hashlock commitment vector matches Rust: SHA256(tag ‖ 0x00 ‖ SHA256(secret))', () => {
    // SAME inputs + expected bytes as programs/hashlock/tests/test_hashlock.rs
    // hashlock_commitment_cross_language_vector. A mismatch means the hashlock commitment layout
    // diverged between Rust and TS.
    const EXPECTED = '78920cfbcca9866d7eaff064cd5e30357ac7cd74c2b76d9535192e72d30968c4';
    const secret = new Uint8Array(32).fill(0x42);
    const c = solCtx();
    // The mirror helper:
    const viaHelper = hashHashlockCommitment({
      interfaceVersion: c.interfaceVersion,
      criterionProgram: c.criterionProgram,
      intentId: c.intentId,
      maker: c.maker,
      receiver: c.receiver,
      refundRecipient: c.refundRecipient,
      asset: c.asset,
      amount: c.amount,
      expirySlot: c.expirySlot,
      hashlock: sha256(secret),
    });
    expect(hex(viaHelper)).toBe(EXPECTED);
    // And the real Condition.hashlock code path must produce the same commitment:
    const prepared = Condition.hashlock({ secret }).prepare(c);
    expect(hex(prepared.criterionDataHash)).toBe(EXPECTED);
  });

  it('SOL != SPL (asset encoding distinguishes native from token)', () => {
    expect(hex(intentBindingHash(solCtx()))).not.toBe(hex(intentBindingHash(splCtx())));
  });

  it('per-field sensitivity: interfaceVersion', () => {
    const base = solCtx();
    const h1 = intentBindingHash(base);
    const h2 = intentBindingHash({ ...base, interfaceVersion: base.interfaceVersion + 1 });
    expect(hex(h1)).not.toBe(hex(h2));
  });

  it('per-field sensitivity: criterionProgram', () => {
    const base = solCtx();
    // Different criterion program → different hash
    const h1 = intentBindingHash(base);
    const h2 = intentBindingHash({ ...base, criterionProgram: address('DdqGmK5uamYN5vmuZrzpQhKeehLdwtPLVJdhu5P2iJKC') });
    expect(hex(h1)).not.toBe(hex(h2));
  });

  it('per-field sensitivity: intentId', () => {
    const base = solCtx();
    const h1 = intentBindingHash(base);
    const mutId = new Uint8Array(base.intentId);
    mutId[0] ^= 0xff;
    const h2 = intentBindingHash({ ...base, intentId: mutId });
    expect(hex(h1)).not.toBe(hex(h2));
  });

  it('per-field sensitivity: maker', () => {
    const base = solCtx();
    const h1 = intentBindingHash(base);
    const h2 = intentBindingHash({ ...base, maker: address('DdqGmK5uamYN5vmuZrzpQhKeehLdwtPLVJdhu5P2iJKC') });
    expect(hex(h1)).not.toBe(hex(h2));
  });

  it('per-field sensitivity: receiver', () => {
    const base = solCtx();
    const h1 = intentBindingHash(base);
    const h2 = intentBindingHash({ ...base, receiver: address('DdqGmK5uamYN5vmuZrzpQhKeehLdwtPLVJdhu5P2iJKC') });
    expect(hex(h1)).not.toBe(hex(h2));
  });

  it('per-field sensitivity: refundRecipient', () => {
    const base = solCtx();
    const h1 = intentBindingHash(base);
    const h2 = intentBindingHash({ ...base, refundRecipient: address('DdqGmK5uamYN5vmuZrzpQhKeehLdwtPLVJdhu5P2iJKC') });
    expect(hex(h1)).not.toBe(hex(h2));
  });

  it('per-field sensitivity: amount', () => {
    const base = solCtx();
    const h1 = intentBindingHash(base);
    const h2 = intentBindingHash({ ...base, amount: base.amount + 1n });
    expect(hex(h1)).not.toBe(hex(h2));
  });

  it('per-field sensitivity: expirySlot', () => {
    const base = solCtx();
    const h1 = intentBindingHash(base);
    const h2 = intentBindingHash({ ...base, expirySlot: base.expirySlot + 1n });
    expect(hex(h1)).not.toBe(hex(h2));
  });
});

describe('assertBoundPublicInputs', () => {
  it('passes when proofPublicInputs = bindingTag || fixed || suffix', () => {
    const ctx = solCtx();
    const bindingTag = intentBindingHash(ctx);
    const fixed = new Uint8Array([1, 2, 3]);
    const suffix = new Uint8Array([4, 5]);
    const proofPublicInputs = concatBytes([bindingTag, fixed, suffix]);
    expect(() => assertBoundPublicInputs({ ctx, fixedPublicInputs: fixed, suffix, proofPublicInputs })).not.toThrow();
  });

  it('throws on length mismatch', () => {
    const ctx = solCtx();
    const fixed = new Uint8Array([1]);
    const suffix = new Uint8Array([2]);
    const proofPublicInputs = new Uint8Array(10); // wrong length
    expect(() => assertBoundPublicInputs({ ctx, fixedPublicInputs: fixed, suffix, proofPublicInputs })).toThrow('length mismatch');
  });

  it('throws when a byte differs', () => {
    const ctx = solCtx();
    const bindingTag = intentBindingHash(ctx);
    const fixed = new Uint8Array([1, 2, 3]);
    const suffix = new Uint8Array([4, 5]);
    const proofPublicInputs = concatBytes([bindingTag, fixed, suffix]);
    proofPublicInputs[35] ^= 0xff; // corrupt one byte
    expect(() => assertBoundPublicInputs({ ctx, fixedPublicInputs: fixed, suffix, proofPublicInputs })).toThrow('mismatch at byte');
  });

  it('throws when proofPublicInputs uses a different intentId (wrong binding tag)', () => {
    const ctx = solCtx();
    const wrongCtx = { ...ctx, intentId: new Uint8Array(32).fill(0x99) };
    const wrongTag = intentBindingHash(wrongCtx);
    const fixed = new Uint8Array([1]);
    const suffix = new Uint8Array([2]);
    const proofPublicInputs = concatBytes([wrongTag, fixed, suffix]);
    expect(() => assertBoundPublicInputs({ ctx, fixedPublicInputs: fixed, suffix, proofPublicInputs })).toThrow();
  });
});
