import type { IntentView, IntentStatusKind, IntentAssetView } from '@laplace/ui';
import type { ResolvedIntent } from '@laplace/sdk';
import type { IntentRow } from '../indexer/indexerClient';

const STATUS: Record<IntentRow['status'], IntentStatusKind> = {
  active: 'Active', fulfilled: 'Fulfilled', refunded: 'Refunded',
};

function assetView(a: IntentRow['asset']): IntentAssetView {
  if (a.kind === 'NativeSol') return { kind: 'NativeSol', symbol: 'SOL', decimals: 9 };
  return { kind: 'SplToken', mint: a.mint, symbol: `${a.mint.slice(0, 4)}…`, decimals: 0 };
}

export function fromIndexerRow(r: IntentRow): IntentView {
  return {
    pda: r.pda, maker: r.maker, receiver: r.receiver, refundRecipient: r.refundRecipient,
    criterionProgram: r.criterionProgram, asset: assetView(r.asset), amount: BigInt(r.amount),
    expirySlot: BigInt(r.expirySlot), createdSlot: BigInt(r.createdSlot),
    status: STATUS[r.status], closed: r.closed,
  };
}

const SDK_STATUS: Record<number, IntentStatusKind> = { 0: 'Active', 1: 'Fulfilled', 2: 'Refunded' };

export function fromResolved(ri: ResolvedIntent): IntentView {
  const d: any = ri.data;
  const sol = d.asset.__kind === 'NativeSol';
  return {
    pda: String(ri.address), maker: String(d.maker), receiver: String(d.receiver),
    refundRecipient: String(d.refundRecipient), criterionProgram: String(d.criterionProgram),
    asset: sol ? { kind: 'NativeSol', symbol: 'SOL', decimals: 9 }
               : { kind: 'SplToken', mint: String(d.asset.mint), symbol: `${String(d.asset.mint).slice(0, 4)}…`, decimals: 0 },
    amount: BigInt(d.amount), expirySlot: BigInt(d.expirySlot), createdSlot: BigInt(d.createdSlot),
    status: SDK_STATUS[Number(d.status)] ?? 'Active', closed: false,
  };
}
