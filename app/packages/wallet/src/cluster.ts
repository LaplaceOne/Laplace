import { getCluster, type Cluster } from '@laplace-one/registry';
export function resolveRpcUrl(cluster: Cluster, override?: string): string {
  return override ?? getCluster(cluster).rpcUrl;
}
export const DEFAULT_CLUSTER: Cluster = 'devnet';
