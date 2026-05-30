import {
  type Address,
  type ReadonlyUint8Array,
  address,
  AccountRole,
  getStructEncoder,
  addEncoderSizePrefix,
  getBytesEncoder,
  getU32Encoder,
} from '@solana/kit';
import { sha256 } from '@noble/hashes/sha256';
import { getCluster, type Cluster } from '@laplace/registry';
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
export interface CriterionSpec {
  key: string;
  resolve(cluster: Cluster): PreparedCriterion;
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
    return {
      key: 'hashlock',
      resolve(cluster) {
        const programId = address(getCluster(cluster).programs.hashlock);
        if ('hash' in args) return { programId, criterionDataHash: args.hash };
        const secret = args.secret ?? randomSecret();
        return { programId, criterionDataHash: sha256(secret as Uint8Array), secret };
      },
    };
  },
  validity(
    args:
      | { configHash: ReadonlyUint8Array }
      | { guestElfHash: ReadonlyUint8Array; sp1VkeyHash: ReadonlyUint8Array; fixedPublicInputs: ReadonlyUint8Array },
  ): CriterionSpec {
    return {
      key: 'validity',
      resolve(cluster) {
        const programId = address(getCluster(cluster).programs.validity);
        const criterionDataHash =
          'configHash' in args
            ? args.configHash
            : hashConfig(args.guestElfHash, args.sp1VkeyHash, args.fixedPublicInputs);
        return { programId, criterionDataHash };
      },
    };
  },
  custom(args: { programId: Address; criterionDataHash: ReadonlyUint8Array }): CriterionSpec {
    return {
      key: 'custom',
      resolve: () => ({ programId: args.programId, criterionDataHash: args.criterionDataHash }),
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
