import { describe, it, expect } from 'vitest';
import { clusters, getCluster } from '../src/index.js';

describe('clusters', () => {
  it('seeds localnet with the Anchor.toml program IDs', () => {
    const c = getCluster('localnet');
    expect(c.programs.laplace).toBe('Bkb7WhLQcnz52gYrSdExPoxZUs8b2fzwjzQwrhcv8ACG');
    expect(c.programs.hashlock).toBe('9FWQGf16ZB5wdrwg3gDCmUcpRJNVuzp1uG12C6z5RVTw');
    expect(c.programs.validity).toBe('CuSVyvxRCfnsvvDWWqP8xRw8fNbGRwTdam5iKsqY3Kq1');
  });
  it('exposes all three clusters', () => {
    expect(clusters.map((c) => c.cluster).sort()).toEqual(['devnet', 'localnet', 'mainnet-beta']);
  });
  it('throws on an unknown cluster', () => {
    // @ts-expect-error invalid cluster
    expect(() => getCluster('mainnet')).toThrow();
  });
});
