import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { hashConfig } from '../src/criteria/hash-config.js';

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

describe('hashConfig', () => {
  it('matches the on-chain preimage: domain || u16be(1) || elf || vkey || u32be(len) || fixed', () => {
    const elf = new Uint8Array(32).fill(0xaa);
    const vkey = new Uint8Array(32).fill(0xbb);
    const fixed = new Uint8Array([1, 2, 3, 4, 5]);
    const parts = Buffer.concat([
      Buffer.from('validity-config-v1', 'utf8'),
      Buffer.from([0x00, 0x01]),
      Buffer.from(elf), Buffer.from(vkey),
      Buffer.from([0x00, 0x00, 0x00, 0x05]),
      Buffer.from(fixed),
    ]);
    const expected = createHash('sha256').update(parts).digest('hex');
    expect(hex(hashConfig(elf, vkey, fixed))).toBe(expected);
  });
});
