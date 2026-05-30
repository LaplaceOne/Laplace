import { describe, it, expect } from 'vitest';
import { address } from '@solana/kit';
import { mapLaplaceError } from '../src/errors.js';
import { intentShareLink } from '../src/links.js';

describe('errors + links', () => {
  it('maps a laplace custom error code to a plain message (default program)', () => {
    const r = mapLaplaceError({ context: { code: 6003 }, name: 'SolanaError' });
    expect(r.message.toLowerCase()).toContain('expired');
    expect(r.code).toBe(6003);
    expect(r.program).toBe('laplace');
  });
  it('disambiguates the same code per program (6001)', () => {
    // 6001 means InvalidExpiry in laplace but InvalidPreimage in hashlock — must not collide.
    expect(mapLaplaceError({ context: { code: 6001 } }).message.toLowerCase()).toContain('expiry');
    const h = mapLaplaceError({ context: { code: 6001 } }, { program: 'hashlock' });
    expect(h.message.toLowerCase()).toContain('secret');
    expect(h.program).toBe('hashlock');
    expect(mapLaplaceError({ context: { code: 6002 } }, { program: 'validity' }).message.toLowerCase()).toContain('proof');
  });
  it('falls back to the error message for unknown errors', () => {
    expect(mapLaplaceError(new Error('boom')).message).toBe('boom');
  });
  it('intentShareLink carries only pda + cluster', () => {
    const pda = address('9fYLFVoVqwH37C3dyPi6cpeobfbQ2jtLpN5HgAYDDdkm');
    expect(intentShareLink(pda, 'devnet')).toBe(`/app/i/${pda}?cluster=devnet`);
  });
});
