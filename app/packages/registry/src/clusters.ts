import type { Cluster, ClusterConfig } from './types.js';
import { PROGRAM_IDS } from './constants.js';

// Program IDs are identical across clusters (the program keypair fixes the address); deployed on
// localnet + devnet, same IDs reserved for mainnet-beta at launch. Source of truth: PROGRAM_IDS.
export const clusters: ClusterConfig[] = [
  { cluster: 'localnet', rpcUrl: 'http://127.0.0.1:8899', programs: { ...PROGRAM_IDS } },
  { cluster: 'devnet', rpcUrl: 'https://api.devnet.solana.com', programs: { ...PROGRAM_IDS } },
  { cluster: 'mainnet-beta', rpcUrl: 'https://api.mainnet-beta.solana.com', programs: { ...PROGRAM_IDS } },
];

export function getCluster(c: Cluster): ClusterConfig {
  const found = clusters.find((x) => x.cluster === c);
  if (!found) throw new Error(`Unknown cluster: ${c}`);
  return found;
}
