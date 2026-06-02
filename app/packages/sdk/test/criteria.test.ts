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
import { intentBindingHash } from '../src/binding.js';
import { hashConfig } from '../src/criteria/hash-config.js';
import { CRITERION_INTERFACE_VERSION, HASH_FUNCTION_ID_SHA256 } from '../src/constants.js';

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
  it('hashlock binds the intent: commitment = SHA256(intentBindingHash || hash_fn_id || SHA256(secret)), returns the secret', () => {
    const secret = new Uint8Array(32).fill(9);
    const c = ctx();
    const prep = Condition.hashlock({ secret }).prepare(c);
    expect(prep.programId).toBe(HASHLOCK);
    expect(prep.secret).toBeDefined();
    // bindingTag is always set
    expect(prep.bindingTag).toHaveLength(32);
    const tag = intentBindingHash(c);
    expect(Buffer.from(prep.bindingTag)).toEqual(Buffer.from(tag));
    // criterionDataHash = SHA256(bindingTag || hash_fn_id || SHA256(secret))
    const expected = sha256(new Uint8Array([...tag, HASH_FUNCTION_ID_SHA256, ...sha256(secret)]));
    expect(Buffer.from(prep.criterionDataHash)).toEqual(Buffer.from(expected));
  });

  it('hashHashlockCommitment uses intentBindingHash as the outer preimage (matches Condition.hashlock)', () => {
    const secret = new Uint8Array(32).fill(9);
    const c = ctx();
    const hashlock = sha256(secret);
    const fromHelper = hashHashlockCommitment({ ...c, hashlock });
    const fromCondition = Condition.hashlock({ secret }).prepare(c).criterionDataHash;
    expect(Buffer.from(fromHelper)).toEqual(Buffer.from(fromCondition));
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

  it('hashHashlockCommitment matches the independent byte layout: SHA256(intentBindingHash || hash_fn_id || hashlock)', () => {
    const c = ctx();
    const hashlock = new Uint8Array(32).fill(0xab);
    // Recompute intentBindingHash manually
    const enc = getAddressEncoder();
    const u16 = (n: number) => Buffer.from([(n >> 8) & 0xff, n & 0xff]);
    const u64 = (n: bigint) => {
      const b = Buffer.alloc(8);
      b.writeBigUInt64BE(n);
      return b;
    };
    const bindingPreimage = Buffer.concat([
      Buffer.from('laplace-intent-bind-v1', 'utf8'),
      u16(CRITERION_INTERFACE_VERSION),
      Buffer.from(enc.encode(c.criterionProgram)),
      Buffer.from(c.intentId),
      Buffer.from(enc.encode(c.maker)),
      Buffer.from(enc.encode(c.receiver)),
      Buffer.from(enc.encode(c.refundRecipient)),
      Buffer.from([0]), // NativeSol
      u64(c.amount),
      u64(c.expirySlot),
    ]);
    const bindingTag = createHash('sha256').update(bindingPreimage).digest();
    const commitmentPreimage = Buffer.concat([
      bindingTag,
      Buffer.from([HASH_FUNCTION_ID_SHA256]),
      Buffer.from(hashlock),
    ]);
    const expected = createHash('sha256').update(commitmentPreimage).digest('hex');
    expect(Buffer.from(hashHashlockCommitment({ ...c, hashlock })).toString('hex')).toBe(expected);
  });

  it('validity: criterionDataHash = configHash, bindingTag is set, requiredPublicInputPrefix = bindingTag', () => {
    const elf = new Uint8Array(32).fill(2),
      vkey = new Uint8Array(32).fill(3),
      fixed = new Uint8Array([7]);
    const c = ctx({ criterionProgram: address(VALIDITY) });
    const prep = Condition.validity({ guestElfHash: elf, sp1VkeyHash: vkey, fixedPublicInputs: fixed }).prepare(c);
    expect(prep.programId).toBe(VALIDITY);
    expect(Buffer.from(prep.criterionDataHash)).toEqual(Buffer.from(hashConfig(elf, vkey, fixed)));
    // bindingTag is always set
    expect(prep.bindingTag).toHaveLength(32);
    expect(Buffer.from(prep.bindingTag)).toEqual(Buffer.from(intentBindingHash(c)));
    // requiredPublicInputPrefix = bindingTag for validity
    expect(prep.requiredPublicInputPrefix).toBeDefined();
    expect(Buffer.from(prep.requiredPublicInputPrefix!)).toEqual(Buffer.from(prep.bindingTag));
  });

  it('validity: requiredPublicInputPrefix changes when intent changes (per-intent binding)', () => {
    const elf = new Uint8Array(32).fill(2),
      vkey = new Uint8Array(32).fill(3),
      fixed = new Uint8Array([7]);
    const spec = Condition.validity({ guestElfHash: elf, sp1VkeyHash: vkey, fixedPublicInputs: fixed });
    const prepA = spec.prepare(ctx({ intentId: new Uint8Array(32).fill(1) }));
    const prepB = spec.prepare(ctx({ intentId: new Uint8Array(32).fill(2) }));
    expect(Buffer.from(prepA.requiredPublicInputPrefix!)).not.toEqual(Buffer.from(prepB.requiredPublicInputPrefix!));
  });

  it('custom with literal criterionDataHash sets bindingTag without changing criterionDataHash', () => {
    const dataHash = new Uint8Array(32).fill(0xcd);
    const c = ctx();
    const prep = Condition.custom({ programId: address(HASHLOCK), criterionDataHash: dataHash }).prepare(c);
    expect(Buffer.from(prep.criterionDataHash)).toEqual(Buffer.from(dataHash));
    expect(prep.bindingTag).toHaveLength(32);
    expect(Buffer.from(prep.bindingTag)).toEqual(Buffer.from(intentBindingHash(c)));
    expect(prep.requiredPublicInputPrefix).toBeUndefined();
  });

  it('custom with bind callback derives criterionDataHash from bindingTag', () => {
    const c = ctx();
    const prep = Condition.custom({
      programId: address(HASHLOCK),
      bind: (tag) => sha256(tag),
    }).prepare(c);
    const tag = intentBindingHash(c);
    expect(Buffer.from(prep.criterionDataHash)).toEqual(Buffer.from(sha256(tag)));
    expect(Buffer.from(prep.bindingTag)).toEqual(Buffer.from(tag));
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
