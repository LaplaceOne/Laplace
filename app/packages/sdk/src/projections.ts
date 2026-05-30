import type { Address } from '@solana/kit';
import { IntentStatus } from './generated/laplace/index.js';
import type { Intent } from './generated/laplace/index.js';

// IntentStatus is a numeric TS enum: Active=0, Fulfilled=1, Refunded=2
// (confirmed from generated/laplace/types/intentStatus.ts)
const ACTIVE = IntentStatus.Active;
const FULFILLED = IntentStatus.Fulfilled;
const REFUNDED = IntentStatus.Refunded;

export type EffectiveStatus = 'Active' | 'Expiring soon' | 'Fulfilled' | 'Refunded' | 'Closed';

function statusNum(intent: Intent): number {
  return intent.status as unknown as number;
}

export function effectiveStatus(
  intent: Intent,
  currentSlot: bigint,
  opts?: { closed?: boolean; expiringWindowSlots?: bigint },
): EffectiveStatus {
  if (opts?.closed) return 'Closed';
  const s = statusNum(intent);
  if (s === FULFILLED) return 'Fulfilled';
  if (s === REFUNDED) return 'Refunded';
  const window = opts?.expiringWindowSlots ?? 2250n; // ~15 min at 400ms/slot (matches the console UI)
  if (currentSlot <= intent.expirySlot && intent.expirySlot - currentSlot <= window) return 'Expiring soon';
  return 'Active';
}

export interface IntentAction {
  kind: 'fulfill' | 'refund' | 'close' | 'none';
  enabled: boolean;
  label: string;
  reason?: string;
}

export function actionFor(intent: Intent, ctx: { wallet: Address; currentSlot: bigint }): IntentAction {
  const s = statusNum(intent);
  const expired = ctx.currentSlot > intent.expirySlot;
  if (s === ACTIVE && !expired && intent.receiver === ctx.wallet) {
    return { kind: 'fulfill', enabled: true, label: 'Fulfill' };
  }
  if (s === ACTIVE && expired && intent.refundRecipient === ctx.wallet) {
    return { kind: 'refund', enabled: true, label: 'Refund' };
  }
  if ((s === FULFILLED || s === REFUNDED) && intent.maker === ctx.wallet) {
    return { kind: 'close', enabled: true, label: 'Close' };
  }
  if (s === ACTIVE && intent.maker === ctx.wallet && !expired) {
    return { kind: 'none', enabled: false, label: 'Awaiting fulfillment' };
  }
  return { kind: 'none', enabled: false, label: 'No action' };
}
