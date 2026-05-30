import { describe, it, expect } from 'vitest';
import { clusters, getCluster } from '../src/index.js';

describe('clusters', () => {
  it('seeds localnet with the Anchor.toml program IDs', () => {
    const c = getCluster('localnet');
    expect(c.programs.laplace).toBe('5ozBamUtiAHCkiipAVL9E8v8r54HqZsHMDbkHdczpidu');
    expect(c.programs.hashlock).toBe('DNotXVWh1ifzp9MHSd5H4F78SRHptF9p8vGfMmjtuWX2');
    expect(c.programs.validity).toBe('EQfH4VFdxcFYh8prdAsB4XwKCZiiR5uta594bfiwhLsB');
  });
  it('exposes all three clusters', () => {
    expect(clusters.map((c) => c.cluster).sort()).toEqual(['devnet', 'localnet', 'mainnet-beta']);
  });
  it('throws on an unknown cluster', () => {
    // @ts-expect-error invalid cluster
    expect(() => getCluster('mainnet')).toThrow();
  });
});
