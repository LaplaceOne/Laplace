// End-to-end Laplace lifecycle smoke test against a live cluster (default: devnet).
// Creates a hashlock/SOL intent, fulfills it (reveal), and closes it — exercising the deployed
// programs + SDK end to end, and leaving a real intent for the indexer to ingest.
//
//   # with your own funded devnet keypair (recommended; faucet is rate-limited):
//   DEVNET_KEYPAIR=~/.config/solana/id.json node app/scripts/devnet-lifecycle.mjs
//
//   # or let it generate a key and try to airdrop (often rate-limited):
//   node app/scripts/devnet-lifecycle.mjs
//
// Env: LAPLACE_CLUSTER (devnet), LAPLACE_RPC_URL (override), DEVNET_KEYPAIR (solana keypair json).
import fs from 'node:fs';
import {
  createSolanaRpc, createSolanaRpcSubscriptions, generateKeyPairSigner,
  createKeyPairSignerFromBytes, airdropFactory, lamports,
} from '@solana/kit';
import { Laplace, Condition, nativeSol, minutesToSlots, fetchIntent, mapLaplaceError } from '@laplace-one/sdk';
import { getCluster } from '@laplace-one/registry';

const cluster = process.env.LAPLACE_CLUSTER ?? 'devnet';
const url = process.env.LAPLACE_RPC_URL ?? getCluster(cluster).rpcUrl;
const rpc = createSolanaRpc(url);
const rpcSubscriptions = createSolanaRpcSubscriptions(url.replace(/^http/, 'ws'));

async function loadMaker() {
  if (process.env.DEVNET_KEYPAIR) {
    const path = process.env.DEVNET_KEYPAIR.replace(/^~/, process.env.HOME ?? '');
    const bytes = Uint8Array.from(JSON.parse(fs.readFileSync(path, 'utf8')));
    return createKeyPairSignerFromBytes(bytes);
  }
  const m = await generateKeyPairSigner();
  console.log('generated maker', m.address, '— requesting airdrop (may be rate-limited)…');
  await airdropFactory({ rpc, rpcSubscriptions })({
    recipientAddress: m.address, lamports: lamports(200_000_000n), commitment: 'confirmed',
  });
  return m;
}

async function main() {
  const maker = await loadMaker();
  const { value: balance } = await rpc.getBalance(maker.address).send();
  console.log(`maker: ${maker.address}  balance: ${Number(balance) / 1e9} SOL  cluster: ${cluster}`);
  if (Number(balance) < 15_000_000) throw new Error('maker needs ~0.015+ devnet SOL (rent + escrow + fee)');

  const client = new Laplace({ rpc, rpcSubscriptions, cluster });
  const slot = await rpc.getSlot().send();
  const expirySlot = slot + minutesToSlots(60);

  console.log('\n[1/3] createIntent (SOL 0.01, hashlock, receiver = maker)…');
  const created = await client.createIntent({
    maker, receiver: maker.address, asset: nativeSol(),
    amount: 10_000_000n, expirySlot, criterion: Condition.hashlock({}),
  });
  console.log('  ✓', created.signature, '\n  intent:', created.intentPda);

  const ri = await fetchIntent(rpc, created.intentPda);
  console.log('\n[2/3] fulfillIntent (reveal preimage)…');
  const f = await client.fulfillIntent(ri, { secret: created.secret }, { fulfiller: maker });
  console.log('  ✓', f.signature);

  const ri2 = await fetchIntent(rpc, created.intentPda);
  console.log('\n[3/3] closeIntent (reclaim rent)…');
  const c = await client.closeIntent(ri2, { maker });
  console.log('  ✓', c.signature);

  console.log(`\n✅ Full lifecycle confirmed on ${cluster}. Intent ${created.intentPda} created → fulfilled → closed.`);
}

main().catch((e) => {
  console.error('\n❌ failed:', mapLaplaceError(e).message);
  console.error(e);
  process.exit(1);
});
