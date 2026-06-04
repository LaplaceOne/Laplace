import type { Address } from '@solana/kit';
import type { Cluster } from '@laplace-one/registry';

export function intentShareLink(pda: Address, cluster: Cluster): string {
  return `/app/i/${pda}?cluster=${cluster}`; // secrets never travel in URLs (spec §7)
}
