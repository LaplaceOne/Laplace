import { describe, it, expect } from 'vitest';
import {
  getAddressEncoder, getStructEncoder, getBytesEncoder, fixEncoderSize,
  getU16Encoder, getU32Encoder, getU64Encoder,
} from '@solana/kit';
import { getEscrowAssetEncoder, getIntentStatusEncoder, IntentStatus } from '../src/generated/laplace/index.js';
import { parseLaplaceEvents, EVENT_DISCRIMINATORS } from '../src/events.js';

const PDA = '11111111111111111111111111111111';
const KEY = 'So11111111111111111111111111111111111111112';
const ID = new Uint8Array(32).fill(7);
const HASH = new Uint8Array(32).fill(9);

function programData(disc: Uint8Array, payload: Uint8Array): string {
  const data = new Uint8Array(disc.length + payload.length);
  data.set(disc, 0); data.set(payload, disc.length);
  return `Program data: ${Buffer.from(data).toString('base64')}`;
}

const fulfilledEncoder = getStructEncoder([
  ['intent', getAddressEncoder()],
  ['id', fixEncoderSize(getBytesEncoder(), 32)],
  ['maker', getAddressEncoder()],
  ['receiver', getAddressEncoder()],
  ['criterionProgram', getAddressEncoder()],
  ['asset', getEscrowAssetEncoder()],
  ['amount', getU64Encoder()],
  ['slot', getU64Encoder()],
]);

describe('parseLaplaceEvents', () => {
  it('decodes an IntentFulfilled event from a Program data log line', () => {
    const payload = fulfilledEncoder.encode({
      intent: PDA, id: ID, maker: KEY, receiver: KEY, criterionProgram: KEY,
      asset: { __kind: 'NativeSol' }, amount: 10_000n, slot: 42n,
    });
    const logs = [
      'Program log: Instruction: FulfillWithCriterion',
      programData(EVENT_DISCRIMINATORS.IntentFulfilled, new Uint8Array(payload)),
    ];
    const events = parseLaplaceEvents(logs);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'IntentFulfilled', intent: PDA, receiver: KEY, amount: 10_000n, slot: 42n });
  });

  it('ignores non-matching Program data lines', () => {
    const logs = [programData(new Uint8Array(8).fill(1), new Uint8Array([1, 2, 3]))];
    expect(parseLaplaceEvents(logs)).toHaveLength(0);
  });

  it('exposes the precomputed Anchor discriminators', () => {
    expect(Array.from(EVENT_DISCRIMINATORS.IntentCreated)).toEqual([184,46,156,205,169,254,11,108]);
    expect(Array.from(EVENT_DISCRIMINATORS.ValidityConfigCreated)).toEqual([136,66,149,229,23,83,60,14]);
  });
});
