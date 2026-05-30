import { describe, it, expect } from 'vitest';
import { resolveRpcUrl } from '../src/cluster.js';
describe('cluster', () => {
  it('resolves rpc url from registry, env override wins', () => {
    expect(resolveRpcUrl('devnet')).toBe('https://api.devnet.solana.com');
    expect(resolveRpcUrl('devnet', 'https://custom')).toBe('https://custom');
  });
});
