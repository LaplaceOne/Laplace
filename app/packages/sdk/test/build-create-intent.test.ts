import { describe, it, expect } from 'vitest';
import { address, generateKeyPairSigner } from '@solana/kit';
import { buildCreateIntent } from '../src/instructions.js';
import { nativeSol, splToken } from '../src/asset.js';
import { Condition } from '../src/criteria/index.js';

const LAPLACE = 'Bkb7WhLQcnz52gYrSdExPoxZUs8b2fzwjzQwrhcv8ACG';
const receiver = address('9fYLFVoVqwH37C3dyPi6cpeobfbQ2jtLpN5HgAYDDdkm');

describe('buildCreateIntent', () => {
  it('SOL: one instruction, 3 accounts [maker, intentPda, systemProgram]', async () => {
    const maker = await generateKeyPairSigner();
    const built = await buildCreateIntent({
      maker, receiver, asset: nativeSol(), amount: 5_000_000_000n, expirySlot: 1000n,
      criterion: Condition.hashlock({ secret: new Uint8Array(32).fill(1) }).resolve('localnet'),
    });
    expect(built.instructions).toHaveLength(1);
    const ix = built.instructions[0]!;
    expect(ix.programAddress).toBe(LAPLACE);
    expect(ix.accounts).toHaveLength(3);
    expect(ix.accounts![1]!.address).toBe(built.intentPda);
    expect(built.secret).toBeDefined();
  });
  it('SPL: prepends an idempotent vault-ATA create, then create_intent with 4 remaining accounts', async () => {
    const maker = await generateKeyPairSigner();
    const mint = address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    const built = await buildCreateIntent({
      maker, receiver, asset: splToken({ mint }), amount: 1_200_000_000n, expirySlot: 1000n,
      criterion: Condition.hashlock({ secret: new Uint8Array(32).fill(1) }).resolve('localnet'),
    });
    // [0] = create-vault-ATA (idempotent), [1] = create_intent
    expect(built.instructions).toHaveLength(2);
    const createIx = built.instructions.find((i) => i.programAddress === LAPLACE)!;
    expect(createIx.accounts).toHaveLength(7); // 3 fixed + 4 remaining [makerATA, vault, mint, tokenProgram]
  });
});
