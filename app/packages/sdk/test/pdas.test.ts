import { describe, it, expect } from 'vitest';
import { address, getProgramDerivedAddress, getAddressEncoder } from '@solana/kit';
import { intentPda, validityConfigPda } from '../src/pdas.js';
import { INTENT_SEED, VALIDITY_SEED } from '../src/constants.js';

const LAPLACE = address('Bkb7WhLQcnz52gYrSdExPoxZUs8b2fzwjzQwrhcv8ACG');
const maker = address('9fYLFVoVqwH37C3dyPi6cpeobfbQ2jtLpN5HgAYDDdkm');

describe('PDAs', () => {
  it('intentPda matches getProgramDerivedAddress with the documented seeds', async () => {
    const id = new Uint8Array(32).fill(7);
    const [expected] = await getProgramDerivedAddress({
      programAddress: LAPLACE,
      seeds: [INTENT_SEED, getAddressEncoder().encode(maker), id],
    });
    const [got] = await intentPda(maker, id);
    expect(got).toBe(expected);
  });
  it('validityConfigPda is deterministic', async () => {
    const h = new Uint8Array(32).fill(3);
    const a = await validityConfigPda(h);
    const b = await validityConfigPda(h);
    expect(a[0]).toBe(b[0]);
  });
});
