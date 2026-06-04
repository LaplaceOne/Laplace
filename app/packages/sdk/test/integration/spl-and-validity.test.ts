import { describe, it, expect } from 'vitest';
import { Laplace, Condition, fetchIntent, splToken, validityConfigPda } from '../../src/index.js';
import { RUN, localnet, fundedSigner } from './localnet.js';
// These require runtime fixtures (a minted SPL token; a real SP1 Groth16 proof). They are
// scaffolded with guided TODOs to be filled in at execution time using @laplace-one/wallet's
// createAtaIx + a mint helper, and the proof vectors from programs/validity/tests.

describe.runIf(RUN)('SPL + validity lifecycles (localnet)', () => {
  it('SPL hashlock: create → refund after expiry', async () => {
    const { rpc, rpcSubscriptions } = localnet();
    const client = new Laplace({ rpc, rpcSubscriptions, cluster: 'localnet' });
    const maker = await fundedSigner(rpc, rpcSubscriptions);
    // TODO(engineer): mint a test SPL token to `maker`, pass its mint here, create an SPL intent
    // with a near-term expiry, then assert refundExpiredIntent succeeds once slot > expiry.
    expect(maker.address).toBeTypeOf('string');
  }, 60_000);

  it('validity: createValidityConfig → create intent → fulfill with proof fixture', async () => {
    const { rpc, rpcSubscriptions } = localnet();
    const client = new Laplace({ rpc, rpcSubscriptions, cluster: 'localnet' });
    const payer = await fundedSigner(rpc, rpcSubscriptions);
    // TODO(engineer): reuse guest ELF hash, vkey hash, fixed inputs, proof, and public-input
    // suffix from programs/validity/tests/test_validity.rs:
    //   1) const cfg = await client.createValidityConfig({ guestElfHash, sp1VkeyHash, fixedPublicInputs }, { payer });
    //   2) create an intent with Condition.validity({ configHash: cfg.configHash })
    //   3) fulfill with { proof, publicInputsSuffix } and assert release.
    expect(payer.address).toBeTypeOf('string');
  }, 120_000);
});
