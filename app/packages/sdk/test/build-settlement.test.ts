import { describe, it, expect } from 'vitest';
import { address, generateKeyPairSigner } from '@solana/kit';
import { buildFulfillIntent, buildCloseIntent, buildRefundExpiredIntent, buildCreateValidityConfig } from '../src/instructions.js';
import { hashlockFulfillment } from '../src/criteria/index.js';
import type { Intent } from '../src/generated/laplace/index.js';

const intentAddress = address('9fYLFVoVqwH37C3dyPi6cpeobfbQ2jtLpN5HgAYDDdkm');
const receiver = address('Bkb7WhLQcnz52gYrSdExPoxZUs8b2fzwjzQwrhcv8ACG');

function solIntent(over: Partial<Intent> = {}): Intent {
  return { id: new Uint8Array(32), maker: intentAddress, receiver, refundRecipient: intentAddress,
    criterionProgram: address('9FWQGf16ZB5wdrwg3gDCmUcpRJNVuzp1uG12C6z5RVTw'),
    asset: { __kind: 'NativeSol' } as any, amount: 5n, expirySlot: 1000n, createdSlot: 1n,
    criterionDataHash: new Uint8Array(32), criterionInterfaceVersion: 2, status: 0 as any, bump: 255,
    discriminator: new Uint8Array(8),
    ...over } as Intent;
}

describe('settlement builders (SOL)', () => {
  it('fulfill: 3 fixed + 0 settlement for hashlock SOL', async () => {
    const fulfiller = await generateKeyPairSigner();
    const f = hashlockFulfillment({ secret: new Uint8Array([1, 2, 3]) });
    const { instructions } = await buildFulfillIntent({ fulfiller, intent: solIntent(), intentAddress, fulfillment: f });
    expect(instructions[0]!.accounts).toHaveLength(3);
  });
  it('refund: 2 fixed, no remaining for SOL', async () => {
    const cranker = await generateKeyPairSigner();
    const { instructions } = await buildRefundExpiredIntent({ cranker, intent: solIntent(), intentAddress });
    expect(instructions[0]!.accounts).toHaveLength(2);
  });
  it('close: 2 fixed, no remaining for SOL', async () => {
    const maker = await generateKeyPairSigner();
    const { instructions } = await buildCloseIntent({ maker, intent: solIntent({ maker: maker.address, status: 1 as any }), intentAddress });
    expect(instructions[0]!.accounts).toHaveLength(2);
  });
  it('createValidityConfig derives config PDA + hash', async () => {
    const payer = await generateKeyPairSigner();
    const out = await buildCreateValidityConfig({ payer, guestElfHash: new Uint8Array(32).fill(1), sp1VkeyHash: new Uint8Array(32).fill(2), fixedPublicInputs: new Uint8Array([9]) });
    expect(out.configPda).toBeTypeOf('string');
    expect(out.configHash).toHaveLength(32);
  });
});
