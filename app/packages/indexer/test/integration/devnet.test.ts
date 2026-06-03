import { describe, it, expect } from 'vitest';
import { createSolanaRpc, createSolanaRpcSubscriptions, generateKeyPairSigner, airdropFactory, lamports } from '@solana/kit';
import { getCluster } from '@laplace/registry';
import { Laplace, Condition } from '@laplace/sdk';
import { makeDb } from '../../src/db/client.js';
import { rpcSource } from '../../src/ingest/rpc.js';
import { runOnce } from '../../src/ingest/poller.js';
import { getIntent } from '../../src/queries/intents.js';

const RUN = process.env.LAPLACE_DEVNET === '1';

describe.runIf(RUN)('indexer (devnet, live)', () => {
  it('indexes a real createIntent into the projection', async () => {
    const cluster = 'devnet' as const;
    const { rpcUrl, programs } = getCluster(cluster);
    const rpc = createSolanaRpc(rpcUrl);
    const rpcSubscriptions = createSolanaRpcSubscriptions('wss://api.devnet.solana.com');
    const maker = await generateKeyPairSigner();
    await airdropFactory({ rpc, rpcSubscriptions })({ commitment: 'confirmed', recipientAddress: maker.address, lamports: lamports(2_000_000_000n) });

    const laplace = new Laplace({ rpc, rpcSubscriptions, cluster });
    const slot = BigInt(await rpc.getSlot().send());
    const created = await laplace.createIntent({
      maker, receiver: maker.address, asset: { sol: true }, amount: 1_000_000n,
      expirySlot: slot + 10_000n, criterion: Condition.hashlock({}),
    });

    const { db, migrate, close } = await makeDb('memory://');
    await migrate();
    const src = rpcSource(rpc, 'confirmed');
    // poll until the createIntent signature is indexed (devnet finalization lag)
    let detail = null;
    for (let i = 0; i < 30 && !detail; i++) {
      await runOnce(db, src, { laplace: programs.laplace, validity: programs.validity }, 100);
      detail = await getIntent(db, created.intentPda);
      if (!detail) await new Promise((r) => setTimeout(r, 2000));
    }
    expect(detail?.intent.pda).toBe(created.intentPda);
    expect(detail?.intent.maker).toBe(maker.address);
    expect(detail?.intent.status).toBe('active');
    await close();
  }, 120_000);
});
