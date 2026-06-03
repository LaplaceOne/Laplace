import { type Address, address, getBase64Encoder } from '@solana/kit';
import { getCluster, type Cluster } from '@laplace/registry';
import { getIntentDecoder, type Intent } from './generated/laplace/index.js';
import type { ResolvedIntent } from './intent.js';
export type { ResolvedIntent };

export const ROLE_MEMCMP_OFFSET = { maker: 40n, receiver: 72n, refund: 104n } as const;

export function refundPostFilter(i: Pick<Intent, 'maker' | 'refundRecipient'>, owner: string): boolean {
  return i.refundRecipient === owner && i.maker !== owner;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchIntent(rpc: any, pda: Address): Promise<ResolvedIntent> {
  const { value } = await rpc.getAccountInfo(pda, { encoding: 'base64' }).send();
  if (!value) throw new Error(`intent not found: ${pda}`);
  // Buffer is a Node global; kit's base64 encoder keeps this working in the browser.
  const bytes = new Uint8Array(getBase64Encoder().encode((value.data as [string, string])[0]));
  return { address: pda, data: getIntentDecoder().decode(bytes) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchIntents(
  rpc: any,
  args: { role: 'maker' | 'receiver' | 'refund' | 'all'; owner: Address; cluster?: Cluster },
): Promise<ResolvedIntent[]> {
  const program = address(getCluster(args.cluster ?? 'localnet').programs.laplace);
  const filters: any[] = [];
  if (args.role !== 'all') {
    const offset =
      args.role === 'maker'
        ? ROLE_MEMCMP_OFFSET.maker
        : args.role === 'receiver'
          ? ROLE_MEMCMP_OFFSET.receiver
          : ROLE_MEMCMP_OFFSET.refund;
    filters.push({ memcmp: { offset, bytes: args.owner, encoding: 'base58' } });
  }
  const accounts = await rpc.getProgramAccounts(program, { encoding: 'base64', filters }).send();
  const decoder = getIntentDecoder();
  const b64 = getBase64Encoder();
  let out: ResolvedIntent[] = (accounts as any[]).map((a) => ({
    address: a.pubkey,
    data: decoder.decode(new Uint8Array(b64.encode(a.account.data[0]))),
  }));
  if (args.role === 'refund') out = out.filter((r) => refundPostFilter(r.data, args.owner));
  return out;
}

// Reconcile a known set of intent PDAs against the chain in one batched call. The indexer cron can
// lag a couple of minutes, so the dashboard uses this to take the freshest status/closed straight
// from the accounts. Absent (null) entries are skipped — the account was closed or never existed —
// so the caller keeps its prior (indexer) value for those.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchIntentsByAddresses(rpc: any, pdas: Address[]): Promise<Map<string, Intent>> {
  const out = new Map<string, Intent>();
  const decoder = getIntentDecoder();
  const b64 = getBase64Encoder();
  for (let i = 0; i < pdas.length; i += 100) {
    const chunk = pdas.slice(i, i + 100);
    const { value } = await rpc.getMultipleAccounts(chunk, { encoding: 'base64' }).send();
    (value as Array<{ data: [string, string] } | null>).forEach((acct, j) => {
      if (!acct) return; // closed/absent on-chain — caller keeps its prior value
      out.set(String(chunk[j]), decoder.decode(new Uint8Array(b64.encode(acct.data[0]))));
    });
  }
  return out;
}
