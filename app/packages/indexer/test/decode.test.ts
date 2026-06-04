import { describe, it, expect } from 'vitest';
import {
  getAddressEncoder, getStructEncoder, getBytesEncoder, fixEncoderSize,
  getU16Encoder, getU64Encoder,
} from '@solana/kit';
// `getEscrowAssetEncoder` is exposed namespaced under each program in @laplace-one/sdk/raw
// (the generated barrel uses `export * as laplaceProgram`), not as a top-level export.
import { laplaceProgram } from '@laplace-one/sdk/raw';
import { EVENT_DISCRIMINATORS } from '@laplace-one/sdk';
import { decodeTxEvents, type RawTx } from '../src/ingest/decode.js';

const getEscrowAssetEncoder = laplaceProgram.getEscrowAssetEncoder;

const PDA = '11111111111111111111111111111111';
const KEY = 'So11111111111111111111111111111111111111112';

const createdEncoder = getStructEncoder([
  ['intent', getAddressEncoder()], ['id', fixEncoderSize(getBytesEncoder(), 32)],
  ['maker', getAddressEncoder()], ['receiver', getAddressEncoder()],
  ['refundRecipient', getAddressEncoder()], ['criterionProgram', getAddressEncoder()],
  ['criterionDataHash', fixEncoderSize(getBytesEncoder(), 32)], ['criterionInterfaceVersion', getU16Encoder()],
  ['asset', getEscrowAssetEncoder()], ['amount', getU64Encoder()],
  ['expirySlot', getU64Encoder()], ['createdSlot', getU64Encoder()],
]);

function programData(disc: Uint8Array, payload: Uint8Array): string {
  const d = new Uint8Array(disc.length + payload.length);
  d.set(disc, 0); d.set(payload, disc.length);
  return `Program data: ${Buffer.from(d).toString('base64')}`;
}

describe('decodeTxEvents', () => {
  it('maps a successful tx with an IntentCreated log to one event row', () => {
    const payload = createdEncoder.encode({
      intent: PDA, id: new Uint8Array(32).fill(1), maker: KEY, receiver: KEY, refundRecipient: KEY,
      criterionProgram: KEY, criterionDataHash: new Uint8Array(32).fill(2), criterionInterfaceVersion: 2,
      asset: { __kind: 'NativeSol' }, amount: 7n, expirySlot: 99n, createdSlot: 10n,
    });
    const tx: RawTx = {
      signature: 'sigA', slot: 10, blockTime: 1700000000, err: null,
      logMessages: ['Program log: Instruction: CreateIntent', programData(EVENT_DISCRIMINATORS.IntentCreated, new Uint8Array(payload))],
    };
    const rows = decodeTxEvents(tx, 'laplace');
    expect(rows).toHaveLength(1);
    // Scalar columns live on the row; `amount` (a bigint) is stringified inside the jsonb payload,
    // not a top-level `events` column — asserting it there keeps the row insertable as-is.
    expect(rows[0]).toMatchObject({ signature: 'sigA', eventIndex: 0, kind: 'IntentCreated', intentPda: PDA });
    expect((rows[0]?.payload as { amount: string }).amount).toBe('7');
  });

  it('returns no rows for a failed tx', () => {
    const tx: RawTx = { signature: 'bad', slot: 1, blockTime: null, err: { some: 'error' }, logMessages: [] };
    expect(decodeTxEvents(tx, 'laplace')).toHaveLength(0);
  });
});
