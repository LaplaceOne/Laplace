/**
 * Universal intent-binding primitive — byte-for-byte mirror of
 * `programs/laplace/src/binding.rs :: intent_binding_hash_from_parts`.
 *
 * Every criterion MUST derive its accept/reject decision from this value so
 * that a fulfillment accepted for intent A cannot be replayed against intent B.
 */
import { sha256 } from '@noble/hashes/sha256';
import { getAddressEncoder, type ReadonlyUint8Array } from '@solana/kit';
import type { CommitContext } from './criteria/index.js';

// -------------------------------------------------------------------------
// Byte helpers (moved here from criteria/index.ts — kept in sync)
// -------------------------------------------------------------------------

export function u16be(n: number): Uint8Array {
  if (!Number.isInteger(n) || n < 0 || n > 0xffff) throw new Error(`u16be: value out of u16 range: ${n}`);
  return new Uint8Array([(n >> 8) & 0xff, n & 0xff]);
}

export function u64be(n: bigint): Uint8Array {
  if (n < 0n || n > 0xffff_ffff_ffff_ffffn) throw new Error(`u64be: value out of u64 range: ${n}`);
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n, false);
  return b;
}

export function concatBytes(parts: ReadonlyUint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const addrEnc = getAddressEncoder();

/**
 * Encode asset canonically:
 *   NativeSol → `[0]`
 *   SplToken  → `[1] ‖ mint(32) ‖ tokenProgram(32)`
 * The vault is excluded — it is a deterministic ATA of the intent PDA + mint.
 */
export function encodeAssetCanonical(asset: CommitContext['asset']): Uint8Array {
  if ('sol' in asset) return new Uint8Array([0]);
  return concatBytes([new Uint8Array([1]), addrEnc.encode(asset.spl.mint), addrEnc.encode(asset.spl.tokenProgram)]);
}

// -------------------------------------------------------------------------
// Domain constant (mirror of binding.rs INTENT_BINDING_DOMAIN)
// -------------------------------------------------------------------------

/** UTF-8 domain separator — must equal `b"laplace-intent-bind-v1"` in binding.rs. Precomputed once. */
const DOMAIN_BYTES = new TextEncoder().encode('laplace-intent-bind-v1');

// -------------------------------------------------------------------------
// Core primitive
// -------------------------------------------------------------------------

/**
 * `intentBindingHash` — canonical, replay-resistant 32-byte binding over an intent's identity.
 *
 * ```
 * SHA256(
 *   INTENT_BINDING_DOMAIN          (utf8 "laplace-intent-bind-v1")
 *   ‖ u16be(interfaceVersion)
 *   ‖ criterionProgram             (32 bytes)
 *   ‖ intentId                     (32 bytes)
 *   ‖ maker                        (32 bytes)
 *   ‖ receiver                     (32 bytes)
 *   ‖ refundRecipient              (32 bytes)
 *   ‖ asset_canonical              ([0] = SOL; [1] ‖ mint ‖ tokenProgram = SPL)
 *   ‖ u64be(amount)
 *   ‖ u64be(expirySlot)
 * )
 * ```
 */
export function intentBindingHash(ctx: CommitContext): Uint8Array {
  if (ctx.intentId.length !== 32)
    throw new Error(`intentBindingHash: intentId must be 32 bytes, got ${ctx.intentId.length}`);
  return sha256(
    concatBytes([
      DOMAIN_BYTES,
      u16be(ctx.interfaceVersion),
      addrEnc.encode(ctx.criterionProgram),
      ctx.intentId,
      addrEnc.encode(ctx.maker),
      addrEnc.encode(ctx.receiver),
      addrEnc.encode(ctx.refundRecipient),
      encodeAssetCanonical(ctx.asset),
      u64be(ctx.amount),
      u64be(ctx.expirySlot),
    ]),
  );
}

// -------------------------------------------------------------------------
// Optional client-side guard
// -------------------------------------------------------------------------

/**
 * Verify that a proof's public inputs match the expected layout before submitting.
 * Reconstructs `bindingTag ‖ fixedPublicInputs ‖ suffix` and throws on mismatch.
 *
 * @param ctx            - the intent's commit context (used to derive bindingTag)
 * @param fixedPublicInputs - the ValidityConfig's fixed public inputs
 * @param suffix         - the fulfiller-supplied suffix
 * @param proofPublicInputs - the full public inputs embedded in the proof
 */
export function assertBoundPublicInputs(args: {
  ctx: CommitContext;
  fixedPublicInputs: ReadonlyUint8Array;
  suffix: ReadonlyUint8Array;
  proofPublicInputs: ReadonlyUint8Array;
}): void {
  const { ctx, fixedPublicInputs, suffix, proofPublicInputs } = args;
  const bindingTag = intentBindingHash(ctx);
  const expected = concatBytes([bindingTag, fixedPublicInputs, suffix]);
  if (expected.length !== proofPublicInputs.length) {
    throw new Error(
      `assertBoundPublicInputs: length mismatch — expected ${expected.length}, got ${proofPublicInputs.length}`,
    );
  }
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== proofPublicInputs[i]) {
      throw new Error(
        `assertBoundPublicInputs: mismatch at byte ${i} — expected 0x${expected[i]!.toString(16).padStart(2, '0')}, got 0x${proofPublicInputs[i]!.toString(16).padStart(2, '0')}`,
      );
    }
  }
}
