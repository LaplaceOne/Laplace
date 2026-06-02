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
  HASH_FUNCTION_ID_SHA256,
} from '../constants.js';
import type { EscrowAssetInput } from '../asset.js';
import { hashConfig } from './hash-config.js';
import { intentBindingHash, concatBytes, u16be, u64be, encodeAssetCanonical } from '../binding.js';

export interface PreparedCriterion {
  programId: Address;
  criterionDataHash: ReadonlyUint8Array;
  /** Always set — the `intentBindingHash(ctx)` value for this intent. */
  bindingTag: ReadonlyUint8Array;
  /**
   * Set by validity (= bindingTag). The SP1 guest MUST commit this as its leading 32 public-input
   * bytes; the adapter prepends it before on-chain verification.
   */
  requiredPublicInputPrefix?: ReadonlyUint8Array;
  secret?: ReadonlyUint8Array;
}
export interface FulfillmentParts {
  data: ReadonlyUint8Array;
  criterionAccounts: { address: Address; role: AccountRole }[];
  criterionAccountCount: number;
}

// The intent context a criterion needs to compute its (possibly intent-bound) commitment.
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

// Re-export helpers for callers that imported them from here previously.
export { concatBytes, u16be, u64be };

const addr = getAddressEncoder();

/**
 * Hashlock commitment using the shared universal binding primitive:
 *   SHA256(intent_binding_hash(ctx) ‖ hash_fn_id ‖ SHA256(secret))
 *
 * Mirrors `programs/hashlock/src/verify_criterion.rs :: hash_hashlock_commitment`
 * after adoption of the shared `laplace::binding::intent_binding_hash`.
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
  const ctx: CommitContext = {
    cluster: 'localnet', // cluster not used in intentBindingHash computation
    criterionProgram: input.criterionProgram,
    interfaceVersion: input.interfaceVersion,
    intentId: input.intentId,
    maker: input.maker,
    receiver: input.receiver,
    refundRecipient: input.refundRecipient,
    asset: input.asset,
    amount: input.amount,
    expirySlot: input.expirySlot,
  };
  const bindingTag = intentBindingHash(ctx);
  return sha256(concatBytes([bindingTag, new Uint8Array([HASH_FUNCTION_ID_SHA256]), input.hashlock]));
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
        const bindingTag = intentBindingHash(ctx);
        return {
          programId: ctx.criterionProgram,
          criterionDataHash: sha256(concatBytes([bindingTag, new Uint8Array([HASH_FUNCTION_ID_SHA256]), hashlock])),
          bindingTag,
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
    const criterionDataHash =
      'configHash' in args
        ? Uint8Array.from(args.configHash)
        : hashConfig(args.guestElfHash, args.sp1VkeyHash, args.fixedPublicInputs);
    return {
      key: 'validity',
      programId: (cluster) => address(getCluster(cluster).programs.validity),
      prepare: (ctx) => {
        const bindingTag = intentBindingHash(ctx);
        return {
          programId: ctx.criterionProgram,
          criterionDataHash,
          bindingTag,
          requiredPublicInputPrefix: bindingTag,
        };
      },
    };
  },
  custom(
    args:
      | { programId: Address; criterionDataHash: ReadonlyUint8Array }
      | { programId: Address; bind: (tag: Uint8Array) => Uint8Array },
  ): CriterionSpec {
    return {
      key: 'custom',
      programId: () => args.programId,
      prepare: (ctx) => {
        const bindingTag = intentBindingHash(ctx);
        const criterionDataHash =
          'criterionDataHash' in args ? args.criterionDataHash : args.bind(Uint8Array.from(bindingTag));
        return { programId: args.programId, criterionDataHash, bindingTag };
      },
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
