import { describe, it, expect } from 'vitest';
import { address } from '@solana/kit';
import { effectiveStatus, actionFor } from '../src/projections.js';
import type { Intent } from '../src/generated/laplace/index.js';

const me = address('9fYLFVoVqwH37C3dyPi6cpeobfbQ2jtLpN5HgAYDDdkm');
const other = address('5ozBamUtiAHCkiipAVL9E8v8r54HqZsHMDbkHdczpidu');
function intent(over: Partial<Intent>): Intent {
  return { id: new Uint8Array(32), maker: me, receiver: other, refundRecipient: me,
    criterionProgram: other, asset: { __kind: 'NativeSol' } as any, amount: 5n, expirySlot: 1000n, createdSlot: 1n,
    criterionDataHash: new Uint8Array(32), criterionInterfaceVersion: 2, status: 0 as any, bump: 255,
    discriminator: new Uint8Array(8) as any, ...over } as Intent;
}

describe('projections', () => {
  it('effectiveStatus: active / expiring-soon / fulfilled / closed', () => {
    expect(effectiveStatus(intent({ status: 0 as any, expirySlot: 100_000n }), 100n)).toBe('Active'); // far from expiry, default 15-min window
    expect(effectiveStatus(intent({ status: 0 as any, expirySlot: 105n }), 100n, { expiringWindowSlots: 10n })).toBe('Expiring soon');
    expect(effectiveStatus(intent({ status: 0 as any, expirySlot: 1000n }), 100n)).toBe('Expiring soon'); // 900-slot gap is within the default 2250-slot window
    expect(effectiveStatus(intent({ status: 1 as any }), 100n)).toBe('Fulfilled');
    expect(effectiveStatus(intent({ status: 0 as any }), 100n, { closed: true })).toBe('Closed');
  });
  it('actionFor: receiver fulfills before expiry', () => {
    expect(actionFor(intent({ receiver: me, status: 0 as any }), { wallet: me, currentSlot: 100n })).toMatchObject({ kind: 'fulfill', enabled: true });
  });
  it('actionFor: refund recipient refunds after expiry', () => {
    expect(actionFor(intent({ refundRecipient: me, status: 0 as any, expirySlot: 50n }), { wallet: me, currentSlot: 100n })).toMatchObject({ kind: 'refund', enabled: true });
  });
  it('actionFor: maker closes after fulfilled', () => {
    expect(actionFor(intent({ maker: me, status: 1 as any }), { wallet: me, currentSlot: 100n })).toMatchObject({ kind: 'close', enabled: true });
  });
});
