import { describe, it, expect } from 'vitest';
import { address } from '@solana/kit';
import { ataFor } from '../src/ata.js';
describe('ata', () => {
  it('derives the associated token account for an owner+mint', async () => {
    const owner = address('9fYLFVoVqwH37C3dyPi6cpeobfbQ2jtLpN5HgAYDDdkm');
    const mint = address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    const ata = await ataFor({ owner, mint });
    expect(ata).toBeTypeOf('string');
  });
});
