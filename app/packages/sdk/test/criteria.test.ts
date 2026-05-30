import { describe, it, expect } from 'vitest';
import { sha256 } from '@noble/hashes/sha256';
import { address, AccountRole } from '@solana/kit';
import { Condition, hashlockFulfillment, validityFulfillment } from '../src/criteria/index.js';
import { hashConfig } from '../src/criteria/hash-config.js';

const HASHLOCK = '9FWQGf16ZB5wdrwg3gDCmUcpRJNVuzp1uG12C6z5RVTw';

describe('Condition', () => {
  it('hashlock with explicit secret commits sha256(secret) and returns the secret', () => {
    const secret = new Uint8Array(32).fill(9);
    const prep = Condition.hashlock({ secret }).resolve('localnet');
    expect(prep.programId).toBe(HASHLOCK);
    expect(Buffer.from(prep.criterionDataHash)).toEqual(Buffer.from(sha256(secret)));
    expect(prep.secret).toBeDefined();
  });
  it('hashlock with no args generates a 32-byte secret', () => {
    const prep = Condition.hashlock({}).resolve('localnet');
    expect(prep.secret).toHaveLength(32);
  });
  it('hashlock with hash uses it verbatim, no secret', () => {
    const h = new Uint8Array(32).fill(1);
    const prep = Condition.hashlock({ hash: h }).resolve('localnet');
    expect(Buffer.from(prep.criterionDataHash)).toEqual(Buffer.from(h));
    expect(prep.secret).toBeUndefined();
  });
  it('validity commits config_hash from guest inputs', () => {
    const elf = new Uint8Array(32).fill(2), vkey = new Uint8Array(32).fill(3), fixed = new Uint8Array([7]);
    const prep = Condition.validity({ guestElfHash: elf, sp1VkeyHash: vkey, fixedPublicInputs: fixed }).resolve('localnet');
    expect(Buffer.from(prep.criterionDataHash)).toEqual(Buffer.from(hashConfig(elf, vkey, fixed)));
  });
  it('hashlock fulfillment = secret bytes, 0 criterion accounts', () => {
    const secret = new Uint8Array([1, 2, 3]);
    const f = hashlockFulfillment({ secret });
    expect(Buffer.from(f.data)).toEqual(Buffer.from(secret));
    expect(f.criterionAccountCount).toBe(0);
    expect(f.criterionAccounts).toEqual([]);
  });
  it('validity fulfillment passes the config PDA as the single readonly criterion account', () => {
    const configPda = address('CuSVyvxRCfnsvvDWWqP8xRw8fNbGRwTdam5iKsqY3Kq1');
    const f = validityFulfillment({ proof: new Uint8Array(260), publicInputsSuffix: new Uint8Array([1]), configPda });
    expect(f.criterionAccountCount).toBe(1);
    expect(f.criterionAccounts).toEqual([{ address: configPda, role: AccountRole.READONLY }]);
    expect(f.data.length).toBeGreaterThan(260);
  });
});
