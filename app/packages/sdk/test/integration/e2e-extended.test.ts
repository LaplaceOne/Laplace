import { describe, it, expect } from 'vitest';
import { Laplace, Condition, fetchIntent, fetchIntents, splToken, effectiveStatus } from '../../src/index.js';
import { RUN, localnet, fundedSigner } from './localnet.js';
import { createMint, mintTokens, ata, tokenBalance, currentSlot, waitForSlotPast } from './helpers.js';

describe.runIf(RUN)('extended lifecycles (localnet)', () => {
  it('SOL refund-after-expiry → close', async () => {
    const { rpc, rpcSubscriptions } = localnet();
    const client = new Laplace({ rpc, rpcSubscriptions, cluster: 'localnet' });
    const maker = await fundedSigner(rpc, rpcSubscriptions);
    const receiver = await fundedSigner(rpc, rpcSubscriptions);
    const slot = await currentSlot(rpc);
    const created = await client.createIntent({
      maker, receiver: receiver.address, asset: { sol: true }, amount: 1_000_000_000n,
      criterion: Condition.hashlock({ secret: new Uint8Array(32).fill(7) }), expirySlot: slot + 20n,
    });
    await waitForSlotPast(rpc, slot + 20n);
    const intent = await fetchIntent(rpc, created.intentPda);
    const refunded = await client.refundExpiredIntent(intent, { cranker: maker });
    expect(refunded.signature).toBeTypeOf('string');
    const after = await fetchIntent(rpc, created.intentPda);
    expect(effectiveStatus(after.data, slot + 40n)).toBe('Refunded');
    const closed = await client.closeIntent(after, { maker });
    expect(closed.signature).toBeTypeOf('string');
  }, 60_000);

  it('fetchIntents maker/receiver/refund role filters (live getProgramAccounts + memcmp)', async () => {
    const { rpc, rpcSubscriptions } = localnet();
    const client = new Laplace({ rpc, rpcSubscriptions, cluster: 'localnet' });
    const maker = await fundedSigner(rpc, rpcSubscriptions);
    const receiver = await fundedSigner(rpc, rpcSubscriptions);
    const slot = await currentSlot(rpc);
    const created = await client.createIntent({
      maker, receiver: receiver.address, asset: { sol: true }, amount: 500_000_000n,
      criterion: Condition.hashlock({ secret: new Uint8Array(32).fill(11) }), expirySlot: slot + 10_000n,
    });
    const mine = await fetchIntents(rpc, { role: 'maker', owner: maker.address });
    expect(mine.some((r) => r.address === created.intentPda)).toBe(true);
    const tome = await fetchIntents(rpc, { role: 'receiver', owner: receiver.address });
    expect(tome.some((r) => r.address === created.intentPda)).toBe(true);
    // refundRecipient defaults to maker, so the refund post-filter (refund==me AND maker!=me) excludes it
    const refundableForMaker = await fetchIntents(rpc, { role: 'refund', owner: maker.address });
    expect(refundableForMaker.some((r) => r.address === created.intentPda)).toBe(false);
    // a distinct refund recipient DOES show up
    const m2 = await fundedSigner(rpc, rpcSubscriptions);
    const created2 = await client.createIntent({
      maker: m2, receiver: maker.address, refundRecipient: receiver.address, asset: { sol: true }, amount: 100_000_000n,
      criterion: Condition.hashlock({ secret: new Uint8Array(32).fill(12) }), expirySlot: slot + 10_000n,
    });
    const refundableForReceiver = await fetchIntents(rpc, { role: 'refund', owner: receiver.address });
    expect(refundableForReceiver.some((r) => r.address === created2.intentPda)).toBe(true);
  }, 60_000);

  it('SPL hashlock create → fulfill → close (releases tokens to the receiver)', async () => {
    const { rpc, rpcSubscriptions } = localnet();
    const client = new Laplace({ rpc, rpcSubscriptions, cluster: 'localnet' });
    const maker = await fundedSigner(rpc, rpcSubscriptions);
    const receiver = await fundedSigner(rpc, rpcSubscriptions);
    const mint = await createMint(rpc, rpcSubscriptions, maker, 6);
    await mintTokens(rpc, rpcSubscriptions, maker, mint, maker.address, 5_000_000n);
    const slot = await currentSlot(rpc);
    const secret = new Uint8Array(32).fill(21);
    const created = await client.createIntent({
      maker, receiver: receiver.address, asset: splToken({ mint }), amount: 3_000_000n,
      criterion: Condition.hashlock({ secret }), expirySlot: slot + 10_000n,
    });
    expect(await tokenBalance(rpc, await ata(maker.address, mint))).toBe(2_000_000n); // 5 - 3 locked
    const intent = await fetchIntent(rpc, created.intentPda);
    await client.fulfillIntent(intent, { secret }, { fulfiller: receiver });
    expect(await tokenBalance(rpc, await ata(receiver.address, mint))).toBe(3_000_000n); // released
    const after = await fetchIntent(rpc, created.intentPda);
    const closed = await client.closeIntent(after, { maker });
    expect(closed.signature).toBeTypeOf('string');
  }, 90_000);

  it('SPL refund-after-expiry returns tokens to the refund recipient', async () => {
    const { rpc, rpcSubscriptions } = localnet();
    const client = new Laplace({ rpc, rpcSubscriptions, cluster: 'localnet' });
    const maker = await fundedSigner(rpc, rpcSubscriptions);
    const receiver = await fundedSigner(rpc, rpcSubscriptions);
    const mint = await createMint(rpc, rpcSubscriptions, maker, 6);
    await mintTokens(rpc, rpcSubscriptions, maker, mint, maker.address, 4_000_000n);
    const slot = await currentSlot(rpc);
    const created = await client.createIntent({
      maker, receiver: receiver.address, asset: splToken({ mint }), amount: 4_000_000n,
      criterion: Condition.hashlock({ secret: new Uint8Array(32).fill(31) }), expirySlot: slot + 20n,
    });
    expect(await tokenBalance(rpc, await ata(maker.address, mint))).toBe(0n); // all locked
    await waitForSlotPast(rpc, slot + 20n);
    const intent = await fetchIntent(rpc, created.intentPda);
    await client.refundExpiredIntent(intent, { cranker: maker });
    expect(await tokenBalance(rpc, await ata(maker.address, mint))).toBe(4_000_000n); // refunded to maker
  }, 90_000);

  it('validity: createValidityConfig matches the on-chain hash_config; fulfill rejects a fake proof', async () => {
    const { rpc, rpcSubscriptions } = localnet();
    const client = new Laplace({ rpc, rpcSubscriptions, cluster: 'localnet' });
    const payer = await fundedSigner(rpc, rpcSubscriptions);
    const guestElfHash = new Uint8Array(32).fill(0xab);
    const sp1VkeyHash = new Uint8Array(32).fill(0xcd);
    const fixedPublicInputs = new Uint8Array([1, 2, 3, 4]);
    // create_validity recomputes config_hash on-chain and rejects unless it equals the supplied
    // hash — a successful create proves our TS hashConfig byte-matches the Rust hash_config.
    const cfg = await client.createValidityConfig({ guestElfHash, sp1VkeyHash, fixedPublicInputs }, { payer });
    expect(cfg.signature).toBeTypeOf('string');

    const maker = await fundedSigner(rpc, rpcSubscriptions);
    const receiver = await fundedSigner(rpc, rpcSubscriptions);
    const slot = await currentSlot(rpc);
    const created = await client.createIntent({
      maker, receiver: receiver.address, asset: { sol: true }, amount: 1_000_000n,
      criterion: Condition.validity({ configHash: cfg.configHash }), expirySlot: slot + 10_000n,
    });
    const intent = await fetchIntent(rpc, created.intentPda);
    // Garbage proof (260 bytes passes the length floor, fails Groth16 verification on-chain).
    await expect(
      client.fulfillIntent(intent, { proof: new Uint8Array(260), publicInputsSuffix: new Uint8Array([9]) }, { fulfiller: receiver }),
    ).rejects.toThrow();
  }, 90_000);
});
