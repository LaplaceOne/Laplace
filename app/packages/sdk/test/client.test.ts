import { describe, it, expect } from 'vitest';
import { Laplace } from '../src/client.js';

describe('Laplace client', () => {
  it('constructs and exposes the lifecycle methods', () => {
    const client = new Laplace({ rpc: {} as any, rpcSubscriptions: {} as any, cluster: 'localnet' });
    for (const m of ['createIntent', 'fulfillIntent', 'refundExpiredIntent', 'closeIntent', 'createValidityConfig']) {
      expect((client as any)[m]).toBeTypeOf('function');
    }
  });
});
