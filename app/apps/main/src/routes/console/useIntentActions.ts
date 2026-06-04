import * as React from 'react';
import { useClient, useLaplaceContext } from '@laplace-one/sdk/react';
import { fetchIntent, mapLaplaceError, type ResolvedIntent } from '@laplace-one/sdk';
import { useToast } from '@laplace-one/ui';
import type { Address } from '@solana/kit';

export function useIntentActions(pda: string | undefined, onSuccess?: () => void) {
  const client = useClient();
  const { rpc } = useLaplaceContext() as { rpc: unknown };
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  // Resolve the freshest on-chain intent at action time. The detail view already polls for display;
  // the lifecycle calls (fulfill/refund/close) need the *current* ResolvedIntent, and a single
  // up-front read can lag right after creation — so fetch on demand here rather than depend on a
  // one-shot hook that, once it misses, never retries and leaves every action "not loaded".
  async function run(fn: (ri: ResolvedIntent) => Promise<{ signature: string }>, ok: string) {
    if (!pda) { toast('Intent not loaded', 'error'); return; }
    setBusy(true);
    try {
      const ri = await fetchIntent(rpc as Parameters<typeof fetchIntent>[0], pda as Address);
      const { signature } = await fn(ri);
      toast(`${ok} · ${signature.slice(0, 8)}…`);
      onSuccess?.(); // tx confirmed — pull the new status now instead of waiting for the next poll
    } catch (e) {
      toast(mapLaplaceError(e).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    fulfillHashlock: (secret: Uint8Array, fulfiller: any) => run((ri) => client.fulfillIntent(ri, { secret }, { fulfiller }), 'Fulfilled'),
    fulfillValidity: (proof: Uint8Array, publicInputsSuffix: Uint8Array, fulfiller: any) => run((ri) => client.fulfillIntent(ri, { proof, publicInputsSuffix }, { fulfiller }), 'Fulfilled'),
    refund: (cranker: any) => run((ri) => client.refundExpiredIntent(ri, { cranker }), 'Refunded'),
    close: (maker: any) => run((ri) => client.closeIntent(ri, { maker }), 'Closed'),
  };
}
