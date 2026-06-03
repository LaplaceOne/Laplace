export type IntentStatusKind = 'Active' | 'Fulfilled' | 'Refunded';

export interface IntentAssetView {
  kind: 'NativeSol' | 'SplToken';
  mint?: string;
  symbol: string;        // 'SOL' or token symbol (caller resolves; default mint-short)
  decimals: number;      // 9 for SOL
}

export interface IntentView {
  pda: string;
  maker: string;
  receiver: string;
  refundRecipient: string;
  criterionProgram: string;
  asset: IntentAssetView;
  amount: bigint;        // base units
  expirySlot: bigint;
  createdSlot: bigint;
  status: IntentStatusKind;
  closed: boolean;
}

export type EffectiveStatus = 'Active' | 'Expiring soon' | 'Fulfilled' | 'Refunded' | 'Closed';

export function viewEffectiveStatus(v: IntentView, currentSlot: bigint, expiringWindowSlots = 1500n): EffectiveStatus {
  if (v.closed) return 'Closed';
  if (v.status === 'Fulfilled') return 'Fulfilled';
  if (v.status === 'Refunded') return 'Refunded';
  if (currentSlot >= v.expirySlot) return 'Active';                 // expired-but-active still shows Active; action becomes Refund
  if (v.expirySlot - currentSlot <= expiringWindowSlots) return 'Expiring soon';
  return 'Active';
}

export type RoleActionKind = 'fulfill' | 'refund' | 'close' | 'none';
export interface RoleAction { kind: RoleActionKind; enabled: boolean; label: string; reason?: string }

export function viewActionFor(v: IntentView, ctx: { wallet?: string; currentSlot: bigint }): RoleAction {
  const me = ctx.wallet;
  if (v.status === 'Active' && ctx.currentSlot < v.expirySlot) {
    if (me && me === v.receiver) return { kind: 'fulfill', enabled: true, label: 'Fulfill' };
    return { kind: 'fulfill', enabled: false, label: 'Fulfill', reason: me ? 'Only the receiver can fulfill' : 'Connect wallet' };
  }
  if (v.status === 'Active' && ctx.currentSlot >= v.expirySlot) {
    return { kind: 'refund', enabled: !!me, label: 'Refund', reason: me ? undefined : 'Connect wallet' };
  }
  if ((v.status === 'Fulfilled' || v.status === 'Refunded') && !v.closed) {
    if (me && me === v.maker) return { kind: 'close', enabled: true, label: 'Close (reclaim rent)' };
    return { kind: 'close', enabled: false, label: 'Close', reason: 'Only the maker can close' };
  }
  return { kind: 'none', enabled: false, label: '—' };
}
