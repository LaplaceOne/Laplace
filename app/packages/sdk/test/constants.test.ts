import { describe, it, expect } from 'vitest';
import {
  CRITERION_INTERFACE_VERSION, MAX_FULFILLMENT_DATA_LEN, VERIFY_CRITERION_DISCRIMINATOR,
  INTENT_SEED, VALIDITY_SEED, VALIDITY_SPEC_VERSION, VALIDITY_CONFIG_DOMAIN,
  MIN_SP1_GROTH16_PROOF_LEN, MAX_FIXED_PUBLIC_INPUTS_LEN,
} from '../src/constants.js';

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

describe('protocol constants', () => {
  it('match the on-chain programs', () => {
    expect(CRITERION_INTERFACE_VERSION).toBe(2);
    expect(MAX_FULFILLMENT_DATA_LEN).toBe(1024);
    expect(hex(VERIFY_CRITERION_DISCRIMINATOR)).toBe('8c7b8b8567d572ab');
    expect(new TextDecoder().decode(INTENT_SEED)).toBe('intent');
    expect(new TextDecoder().decode(VALIDITY_SEED)).toBe('validity');
    expect(VALIDITY_SPEC_VERSION).toBe(1);
    expect(new TextDecoder().decode(VALIDITY_CONFIG_DOMAIN)).toBe('validity-config-v1');
    expect(MIN_SP1_GROTH16_PROOF_LEN).toBe(260);
    expect(MAX_FIXED_PUBLIC_INPUTS_LEN).toBe(1024);
  });
});
