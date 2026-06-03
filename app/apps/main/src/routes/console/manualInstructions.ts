import { laplaceProgram, validityProgram, hashlockProgram } from '@laplace/sdk/raw';
import { hexToBytes } from './createState';

/**
 * A single input on a manual instruction's generic form.
 * `account: true`  → a pubkey that becomes an instruction account meta.
 * otherwise        → an arg encoded into the instruction data.
 * `kind` drives the parse: address (string), u64 (BigInt), u8 (Number),
 * bytes (hex → Uint8Array).
 */
export interface Field {
  name: string;
  kind: 'address' | 'u64' | 'bytes' | 'u8';
  account?: boolean;
}

/**
 * A program instruction exposed in the manual ops console. `build` consumes the
 * raw string form values and returns a `@solana/kit` Instruction via the
 * generated `@laplace/sdk/raw` builder for that program.
 */
export interface ManualInstr {
  key: string;
  program: 'laplace' | 'validity' | 'hashlock';
  label: string;
  fields: Field[];
  build: (vals: Record<string, string>) => any;
}

/** Parse a bytes field (hex, optional 0x prefix). Empty → empty Uint8Array. */
function bytes(v: string | undefined): Uint8Array {
  return hexToBytes((v ?? '').trim().replace(/^0x/i, ''));
}
/** Parse a u64 field as a bigint (empty → 0n). */
function u64(v: string | undefined): bigint {
  return BigInt((v ?? '').trim() || '0');
}
/** Parse a u8 field as a number (empty → 0). */
function u8(v: string | undefined): number {
  return Number((v ?? '').trim() || '0');
}

/**
 * Build the `EscrowAsset` union the criterion-verification instructions carry.
 * assetKind 1 (or "spl") → SplToken { mint, tokenProgram, vault }; else NativeSol.
 */
function asset(v: Record<string, string>) {
  const kind = (v.assetKind ?? '').trim().toLowerCase();
  if (kind === '1' || kind === 'spl' || kind === 'spltoken') {
    return {
      __kind: 'SplToken' as const,
      mint: (v.assetMint ?? '') as any,
      tokenProgram: (v.assetTokenProgram ?? '') as any,
      vault: (v.assetVault ?? '') as any,
    };
  }
  return { __kind: 'NativeSol' as const };
}

/** The `EscrowAsset` form fields shared by the criterion-verification builders. */
const ASSET_FIELDS: Field[] = [
  { name: 'assetKind', kind: 'u8' },
  { name: 'assetMint', kind: 'address' },
  { name: 'assetTokenProgram', kind: 'address' },
  { name: 'assetVault', kind: 'address' },
];

export const MANUAL_INSTRUCTIONS: ManualInstr[] = [
  // ── laplace (5) ──────────────────────────────────────────────────────────
  {
    key: 'initialize',
    program: 'laplace',
    label: 'initialize',
    fields: [],
    build: () => laplaceProgram.getInitializeInstruction(),
  },
  {
    key: 'create_intent',
    program: 'laplace',
    label: 'create_intent',
    fields: [
      { name: 'maker', kind: 'address', account: true },
      { name: 'intent', kind: 'address', account: true },
      { name: 'id', kind: 'bytes' },
      { name: 'receiver', kind: 'address' },
      { name: 'refundRecipient', kind: 'address' },
      { name: 'criterionProgram', kind: 'address' },
      ...ASSET_FIELDS,
      { name: 'amount', kind: 'u64' },
      { name: 'expirySlot', kind: 'u64' },
      { name: 'criterionDataHash', kind: 'bytes' },
    ],
    build: (v) =>
      laplaceProgram.getCreateIntentInstruction({
        maker: v.maker as any,
        intent: v.intent as any,
        id: bytes(v.id),
        receiver: v.receiver as any,
        refundRecipient: v.refundRecipient as any,
        criterionProgram: v.criterionProgram as any,
        asset: asset(v),
        amount: u64(v.amount),
        expirySlot: u64(v.expirySlot),
        criterionDataHash: bytes(v.criterionDataHash),
      }),
  },
  {
    key: 'fulfill_with_criterion',
    program: 'laplace',
    label: 'fulfill_with_criterion',
    fields: [
      { name: 'intent', kind: 'address', account: true },
      { name: 'receiver', kind: 'address', account: true },
      { name: 'criterionProgram', kind: 'address', account: true },
      { name: 'fulfillmentData', kind: 'bytes' },
      { name: 'criterionAccountCount', kind: 'u8' },
    ],
    build: (v) =>
      laplaceProgram.getFulfillWithCriterionInstruction({
        intent: v.intent as any,
        receiver: v.receiver as any,
        criterionProgram: v.criterionProgram as any,
        fulfillmentData: bytes(v.fulfillmentData),
        criterionAccountCount: u8(v.criterionAccountCount),
      }),
  },
  {
    key: 'refund_expired_intent',
    program: 'laplace',
    label: 'refund_expired_intent',
    fields: [
      { name: 'intent', kind: 'address', account: true },
      { name: 'refundRecipient', kind: 'address', account: true },
    ],
    build: (v) =>
      laplaceProgram.getRefundExpiredIntentInstruction({
        intent: v.intent as any,
        refundRecipient: v.refundRecipient as any,
      }),
  },
  {
    key: 'close_intent',
    program: 'laplace',
    label: 'close_intent',
    fields: [
      { name: 'intent', kind: 'address', account: true },
      { name: 'maker', kind: 'address', account: true },
    ],
    build: (v) =>
      laplaceProgram.getCloseIntentInstruction({ intent: v.intent as any, maker: v.maker as any }),
  },

  // ── validity (2) ─────────────────────────────────────────────────────────
  {
    key: 'create_validity',
    program: 'validity',
    label: 'create_validity',
    fields: [
      { name: 'payer', kind: 'address', account: true },
      { name: 'config', kind: 'address', account: true },
      { name: 'configHash', kind: 'bytes' },
      { name: 'guestElfHash', kind: 'bytes' },
      { name: 'sp1VkeyHash', kind: 'bytes' },
      { name: 'fixedPublicInputs', kind: 'bytes' },
    ],
    build: (v) =>
      validityProgram.getCreateValidityInstruction({
        payer: v.payer as any,
        config: v.config as any,
        configHash: bytes(v.configHash),
        guestElfHash: bytes(v.guestElfHash),
        sp1VkeyHash: bytes(v.sp1VkeyHash),
        fixedPublicInputs: bytes(v.fixedPublicInputs),
      }),
  },
  {
    key: 'verify_criterion (validity)',
    program: 'validity',
    label: 'verify_criterion',
    fields: [
      { name: 'config', kind: 'address', account: true },
      { name: 'interfaceVersion', kind: 'u8' },
      { name: 'protocolProgram', kind: 'address' },
      { name: 'intent', kind: 'address' },
      { name: 'intentId', kind: 'bytes' },
      { name: 'maker', kind: 'address' },
      { name: 'receiver', kind: 'address' },
      { name: 'refundRecipient', kind: 'address' },
      ...ASSET_FIELDS,
      { name: 'amount', kind: 'u64' },
      { name: 'expirySlot', kind: 'u64' },
      { name: 'createdSlot', kind: 'u64' },
      { name: 'criterionProgram', kind: 'address' },
      { name: 'criterionDataHash', kind: 'bytes' },
      { name: 'fulfillmentData', kind: 'bytes' },
    ],
    build: (v) =>
      validityProgram.getVerifyCriterionInstruction({
        config: v.config as any,
        interfaceVersion: u8(v.interfaceVersion),
        protocolProgram: v.protocolProgram as any,
        intent: v.intent as any,
        intentId: bytes(v.intentId),
        maker: v.maker as any,
        receiver: v.receiver as any,
        refundRecipient: v.refundRecipient as any,
        asset: asset(v),
        amount: u64(v.amount),
        expirySlot: u64(v.expirySlot),
        createdSlot: u64(v.createdSlot),
        criterionProgram: v.criterionProgram as any,
        criterionDataHash: bytes(v.criterionDataHash),
        fulfillmentData: bytes(v.fulfillmentData),
      }),
  },

  // ── hashlock (1) ─────────────────────────────────────────────────────────
  {
    key: 'verify_criterion (hashlock)',
    program: 'hashlock',
    label: 'verify_criterion',
    fields: [
      { name: 'interfaceVersion', kind: 'u8' },
      { name: 'protocolProgram', kind: 'address' },
      { name: 'intent', kind: 'address' },
      { name: 'intentId', kind: 'bytes' },
      { name: 'maker', kind: 'address' },
      { name: 'receiver', kind: 'address' },
      { name: 'refundRecipient', kind: 'address' },
      ...ASSET_FIELDS,
      { name: 'amount', kind: 'u64' },
      { name: 'expirySlot', kind: 'u64' },
      { name: 'createdSlot', kind: 'u64' },
      { name: 'criterionProgram', kind: 'address' },
      { name: 'criterionDataHash', kind: 'bytes' },
      { name: 'fulfillmentData', kind: 'bytes' },
    ],
    build: (v) =>
      hashlockProgram.getVerifyCriterionInstruction({
        interfaceVersion: u8(v.interfaceVersion),
        protocolProgram: v.protocolProgram as any,
        intent: v.intent as any,
        intentId: bytes(v.intentId),
        maker: v.maker as any,
        receiver: v.receiver as any,
        refundRecipient: v.refundRecipient as any,
        asset: asset(v),
        amount: u64(v.amount),
        expirySlot: u64(v.expirySlot),
        createdSlot: u64(v.createdSlot),
        criterionProgram: v.criterionProgram as any,
        criterionDataHash: bytes(v.criterionDataHash),
        fulfillmentData: bytes(v.fulfillmentData),
      }),
  },
];
