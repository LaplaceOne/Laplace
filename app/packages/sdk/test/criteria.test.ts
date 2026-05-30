import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { sha256 } from '@noble/hashes/sha256';
import { address, AccountRole, getAddressEncoder } from '@solana/kit';
import {
  Condition,
  hashlockFulfillment,
  validityFulfillment,
  hashHashlockCommitment,
  type CommitContext,
} from '../src/criteria/index.js';
import { hashConfig } from '../src/criteria/hash-config.js';
import { CRITERION_INTERFACE_VERSION } from '../src/constants.js';

const HASHLOCK = 'DNotXVWh1ifzp9MHSd5H4F78SRHptF9p8vGfMmjtuWX2';
const VALIDITY = 'EQfH4VFdxcFYh8prdAsB4XwKCZiiR5uta594bfiwhLsB';
const maker = address('9fYLFVoVqwH37C3dyPi6cpeobfbQ2jtLpN5HgAYDDdkm');
const receiver = address('5ozBamUtiAHCkiipAVL9E8v8r54HqZsHMDbkHdczpidu');

function ctx(over: Partial<CommitContext> = {}): CommitContext {
  return {
    cluster: 'localnet',
    criterionProgram: address(HASHLOCK),
    interfaceVersion: CRITERION_INTERFACE_VERSION,
    intentId: new Uint8Array(32).fill(5),
    maker,
    receiver,
    refundRecipient: maker,
    asset: { sol: true },
    amount: 1000n,
    expirySlot: 2000n,
    ...over,
  };
}

describe('Condition', () => {
  it('hashlock binds the intent: commitment = hashHashlockCommitment(ctx, sha256(secret)), returns the secret', () => {
    const secret = new Uint8Array(32).fill(9);
    const c = ctx();
    const prep = Condition.hashlock({ secret }).prepare(c);
    expect(prep.programId).toBe(HASHLOCK);
    expect(prep.secret).toBeDefined();
    expect(Buffer.from(prep.criterionDataHash)).toEqual(Buffer.from(hashHashlockCommitment({ ...c, hashlock: sha256(secret) })));
  });

  it('the same secret yields DIFFERENT commitments across intents (replay-resistant, atomic-swap-safe)', () => {
    const secret = new Uint8Array(32).fill(9);
    const a = Condition.hashlock({ secret }).prepare(ctx({ intentId: new Uint8Array(32).fill(1) }));
    const b = Condition.hashlock({ secret }).prepare(ctx({ intentId: new Uint8Array(32).fill(2) }));
    expect(Buffer.from(a.criterionDataHash)).not.toEqual(Buffer.from(b.criterionDataHash));
  });

  it('hashlock with no args generates a 32-byte secret', () => {
    expect(Condition.hashlock({}).prepare(ctx()).secret).toHaveLength(32);
  });

  it('hashlock with a precomputed hash h uses it as the inner hashlock, no secret', () => {
    const h = sha256(new Uint8Array(32).fill(7));
    const c = ctx();
    const prep = Condition.hashlock({ hash: h }).prepare(c);
    expect(prep.secret).toBeUndefined();
    expect(Buffer.from(prep.criterionDataHash)).toEqual(Buffer.from(hashHashlockCommitment({ ...c, hashlock: h })));
  });

  it('hashHashlockCommitment matches the independent byte layout (mirror of the Rust adapter)', () => {
    const c = ctx();
    const hashlock = new Uint8Array(32).fill(0xab);
    const enc = getAddressEncoder();
    const u16 = (n: number) => Buffer.from([(n >> 8) & 0xff, n & 0xff]);
    const u64 = (n: bigint) => {
      const b = Buffer.alloc(8);
      b.writeBigUInt64BE(n);
      return b;
    };
    const parts = Buffer.concat([
      Buffer.from('laplace-hashlock-commit-v1', 'utf8'),
      u16(CRITERION_INTERFACE_VERSION),
      Buffer.from(enc.encode(c.criterionProgram)),
      Buffer.from(c.intentId),
      Buffer.from(enc.encode(c.maker)),
      Buffer.from(enc.encode(c.receiver)),
      Buffer.from(enc.encode(c.refundRecipient)),
      Buffer.from([0]), // NativeSol
      u64(c.amount),
      u64(c.expirySlot),
      Buffer.from([0]), // hash_function_id = sha256
      Buffer.from(hashlock),
    ]);
    const expected = createHash('sha256').update(parts).digest('hex');
    expect(Buffer.from(hashHashlockCommitment({ ...c, hashlock })).toString('hex')).toBe(expected);
  });

  it('validity commits config_hash and ignores the intent context', () => {
    const elf = new Uint8Array(32).fill(2),
      vkey = new Uint8Array(32).fill(3),
      fixed = new Uint8Array([7]);
    const prep = Condition.validity({ guestElfHash: elf, sp1VkeyHash: vkey, fixedPublicInputs: fixed }).prepare(
      ctx({ criterionProgram: address(VALIDITY) }),
    );
    expect(prep.programId).toBe(VALIDITY);
    expect(Buffer.from(prep.criterionDataHash)).toEqual(Buffer.from(hashConfig(elf, vkey, fixed)));
  });

  it('hashlock fulfillment = secret bytes, 0 criterion accounts', () => {
    const f = hashlockFulfillment({ secret: new Uint8Array([1, 2, 3]) });
    expect(Buffer.from(f.data)).toEqual(Buffer.from([1, 2, 3]));
    expect(f.criterionAccountCount).toBe(0);
    expect(f.criterionAccounts).toEqual([]);
  });

  it('validity fulfillment passes the config PDA as the single readonly criterion account', () => {
    const configPda = address(VALIDITY);
    const f = validityFulfillment({ proof: new Uint8Array(260), publicInputsSuffix: new Uint8Array([1]), configPda });
    expect(f.criterionAccountCount).toBe(1);
    expect(f.criterionAccounts).toEqual([{ address: configPda, role: AccountRole.READONLY }]);
    expect(f.data.length).toBeGreaterThan(260);
  });
});
