import { describe, it, expect } from 'vitest';
import { createSlotClock } from '../src/slot-clock.js';
describe('slot clock', () => {
  it('polls getSlot and reports the latest slot', async () => {
    let slot = 100n;
    const rpc = { getSlot: () => ({ send: async () => slot++ }) } as any;
    const clock = createSlotClock(rpc, { intervalMs: 5 });
    const seen: bigint[] = [];
    const stop = clock.subscribe((s) => seen.push(s));
    await new Promise((r) => setTimeout(r, 30));
    stop(); clock.dispose();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0]).toBe(100n);
  });
});
