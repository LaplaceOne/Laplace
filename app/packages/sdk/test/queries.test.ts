import { describe, it, expect } from 'vitest';
import { ROLE_MEMCMP_OFFSET, refundPostFilter } from '../src/queries.js';

describe('query role mapping', () => {
  it('uses the verified Intent memcmp offsets', () => {
    expect(ROLE_MEMCMP_OFFSET).toEqual({ maker: 40n, receiver: 72n, refund: 104n });
  });
  it('refund post-filter excludes self-made intents', () => {
    const owner = 'OWNER';
    expect(refundPostFilter({ maker: owner, refundRecipient: owner } as any, owner)).toBe(false);
    expect(refundPostFilter({ maker: 'OTHER', refundRecipient: owner } as any, owner)).toBe(true);
  });
});
