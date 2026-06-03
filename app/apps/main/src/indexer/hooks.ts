import * as React from 'react';
import { useLaplaceContext } from '@laplace/sdk/react';
import { fetchIntents, fetchIntent, fetchIntentsByAddresses } from '@laplace/sdk';
import type { Address } from '@solana/kit';
import type { IntentView, IntentStatusKind } from '@laplace/ui';
import { useIndexer } from './IndexerProvider';
import { fromIndexerRow, fromResolved } from '../intent/adapters';
import { resolveMintInfo } from '../intent/mintInfo';
import type { IntentDetail, Stats, ValidityConfigRow } from './indexerClient';

export type Role = 'maker' | 'receiver' | 'refund' | 'all';

// Mirrors the numeric→label mapping in adapters.ts (SDK_STATUS), used to reconcile the indexer's
// status against the freshest on-chain account.
const ON_CHAIN_STATUS: Record<number, IntentStatusKind> = { 0: 'Active', 1: 'Fulfilled', 2: 'Refunded' };

const LIST_POLL_MS = 12000;

function ownerParam(role: Role, owner: string): { maker?: string; receiver?: string } {
  if (role === 'maker') return { maker: owner };
  if (role === 'receiver') return { receiver: owner };
  return {}; // 'refund' has no indexer column filter; client-side filter below. 'all' = none.
}

// Resolve SPL decimals (mandatory) + symbol (best-effort) from chain and patch the views in place.
// Unique mints are resolved in parallel and deduped by mintInfo's cache; a per-mint failure keeps
// that view's fallback decimals/symbol so it can never empty the list.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function patchSplMintInfo(rpc: any, views: IntentView[]): Promise<void> {
  const mints = [...new Set(views.filter((v) => v.asset.kind === 'SplToken' && v.asset.mint).map((v) => v.asset.mint!))];
  const infos = new Map<string, { decimals: number; symbol?: string }>();
  await Promise.all(mints.map(async (mint) => {
    try { infos.set(mint, await resolveMintInfo(rpc, mint)); } catch { /* keep fallback for this mint */ }
  }));
  for (const v of views) {
    if (v.asset.kind !== 'SplToken' || !v.asset.mint) continue;
    const info = infos.get(v.asset.mint);
    if (!info) continue;
    v.asset.decimals = info.decimals;
    if (info.symbol) v.asset.symbol = info.symbol;
  }
}

export function useIntentList({ role, status }: { role: Role; status?: 'active' | 'fulfilled' | 'refunded' }) {
  const idx = useIndexer();
  const { rpc, cluster, signer } = useLaplaceContext() as any;
  const owner: string | undefined = signer?.address ? String(signer.address) : undefined;
  const [data, setData] = React.useState<IntentView[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let live = true;
    const load = async () => {
      let views: IntentView[] = [];
      if (idx && (await idx.health())) {
        const rows = await idx.listIntents({ ...ownerParam(role, owner ?? ''), status, limit: 100 });
        views = rows.map(fromIndexerRow);
        if (role === 'refund' && owner) views = views.filter((v) => v.refundRecipient === owner);
        // The indexer cron lags up to ~2 min, so a just-fulfilled intent can still read 'Active'.
        // Reconcile status/closed against the freshest on-chain accounts in one batched call; views
        // whose account is absent (closed) keep the indexer value. A whole-batch failure (e.g. RPC
        // hiccup) must not empty the list, so it is non-fatal.
        try {
          const onChain = await fetchIntentsByAddresses(rpc, views.map((v) => v.pda as Address));
          for (const v of views) {
            const data: any = onChain.get(v.pda);
            if (!data) continue; // absent on-chain — likely closed; keep indexer status
            v.status = ON_CHAIN_STATUS[Number(data.status)] ?? v.status;
            v.closed = false;
          }
        } catch { /* non-fatal: keep indexer status */ }
        // Resolve SPL decimals/symbol from chain (indexer does not store decimals).
        await patchSplMintInfo(rpc, views);
      } else if (owner) {
        const sdkRole = role === 'all' ? 'all' : role === 'refund' ? 'refund' : role;
        const resolved = await fetchIntents(rpc, { role: sdkRole as any, owner: owner as any, cluster });
        views = resolved.map(fromResolved);
        // The SDK fallback already reads status on-chain via fromResolved, so only SPL info is missing.
        await patchSplMintInfo(rpc, views);
      }
      if (live) { setData(views); setLoading(false); }
    };
    setLoading(true);
    load().catch(() => { if (live) { setData([]); setLoading(false); } });
    // Poll so a just-fulfilled intent's card flips status without a manual refresh.
    const h = setInterval(() => { load().catch(() => {}); }, LIST_POLL_MS);
    return () => { live = false; clearInterval(h); };
  }, [idx, rpc, cluster, owner, role, status]);

  return { data, loading };
}

export function useIntentDetail(pda: string | undefined) {
  const idx = useIndexer();
  const { rpc } = useLaplaceContext() as any;
  const [detail, setDetail] = React.useState<{ view: IntentView; timeline: IntentDetail['timeline'] } | null>(null);
  const mounted = React.useRef(true);
  const genRef = React.useRef(0);

  // The indexer carries the timeline (past event signatures/slots); the on-chain account carries the
  // freshest status. The cron can lag a couple of minutes behind a just-submitted fulfill/refund, so
  // take status from chain (it is never behind) and the timeline from the indexer. `refresh` lets an
  // action update the status the instant its tx confirms, instead of waiting for the next poll.
  const load = React.useCallback(async () => {
    if (!pda) { setDetail(null); return; }
    const myGen = genRef.current;
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
    // Resolve SPL decimals/symbol from chain (indexer does not store decimals); fallback on failure.
    if (view) await patchSplMintInfo(rpc, [view]);
    if (mounted.current && genRef.current === myGen && view) {
      const v = view;
      setDetail((prev) => ({ view: v, timeline: timeline.length ? timeline : prev?.timeline ?? [] }));
    }
  }, [idx, rpc, pda]);

  React.useEffect(() => {
    genRef.current += 1;
    mounted.current = true;
    load().catch(() => {});
    const h = setInterval(() => { load().catch(() => {}); }, 8000);
    return () => { genRef.current += 1; mounted.current = false; clearInterval(h); };
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
