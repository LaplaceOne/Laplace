import { sha256 } from '@noble/hashes/sha256';
import type { ReadonlyUint8Array } from '@solana/kit';
import { VALIDITY_CONFIG_DOMAIN, VALIDITY_SPEC_VERSION, MAX_FIXED_PUBLIC_INPUTS_LEN } from '../constants.js';

export function hashConfig(
  guestElfHash: ReadonlyUint8Array,
  sp1VkeyHash: ReadonlyUint8Array,
  fixedPublicInputs: ReadonlyUint8Array,
): Uint8Array {
  if (fixedPublicInputs.length > MAX_FIXED_PUBLIC_INPUTS_LEN) throw new Error('fixed_public_inputs too large');
  const specBe = new Uint8Array([(VALIDITY_SPEC_VERSION >> 8) & 0xff, VALIDITY_SPEC_VERSION & 0xff]);
  const lenBe = new Uint8Array(4);
  new DataView(lenBe.buffer).setUint32(0, fixedPublicInputs.length, false);
  const buf = new Uint8Array(
    VALIDITY_CONFIG_DOMAIN.length + 2 + guestElfHash.length + sp1VkeyHash.length + 4 + fixedPublicInputs.length,
  );
  let o = 0;
  for (const part of [VALIDITY_CONFIG_DOMAIN, specBe, guestElfHash, sp1VkeyHash, lenBe, fixedPublicInputs]) {
    buf.set(part, o);
    o += part.length;
  }
  return sha256(buf);
}
