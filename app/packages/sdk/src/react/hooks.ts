import * as React from 'react';
import type { Address } from '@solana/kit';
import { useLaplaceContext } from './context.js';
import { Laplace } from '../client.js';
import { fetchIntents, fetchIntent, type ResolvedIntent } from '../queries.js';

export function useSlot(): bigint { return useLaplaceContext().currentSlot; }
export function useClient(): Laplace {
  const { rpc, rpcSubscriptions, cluster } = useLaplaceContext();
  return React.useMemo(() => new Laplace({ rpc, rpcSubscriptions, cluster }), [rpc, rpcSubscriptions, cluster]);
}
export function useIntents(args: { role: 'maker' | 'receiver' | 'refund' | 'all' }) {
  const { rpc, cluster, signer } = useLaplaceContext();
  const [data, setData] = React.useState<ResolvedIntent[]>([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let live = true;
    if (!signer) { setData([]); setLoading(false); return; }
    setLoading(true);
    fetchIntents(rpc, { role: args.role, owner: signer.address, cluster })
      .then((r) => { if (live) { setData(r); setLoading(false); } })
      .catch(() => { if (live) { setData([]); setLoading(false); } });
    return () => { live = false; };
  }, [rpc, cluster, signer?.address, args.role]);
  return { data, loading };
}
export function useIntent(pda: Address | undefined) {
  const { rpc } = useLaplaceContext();
  const [data, setData] = React.useState<ResolvedIntent | null>(null);
  React.useEffect(() => {
    let live = true;
    if (!pda) { setData(null); return; }
    // A freshly-created intent may not be readable on the queried RPC node for a moment, so
    // fetchIntent can reject with "intent not found". Swallow it (no uncaught rejection) and keep
    // polling — a one-shot read that misses the propagation window would otherwise stay null forever.
    const load = () =>
      fetchIntent(rpc, pda)
        .then((r) => { if (live) setData(r); })
        .catch(() => { /* not readable yet — keep the last value, retry on the next tick */ });
    load();
    const h = setInterval(load, 8000);
    return () => { live = false; clearInterval(h); };
  }, [rpc, pda]);
  return data;
}
