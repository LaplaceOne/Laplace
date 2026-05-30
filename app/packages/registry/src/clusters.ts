import type { Cluster, ClusterConfig } from './types.js';
import { PROGRAM_IDS } from './constants.js';

// localnet/devnet share the same placeholder program IDs until devnet is deployed (spec §11);
// mainnet-beta carries the placeholders too until launch. Source of truth: PROGRAM_IDS.
export const clusters: ClusterConfig[] = [
  { cluster: 'localnet', rpcUrl: 'http://127.0.0.1:8899',
    programs: { ...PROGRAM_IDS }, stablecoins: [] },
  { cluster: 'devnet', rpcUrl: 'https://api.devnet.solana.com',
    programs: { ...PROGRAM_IDS }, stablecoins: [] },
  { cluster: 'mainnet-beta', rpcUrl: 'https://api.mainnet-beta.solana.com',
    programs: { ...PROGRAM_IDS }, stablecoins: [] },
];

export function getCluster(c: Cluster): ClusterConfig {
  const found = clusters.find((x) => x.cluster === c);
  if (!found) throw new Error(`Unknown cluster: ${c}`);
  return found;
}
