import * as React from 'react';
import { useClient, useIntent } from '@laplace/sdk/react';
import { mapLaplaceError } from '@laplace/sdk';
import { useToast } from '@laplace/ui';
import type { Address } from '@solana/kit';

export function useIntentActions(pda: string | undefined) {
  const client = useClient();
  const ri = useIntent(pda as Address | undefined);
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  async function run(fn: () => Promise<{ signature: string }>, ok: string) {
    if (!ri) { toast('Intent not loaded', 'error'); return; }
    setBusy(true);
    try { const { signature } = await fn(); toast(`${ok} · ${signature.slice(0, 8)}…`); }
    catch (e) { toast(mapLaplaceError(e).message, 'error'); }
    finally { setBusy(false); }
  }

  return {
    ri, busy,
    fulfillHashlock: (secret: Uint8Array, fulfiller: any) => run(() => client.fulfillIntent(ri!, { secret }, { fulfiller }), 'Fulfilled'),
    fulfillValidity: (proof: Uint8Array, publicInputsSuffix: Uint8Array, fulfiller: any) => run(() => client.fulfillIntent(ri!, { proof, publicInputsSuffix }, { fulfiller }), 'Fulfilled'),
    refund: (cranker: any) => run(() => client.refundExpiredIntent(ri!, { cranker }), 'Refunded'),
    close: (maker: any) => run(() => client.closeIntent(ri!, { maker }), 'Closed'),
  };
}
