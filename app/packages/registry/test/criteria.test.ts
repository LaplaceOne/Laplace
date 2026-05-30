import { describe, it, expect } from 'vitest';
import { criteria, getCriteria, getCriterion, isOfficial, tierOf } from '../src/index.js';

const HASHLOCK = 'DNotXVWh1ifzp9MHSd5H4F78SRHptF9p8vGfMmjtuWX2';

describe('criteria', () => {
  it('ships exactly the two official criteria this round', () => {
    expect(criteria.map((c) => c.key).sort()).toEqual(['hashlock', 'validity']);
    expect(criteria.every((c) => c.tier === 'official')).toBe(true);
  });
  it('hashlock conformance binds partial, 0 accounts; validity binds full, 1 account', () => {
    expect(getCriterion('hashlock')!.conformance).toMatchObject({ binds: 'partial', accounts: 0, interfaceVersion: 2 });
    expect(getCriterion('validity')!.conformance).toMatchObject({ binds: 'full', accounts: 1, interfaceVersion: 2 });
  });
  it('isOfficial true for the hashlock program on localnet', () => {
    expect(isOfficial(HASHLOCK, 'localnet')).toBe(true);
  });
  it('tierOf is unverified for an unknown program', () => {
    expect(tierOf('11111111111111111111111111111111', 'localnet')).toBe('unverified');
    expect(tierOf(HASHLOCK, 'localnet')).toBe('official');
  });
  it('getCriteria filters by tier', () => {
    expect(getCriteria({ tier: 'community' })).toHaveLength(0);
    expect(getCriteria({ tier: 'official' })).toHaveLength(2);
  });
  it('getCriteria filters by cluster (none deployed on mainnet-beta yet)', () => {
    expect(getCriteria({ cluster: 'devnet' })).toHaveLength(2);
    expect(getCriteria({ cluster: 'localnet' })).toHaveLength(2);
    expect(getCriteria({ cluster: 'mainnet-beta' })).toHaveLength(0);
  });
});
