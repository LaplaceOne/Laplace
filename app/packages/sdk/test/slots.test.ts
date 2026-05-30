import { describe, it, expect } from 'vitest';
import { minutesToSlots, slotsToApproxMs, slotToApproxTime, SLOT_MS } from '../src/slots.js';

describe('slots', () => {
  it('minutesToSlots uses ~400ms/slot', () => {
    expect(SLOT_MS).toBe(400);
    expect(minutesToSlots(60)).toBe(9000n);
  });
  it('slotsToApproxMs inverse', () => { expect(slotsToApproxMs(9000n)).toBe(3_600_000); });
  it('slotToApproxTime projects forward from now', () => {
    const now = 1_000_000;
    const d = slotToApproxTime(110n, 100n, now);
    expect(d.getTime()).toBe(now + 10 * 400);
  });
});
