import * as React from 'react';
import { useLaplaceContext } from '@laplace-one/sdk/react';

export function useWalletBalance(): number | null {
  const { rpc, signer, currentSlot } = useLaplaceContext() as any;
  const [sol, setSol] = React.useState<number | null>(null);
  React.useEffect(() => {
    let live = true;
    if (!signer?.address) { setSol(null); return; }
    rpc.getBalance(signer.address).send()
      .then((r: any) => { if (live) setSol(Number(r.value) / 1e9); })
      .catch(() => {});
    return () => { live = false; };
  }, [rpc, signer?.address, currentSlot]);  // refresh on slot tick
  return sol;
}
