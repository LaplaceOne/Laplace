const utf8 = (s: string) => new TextEncoder().encode(s);
export const CRITERION_INTERFACE_VERSION = 2;
export const MAX_FULFILLMENT_DATA_LEN = 1024;
export const VERIFY_CRITERION_DISCRIMINATOR = new Uint8Array([0x8c, 0x7b, 0x8b, 0x85, 0x67, 0xd5, 0x72, 0xab]);
export const INTENT_SEED = utf8('intent');
export const VALIDITY_SEED = utf8('validity');
export const VALIDITY_SPEC_VERSION = 1;
export const VALIDITY_CONFIG_DOMAIN = utf8('validity-config-v1');
export const MIN_SP1_GROTH16_PROOF_LEN = 260;
export const MAX_FIXED_PUBLIC_INPUTS_LEN = 1024;
// Intent-bound hashlock commitment domain + hash-function id (mirror programs/hashlock/src/constants.rs).
export const HASHLOCK_COMMITMENT_DOMAIN = utf8('laplace-hashlock-commit-v1');
export const HASH_FUNCTION_ID_SHA256 = 0;
