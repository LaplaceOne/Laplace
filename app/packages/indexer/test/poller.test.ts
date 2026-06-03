import { describe, it, expect } from 'vitest';
import {
  getAddressEncoder, getStructEncoder, getBytesEncoder, fixEncoderSize, getU16Encoder, getU64Encoder,
} from '@solana/kit';
// `getEscrowAssetEncoder` is exposed namespaced under each program in @laplace/sdk/raw
// (the generated barrel uses `export * as laplaceProgram`), not as a top-level export.
import { laplaceProgram } from '@laplace/sdk/raw';
import { EVENT_DISCRIMINATORS } from '@laplace/sdk';
import { makeDb } from '../src/db/client.js';
import { runOnce } from '../src/ingest/poller.js';
import type { ChainSource, SigInfo } from '../src/ingest/rpc.js';
import type { RawTx } from '../src/ingest/decode.js';
import { intents, syncState } from '../src/db/schema.js';

const getEscrowAssetEncoder = laplaceProgram.getEscrowAssetEncoder;

const PDA = '11111111111111111111111111111111';
const KEY = 'So11111111111111111111111111111111111111112';
const createdEncoder = getStructEncoder([
  ['intent', getAddressEncoder()], ['id', fixEncoderSize(getBytesEncoder(), 32)], ['maker', getAddressEncoder()],
  ['receiver', getAddressEncoder()], ['refundRecipient', getAddressEncoder()], ['criterionProgram', getAddressEncoder()],
  ['criterionDataHash', fixEncoderSize(getBytesEncoder(), 32)], ['criterionInterfaceVersion', getU16Encoder()],
  ['asset', getEscrowAssetEncoder()], ['amount', getU64Encoder()], ['expirySlot', getU64Encoder()], ['createdSlot', getU64Encoder()],
]);
function pd(disc: Uint8Array, payload: Uint8Array): string {
  const d = new Uint8Array(disc.length + payload.length); d.set(disc); d.set(payload, disc.length);
  return `Program data: ${Buffer.from(d).toString('base64')}`;
}

function mockSource(): ChainSource {
  const payload = createdEncoder.encode({
    intent: PDA, id: new Uint8Array(32).fill(1), maker: KEY, receiver: KEY, refundRecipient: KEY,
    criterionProgram: KEY, criterionDataHash: new Uint8Array(32).fill(2), criterionInterfaceVersion: 2,
    asset: { __kind: 'NativeSol' }, amount: 500n, expirySlot: 99n, createdSlot: 10n,
  });
  const tx: RawTx = { signature: 'sigA', slot: 10, blockTime: 1, err: null, logMessages: [pd(EVENT_DISCRIMINATORS.IntentCreated, new Uint8Array(payload))] };
  return {
    async getSignatures(program): Promise<SigInfo[]> {
      return program === 'laplaceProg' ? [{ signature: 'sigA', slot: 10, err: null }] : [];
    },
    async getTx() { return tx; },
  };
}

describe('runOnce', () => {
  it('ingests new signatures into events + intents and advances the cursor', async () => {
    const { db, migrate, close } = await makeDb('memory://');
    await migrate();
    await runOnce(db, mockSource(), { laplace: 'laplaceProg', validity: 'validityProg' }, 1000);
    const rows = await db.select().from(intents);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('active');
    expect(rows[0]?.amount).toBe('500');
    const sync = await db.select().from(syncState);
    const laplaceCursor = sync.find((s) => s.program === 'laplace');
    expect(laplaceCursor?.lastSignature).toBe('sigA');
    await close();
  });
});
