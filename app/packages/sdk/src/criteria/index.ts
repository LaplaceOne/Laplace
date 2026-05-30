import {
  type Address,
  type ReadonlyUint8Array,
  address,
  AccountRole,
  getAddressEncoder,
  getStructEncoder,
  addEncoderSizePrefix,
  getBytesEncoder,
  getU32Encoder,
} from '@solana/kit';
import { sha256 } from '@noble/hashes/sha256';
import { getCluster, type Cluster } from '@laplace/registry';
import {
  CRITERION_INTERFACE_VERSION,
  HASHLOCK_COMMITMENT_DOMAIN,
  HASH_FUNCTION_ID_SHA256,
} from '../constants.js';
import type { EscrowAssetInput } from '../asset.js';
import { hashConfig } from './hash-config.js';

export interface PreparedCriterion {
  programId: Address;
  criterionDataHash: ReadonlyUint8Array;
  secret?: ReadonlyUint8Array;
}
export interface FulfillmentParts {
  data: ReadonlyUint8Array;
  criterionAccounts: { address: Address; role: AccountRole }[];
  criterionAccountCount: number;
}

// The intent context a criterion needs to compute its (possibly intent-bound) commitment. Hashlock
// binds these fields; validity/custom ignore them (validity binds via SP1 public inputs).
export interface CommitContext {
  cluster: Cluster;
  criterionProgram: Address;
  interfaceVersion: number;
  intentId: ReadonlyUint8Array;
  maker: Address;
  receiver: Address;
  refundRecipient: Address;
  asset: EscrowAssetInput;
  amount: bigint;
  expirySlot: bigint;
}
export interface CriterionSpec {
  key: string;
  programId(cluster: Cluster): Address;
  prepare(ctx: CommitContext): PreparedCriterion;
}

const addr = getAddressEncoder();
const u16be = (n: number) => new Uint8Array([(n >> 8) & 0xff, n & 0xff]);
function u64be(n: bigint): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n, false);
  return b;
}
function concatBytes(parts: ReadonlyUint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/**
 * Intent-bound hashlock commitment — byte-for-byte mirror of `hashlock::hash_hashlock_commitment`:
 * SHA256(domain ‖ u16be(version) ‖ criterion_program ‖ intent_id ‖ maker ‖ receiver ‖ refund_recipient
 *        ‖ asset ‖ u64be(amount) ‖ u64be(expiry_slot) ‖ hash_fn_id ‖ hashlock), where
 * hashlock = SHA256(secret) and asset = [0] (SOL) or [1]‖mint‖tokenProgram (SPL, vault excluded).
 */
export function hashHashlockCommitment(input: {
  interfaceVersion: number;
  criterionProgram: Address;
  intentId: ReadonlyUint8Array;
  maker: Address;
  receiver: Address;
  refundRecipient: Address;
  asset: EscrowAssetInput;
  amount: bigint;
  expirySlot: bigint;
  hashlock: ReadonlyUint8Array;
}): Uint8Array {
  const assetBytes =
    'sol' in input.asset
      ? new Uint8Array([0])
      : concatBytes([new Uint8Array([1]), addr.encode(input.asset.spl.mint), addr.encode(input.asset.spl.tokenProgram)]);
  return sha256(
    concatBytes([
      HASHLOCK_COMMITMENT_DOMAIN,
      u16be(input.interfaceVersion),
      addr.encode(input.criterionProgram),
      input.intentId,
      addr.encode(input.maker),
      addr.encode(input.receiver),
      addr.encode(input.refundRecipient),
      assetBytes,
      u64be(input.amount),
      u64be(input.expirySlot),
      new Uint8Array([HASH_FUNCTION_ID_SHA256]),
      input.hashlock,
    ]),
  );
}

// borsh ValidityFulfillment { proof: Vec<u8>, public_inputs_suffix: Vec<u8> } — u32-le length-prefixed.
const validityFulfillmentEncoder = getStructEncoder([
  ['proof', addEncoderSizePrefix(getBytesEncoder(), getU32Encoder())],
  ['publicInputsSuffix', addEncoderSizePrefix(getBytesEncoder(), getU32Encoder())],
]);

function randomSecret(): Uint8Array {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return b;
}

export const Condition = {
  hashlock(args: { secret?: ReadonlyUint8Array } | { hash: ReadonlyUint8Array }): CriterionSpec {
    // Resolve the secret (if any) and the inner hashlock h = SHA256(secret) once.
    const secret = 'hash' in args ? undefined : Uint8Array.from(args.secret ?? randomSecret());
    const hashlock = 'hash' in args ? Uint8Array.from(args.hash) : sha256(secret!);
    return {
      key: 'hashlock',
      programId: (cluster) => address(getCluster(cluster).programs.hashlock),
      prepare(ctx) {
        return {
          programId: ctx.criterionProgram,
          criterionDataHash: hashHashlockCommitment({
            interfaceVersion: ctx.interfaceVersion,
            criterionProgram: ctx.criterionProgram,
            intentId: ctx.intentId,
            maker: ctx.maker,
            receiver: ctx.receiver,
            refundRecipient: ctx.refundRecipient,
            asset: ctx.asset,
            amount: ctx.amount,
            expirySlot: ctx.expirySlot,
            hashlock,
          }),
          secret,
        };
      },
    };
  },
  validity(
    args:
      | { configHash: ReadonlyUint8Array }
      | { guestElfHash: ReadonlyUint8Array; sp1VkeyHash: ReadonlyUint8Array; fixedPublicInputs: ReadonlyUint8Array },
  ): CriterionSpec {
    // Validity binds intent fields through its SP1 public inputs, not the criterion_data_hash, so it
    // ignores the intent context here.
    const criterionDataHash =
      'configHash' in args
        ? Uint8Array.from(args.configHash)
        : hashConfig(args.guestElfHash, args.sp1VkeyHash, args.fixedPublicInputs);
    return {
      key: 'validity',
      programId: (cluster) => address(getCluster(cluster).programs.validity),
      prepare: (ctx) => ({ programId: ctx.criterionProgram, criterionDataHash }),
    };
  },
  custom(args: { programId: Address; criterionDataHash: ReadonlyUint8Array }): CriterionSpec {
    return {
      key: 'custom',
      programId: () => args.programId,
      prepare: () => ({ programId: args.programId, criterionDataHash: args.criterionDataHash }),
    };
  },
};

export function hashlockFulfillment(args: { secret: ReadonlyUint8Array }): FulfillmentParts {
  return { data: args.secret, criterionAccounts: [], criterionAccountCount: 0 };
}

export function validityFulfillment(args: {
  proof: ReadonlyUint8Array;
  publicInputsSuffix: ReadonlyUint8Array;
  configPda: Address;
}): FulfillmentParts {
  const data = validityFulfillmentEncoder.encode({
    proof: args.proof as Uint8Array,
    publicInputsSuffix: args.publicInputsSuffix as Uint8Array,
  });
  return {
    data,
    criterionAccounts: [{ address: args.configPda, role: AccountRole.READONLY }],
    criterionAccountCount: 1,
  };
}

export { hashConfig };
