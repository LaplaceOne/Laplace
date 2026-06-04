import type { Cluster } from '@laplace-one/registry';

export const env = {
  cluster: (import.meta.env.VITE_CLUSTER ?? 'devnet') as Cluster,
  rpcUrl: import.meta.env.VITE_RPC_URL as string | undefined,
  indexerUrl: import.meta.env.VITE_INDEXER_URL as string | undefined,
};
