import * as React from 'react';
import type { TransactionSigner } from '@solana/kit';
import type { Cluster } from '@laplace-one/registry';

export interface LaplaceContextValue {
  rpc: any; rpcSubscriptions: any; cluster: Cluster; currentSlot: bigint; signer?: TransactionSigner;
}
const Ctx = React.createContext<LaplaceContextValue | null>(null);
export function LaplaceSdkProvider({ value, children }: { value: LaplaceContextValue; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useLaplaceContext(): LaplaceContextValue {
  const v = React.useContext(Ctx);
  if (!v) throw new Error('useLaplaceContext must be used within a LaplaceSdkProvider (or @laplace-one/wallet LaplaceProvider)');
  return v;
}
