import type { Cluster, CriterionEntry, TrustTier } from './types.js';
import { PROGRAM_IDS } from './constants.js';

// Per-cluster program IDs for an official criterion. Only the clusters where the program is
// deployed are listed (localnet + devnet placeholders for now); mainnet-beta is omitted until launch.
const perCluster = (k: 'hashlock' | 'validity'): Partial<Record<Cluster, string>> => ({
  localnet: PROGRAM_IDS[k], devnet: PROGRAM_IDS[k],
});

export const criteria: CriterionEntry[] = [
  { key: 'hashlock', name: 'Hashlock', kind: 'Preimage',
    desc: 'Releases when a preimage hashing to a committed digest is revealed on-chain. The primitive behind atomic swaps.',
    tier: 'official', programId: perCluster('hashlock'), stateful: false, criterionAccountCount: 0,
    fulfillmentKind: 'preimage',
    commitment: 'criterion_data_hash = SHA256(intent_binding_hash(req) ‖ hash_fn_id ‖ SHA256(secret))',
    verify: 'SHA256(intent_binding_hash(req) ‖ hash_fn_id ‖ SHA256(fulfillment_data)) == criterion_data_hash',
    conformance: { binds: 'full', enforcement: 'adapter', accounts: 0, interfaceVersion: 2,
      note: 'Adapter-enforced intent-binding: recomputes intent_binding_hash(req) and rejects on mismatch. The shared secret still unlocks every leg of an atomic swap.' },
    warnings: ['Revealing a preimage on-chain is public and irreversible — it lands in transaction calldata.'],
    docsUrl: '/docs#hashlock' },
  { key: 'validity', name: 'Validity · SP1', kind: 'ZK proof',
    desc: 'Releases against a Groth16-wrapped SP1 proof verified on-chain by a committed verifying key.',
    tier: 'official', programId: perCluster('validity'), stateful: true, criterionAccountCount: 1,
    fulfillmentKind: 'sp1-proof', commitment: 'criterion_data_hash = config_hash',
    verify: 'sp1_verify(proof, intent_binding_hash(req) ‖ fixed_public_inputs ‖ suffix, vkey_hash) && config_hash == hash_config(...)',
    conformance: { binds: 'full', enforcement: 'adapter', accounts: 1, interfaceVersion: 2,
      note: 'Adapter-enforced intent-binding prefix: adapter prepends intent_binding_hash(req) to the public inputs before verification, so a proof bound to one intent cannot verify for another.' },
    docsUrl: '/docs#validity' },
];

export function getCriteria(filter?: { cluster?: Cluster; tier?: TrustTier }): CriterionEntry[] {
  return criteria.filter((c) => {
    if (filter?.tier && c.tier !== filter.tier) return false;
    if (filter?.cluster) {
      const id = c.programId[filter.cluster];
      if (id == null || id === '') return false; // treat empty/absent as "not on this cluster"
    }
    return true;
  });
}
export function getCriterion(key: string): CriterionEntry | undefined {
  return criteria.find((c) => c.key === key);
}
export function isOfficial(programId: string, cluster: Cluster): boolean {
  return criteria.some((c) => c.tier === 'official' && c.programId[cluster] === programId);
}
export function tierOf(programId: string, cluster: Cluster): TrustTier {
  return criteria.find((c) => c.programId[cluster] === programId)?.tier ?? 'unverified';
}
