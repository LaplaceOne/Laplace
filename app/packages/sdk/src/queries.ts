import { type Address, address } from '@solana/kit';
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
  const bytes = Buffer.from((value.data as [string, string])[0], 'base64');
  return { address: pda, data: getIntentDecoder().decode(new Uint8Array(bytes)) };
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
  let out: ResolvedIntent[] = (accounts as any[]).map((a) => ({
    address: a.pubkey,
    data: decoder.decode(new Uint8Array(Buffer.from(a.account.data[0], 'base64'))),
  }));
  if (args.role === 'refund') out = out.filter((r) => refundPostFilter(r.data, args.owner));
  return out;
}
