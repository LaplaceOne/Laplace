import { criteria, type Cluster, type TrustTier } from '@laplace/registry';

export function criterionLabel(programId: string, cluster: Cluster): { name: string; tier: TrustTier | 'unknown' } {
  const entry = criteria.find((c) => c.programId?.[cluster] === programId);
  if (entry) return { name: entry.name, tier: entry.tier };
  return { name: `${programId.slice(0, 4)}…${programId.slice(-4)}`, tier: 'unknown' };
}
