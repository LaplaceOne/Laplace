import {
  type Address,
  type Instruction,
  type ReadonlyUint8Array,
  type TransactionSigner,
} from '@solana/kit';
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstructionAsync } from '@solana-program/token';
import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import {
  getCreateIntentInstruction,
  getFulfillWithCriterionInstruction,
  getRefundExpiredIntentInstruction,
  getCloseIntentInstruction,
  type Intent,
  type EscrowAssetArgs,
} from './generated/laplace/index.js';
import { getCreateValidityInstruction } from './generated/validity/index.js';
import { intentPda, validityConfigPda } from './pdas.js';
import { hashConfig, type FulfillmentParts, type PreparedCriterion } from './criteria/index.js';
import type { EscrowAssetInput } from './asset.js';
import { withRemaining, W, R, type Meta } from './internal/remaining.js';

export interface BuiltTx { instructions: Instruction[]; }

function randomId(): Uint8Array { const b = new Uint8Array(32); crypto.getRandomValues(b); return b; }

// ADAPTATION: The generated getCreateIntentInstruction takes a FLAT input object —
// all instruction data fields (id, receiver, etc.) are top-level alongside the account
// fields (maker, intent), NOT nested under an 'args' key as the plan assumed.
// systemProgram is optional and auto-defaults to 11111111111111111111111111111111.
export async function buildCreateIntent(args: {
  maker: TransactionSigner; receiver: Address; refundRecipient?: Address;
  asset: EscrowAssetInput; amount: bigint; expirySlot: bigint; criterion: PreparedCriterion;
  id?: ReadonlyUint8Array;
}): Promise<BuiltTx & { intentPda: Address; id: Uint8Array; secret?: Uint8Array }> {
  const id = (args.id ? Uint8Array.from(args.id) : randomId());
  const [intent] = await intentPda(args.maker.address, id);

  let assetArg: EscrowAssetArgs; let remaining: Meta[] = []; const pre: Instruction[] = [];
  if ('sol' in args.asset) {
    assetArg = { __kind: 'NativeSol' };
  } else {
    const { mint, tokenProgram } = args.asset.spl;
    const [vault] = await findAssociatedTokenPda({ owner: intent, mint, tokenProgram });
    const [makerAta] = await findAssociatedTokenPda({ owner: args.maker.address, mint, tokenProgram });
    assetArg = { __kind: 'SplToken', mint, tokenProgram, vault };
    // On-chain create_intent requires the vault token account to already exist (owner = intent PDA,
    // balance 0) before transferring into it. Prepend an idempotent ATA creation so an SPL
    // createIntent works standalone in a single transaction.
    pre.push(await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: args.maker, owner: intent, mint, tokenProgram }));
    remaining = [{ address: makerAta, role: W }, { address: vault, role: W }, { address: mint, role: R }, { address: tokenProgram, role: R }];
  }

  // Flat input — no 'args' nesting. systemProgram auto-defaults.
  const ix = getCreateIntentInstruction({
    maker: args.maker,
    intent,
    id: Uint8Array.from(id),
    receiver: args.receiver,
    refundRecipient: args.refundRecipient ?? args.maker.address,
    criterionProgram: args.criterion.programId,
    asset: assetArg,
    amount: args.amount,
    expirySlot: args.expirySlot,
    criterionDataHash: Uint8Array.from(args.criterion.criterionDataHash),
  });
  return {
    instructions: [...pre, withRemaining(ix, remaining)],
    intentPda: intent,
    id,
    secret: args.criterion.secret ? Uint8Array.from(args.criterion.secret) : undefined,
  };
}

// ADAPTATION: getFulfillWithCriterionInstruction takes flat input with intent (Address),
// receiver (Address), criterionProgram (Address), fulfillmentData, criterionAccountCount.
// No 'fulfiller' signer account — the instruction only has intent, receiver, criterionProgram.
export async function buildFulfillIntent(args: {
  fulfiller: TransactionSigner; intent: Intent; intentAddress: Address; fulfillment: FulfillmentParts;
  computeUnitLimit?: number;
}): Promise<BuiltTx> {
  const settlement: Meta[] = []; const pre: Instruction[] = [];
  // A validity/SP1 fulfill runs on-chain Groth16 verification (~270-350k CU), over the 200k default,
  // so the caller passes a raised limit; placed first in the tx.
  if (args.computeUnitLimit) pre.push(getSetComputeUnitLimitInstruction({ units: args.computeUnitLimit }));
  if (args.intent.asset.__kind === 'SplToken') {
    const { mint, tokenProgram, vault } = args.intent.asset;
    const [receiverAta] = await findAssociatedTokenPda({ owner: args.intent.receiver, mint, tokenProgram });
    // Ensure the receiver's ATA exists before the vault releases tokens into it.
    pre.push(await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: args.fulfiller, owner: args.intent.receiver, mint, tokenProgram }));
    settlement.push({ address: vault, role: W }, { address: receiverAta, role: W }, { address: mint, role: R }, { address: tokenProgram, role: R });
  }
  const ix = getFulfillWithCriterionInstruction({
    intent: args.intentAddress,
    receiver: args.intent.receiver,
    criterionProgram: args.intent.criterionProgram,
    fulfillmentData: args.fulfillment.data,
    criterionAccountCount: args.fulfillment.criterionAccountCount,
  });
  return { instructions: [...pre, withRemaining(ix, [...args.fulfillment.criterionAccounts, ...settlement])] };
}

// ADAPTATION: getRefundExpiredIntentInstruction takes flat input with intent (Address)
// and refundRecipient (Address). No data args (empty args).
export async function buildRefundExpiredIntent(args: { cranker: TransactionSigner; intent: Intent; intentAddress: Address }): Promise<BuiltTx> {
  const remaining: Meta[] = []; const pre: Instruction[] = [];
  if (args.intent.asset.__kind === 'SplToken') {
    const { mint, tokenProgram, vault } = args.intent.asset;
    const [refundAta] = await findAssociatedTokenPda({ owner: args.intent.refundRecipient, mint, tokenProgram });
    // Ensure the refund recipient's ATA exists before the vault releases tokens into it.
    pre.push(await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: args.cranker, owner: args.intent.refundRecipient, mint, tokenProgram }));
    remaining.push({ address: vault, role: W }, { address: refundAta, role: W }, { address: mint, role: R }, { address: tokenProgram, role: R });
  }
  const ix = getRefundExpiredIntentInstruction({ intent: args.intentAddress, refundRecipient: args.intent.refundRecipient });
  return { instructions: [...pre, withRemaining(ix, remaining)] };
}

// ADAPTATION: getCloseIntentInstruction takes { intent: Address, maker: TransactionSigner }.
// maker is a signer. No data args (empty args).
export async function buildCloseIntent(args: { maker: TransactionSigner; intent: Intent; intentAddress: Address }): Promise<BuiltTx> {
  const remaining: Meta[] = [];
  if (args.intent.asset.__kind === 'SplToken') {
    const { tokenProgram, vault } = args.intent.asset;
    remaining.push({ address: vault, role: W }, { address: tokenProgram, role: R });
  }
  const ix = getCloseIntentInstruction({ intent: args.intentAddress, maker: args.maker });
  return { instructions: [withRemaining(ix, remaining)] };
}

// ADAPTATION: getCreateValidityInstruction takes flat input — payer (TransactionSigner),
// config (Address), systemProgram (optional, auto-defaults), configHash, guestElfHash,
// sp1VkeyHash, fixedPublicInputs — NOT nested under 'args'.
export async function buildCreateValidityConfig(args: {
  payer: TransactionSigner; guestElfHash: ReadonlyUint8Array; sp1VkeyHash: ReadonlyUint8Array; fixedPublicInputs: ReadonlyUint8Array;
}): Promise<BuiltTx & { configPda: Address; configHash: Uint8Array }> {
  const configHash = hashConfig(args.guestElfHash, args.sp1VkeyHash, args.fixedPublicInputs);
  const [config] = await validityConfigPda(configHash);
  const ix = getCreateValidityInstruction({
    payer: args.payer,
    config,
    configHash,
    guestElfHash: args.guestElfHash,
    sp1VkeyHash: args.sp1VkeyHash,
    fixedPublicInputs: args.fixedPublicInputs,
  });
  return { instructions: [ix], configPda: config, configHash };
}
