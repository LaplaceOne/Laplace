import { getCluster, type Cluster } from '@laplace-one/registry';

export interface IndexerConfig {
  cluster: Cluster;
  rpcUrl: string;
  databaseUrl: string;
  pollIntervalMs: number;
  startSlot: bigint | null;
  commitment: 'processed' | 'confirmed' | 'finalized';
  apiPort: number;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): IndexerConfig {
  const cluster = (env.LAPLACE_CLUSTER ?? 'devnet') as Cluster;
  return {
    cluster,
    rpcUrl: env.LAPLACE_RPC_URL ?? getCluster(cluster).rpcUrl,
    databaseUrl: env.DATABASE_URL ?? 'memory://',
    pollIntervalMs: Number(env.POLL_INTERVAL_MS ?? '5000'),
    startSlot: env.START_SLOT ? BigInt(env.START_SLOT) : null,
    commitment: (env.COMMITMENT ?? 'finalized') as IndexerConfig['commitment'],
    apiPort: Number(env.API_PORT ?? '8787'),
  };
}
