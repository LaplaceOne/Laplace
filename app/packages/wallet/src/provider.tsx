import * as React from 'react';
import { createSolanaRpc, createSolanaRpcSubscriptions, type TransactionSigner } from '@solana/kit';
import { LaplaceSdkProvider } from '@laplace/sdk/react';
import type { Cluster } from '@laplace/registry';
import { resolveRpcUrl } from './cluster.js';
import { createSlotClock } from './slot-clock.js';

export function LaplaceProvider({ cluster, rpcUrl, signer, children }: {
  cluster: Cluster; rpcUrl?: string; signer?: TransactionSigner; children: React.ReactNode;
}) {
  const url = resolveRpcUrl(cluster, rpcUrl);
  const rpc = React.useMemo(() => createSolanaRpc(url), [url]);
  const rpcSubscriptions = React.useMemo(() => createSolanaRpcSubscriptions(url.replace(/^http/, 'ws')), [url]);
  const [currentSlot, setSlot] = React.useState<bigint>(0n);
  React.useEffect(() => {
    const clock = createSlotClock(rpc as any);
    const unsub = clock.subscribe(setSlot);
    return () => { unsub(); clock.dispose(); };
  }, [rpc]);
  return (
    <LaplaceSdkProvider value={{ rpc, rpcSubscriptions, cluster, currentSlot, signer }}>
      {children}
    </LaplaceSdkProvider>
  );
}
