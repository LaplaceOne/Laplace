import * as React from 'react';
import { useLaplaceContext } from '@laplace/sdk/react';
import { fetchIntents, fetchIntent } from '@laplace/sdk';
import type { IntentView } from '@laplace/ui';
import { useIndexer } from './IndexerProvider';
import { fromIndexerRow, fromResolved } from '../intent/adapters';
import type { IntentDetail, Stats, ValidityConfigRow } from './indexerClient';

export type Role = 'maker' | 'receiver' | 'refund' | 'all';

function ownerParam(role: Role, owner: string): { maker?: string; receiver?: string } {
  if (role === 'maker') return { maker: owner };
  if (role === 'receiver') return { receiver: owner };
  return {}; // 'refund' has no indexer column filter; client-side filter below. 'all' = none.
}

export function useIntentList({ role, status }: { role: Role; status?: 'active' | 'fulfilled' | 'refunded' }) {
  const idx = useIndexer();
  const { rpc, cluster, signer } = useLaplaceContext() as any;
  const owner: string | undefined = signer?.address ? String(signer.address) : undefined;
  const [data, setData] = React.useState<IntentView[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let live = true;
    setLoading(true);
    (async () => {
      let views: IntentView[] = [];
      if (idx && (await idx.health())) {
        const rows = await idx.listIntents({ ...ownerParam(role, owner ?? ''), status, limit: 100 });
        views = rows.map(fromIndexerRow);
        if (role === 'refund' && owner) views = views.filter((v) => v.refundRecipient === owner);
      } else if (owner) {
        const sdkRole = role === 'all' ? 'all' : role === 'refund' ? 'refund' : role;
        const resolved = await fetchIntents(rpc, { role: sdkRole as any, owner: owner as any, cluster });
        views = resolved.map(fromResolved);
      }
      if (live) { setData(views); setLoading(false); }
    })().catch(() => { if (live) { setData([]); setLoading(false); } });
    return () => { live = false; };
  }, [idx, rpc, cluster, owner, role, status]);

  return { data, loading };
}

export function useIntentDetail(pda: string | undefined) {
  const idx = useIndexer();
  const { rpc } = useLaplaceContext() as any;
  const [detail, setDetail] = React.useState<{ view: IntentView; timeline: IntentDetail['timeline'] } | null>(null);
  const mounted = React.useRef(true);

  // The indexer carries the timeline (past event signatures/slots); the on-chain account carries the
  // freshest status. The cron can lag a couple of minutes behind a just-submitted fulfill/refund, so
  // take status from chain (it is never behind) and the timeline from the indexer. `refresh` lets an
  // action update the status the instant its tx confirms, instead of waiting for the next poll.
  const load = React.useCallback(async () => {
    if (!pda) { setDetail(null); return; }
    let timeline: IntentDetail['timeline'] = [];
    let view: IntentView | null = null;
    if (idx && (await idx.health())) {
      const d = await idx.getIntent(pda);
      if (d) { timeline = d.timeline; view = fromIndexerRow(d.intent); }
    }
    try {
      const ri = await fetchIntent(rpc, pda as any);
      if (ri) view = fromResolved(ri); // on-chain wins for status; the account is gone once closed
    } catch { /* closed or not yet readable on-chain — keep the indexer view if we have one */ }
    if (mounted.current && view) {
      const v = view;
      setDetail((prev) => ({ view: v, timeline: timeline.length ? timeline : prev?.timeline ?? [] }));
    }
  }, [idx, rpc, pda]);

  React.useEffect(() => {
    mounted.current = true;
    load().catch(() => {});
    const h = setInterval(() => { load().catch(() => {}); }, 8000);
    return () => { mounted.current = false; clearInterval(h); };
  }, [load]);

  return { detail, refresh: load };
}

export function useStats(): Stats | null {
  const idx = useIndexer();
  const [s, setS] = React.useState<Stats | null>(null);
  React.useEffect(() => {
    let live = true;
    if (!idx) return;
    idx.stats().then((r) => { if (live) setS(r); }).catch(() => {});
    return () => { live = false; };
  }, [idx]);
  return s;
}

export function useValidityConfigs(): ValidityConfigRow[] {
  const idx = useIndexer();
  const [c, setC] = React.useState<ValidityConfigRow[]>([]);
  React.useEffect(() => {
    let live = true;
    if (!idx) return;
    idx.validityConfigs().then((r) => { if (live) setC(r); }).catch(() => {});
    return () => { live = false; };
  }, [idx]);
  return c;
}
