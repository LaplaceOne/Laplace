import { describe, it, expect } from 'vitest';
import { address } from '@solana/kit';
import { nativeSol, splToken, toBaseUnits, toDisplay } from '../src/asset.js';
import { TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';

describe('asset + units', () => {
  it('nativeSol / splToken descriptors', () => {
    expect(nativeSol()).toEqual({ sol: true });
    const mint = address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    expect(splToken({ mint })).toEqual({ spl: { mint, tokenProgram: TOKEN_PROGRAM_ADDRESS } });
  });
  it('toBaseUnits / toDisplay round-trip with decimals', () => {
    expect(toBaseUnits('1200', 6)).toBe(1_200_000_000n);
    expect(toBaseUnits(1.5, 9)).toBe(1_500_000_000n);
    expect(toDisplay(1_200_000_000n, 6)).toBe('1200');
    expect(toDisplay(1_500_000_000n, 9)).toBe('1.5');
  });
});
