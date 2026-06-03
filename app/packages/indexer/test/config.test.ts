import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('defaults to devnet + finalized + in-memory db', () => {
    const c = loadConfig({});
    expect(c.cluster).toBe('devnet');
    expect(c.commitment).toBe('finalized');
    expect(c.databaseUrl).toBe('memory://');
    expect(c.rpcUrl).toBe('https://api.devnet.solana.com');
    expect(c.pollIntervalMs).toBe(5000);
    expect(c.startSlot).toBeNull();
  });
  it('reads overrides from env', () => {
    const c = loadConfig({ LAPLACE_CLUSTER: 'devnet', DATABASE_URL: 'postgres://x', START_SLOT: '100', POLL_INTERVAL_MS: '1000' });
    expect(c.databaseUrl).toBe('postgres://x');
    expect(c.startSlot).toBe(100n);
    expect(c.pollIntervalMs).toBe(1000);
  });
});
