use anchor_lang::prelude::*;
use solana_sha256_hasher::hash;

use crate::constants::VALIDITY_SPEC_VERSION;

#[account]
pub struct ValidityConfig {
    pub config_hash: [u8; 32],
    pub guest_elf_hash: [u8; 32],
    pub sp1_vkey_hash: [u8; 32],
    pub fixed_public_inputs: Vec<u8>,
    pub bump: u8,
}

impl ValidityConfig {
    pub fn space(fixed_public_inputs_len: usize) -> usize {
        32 + 32 + 32 + 4 + fixed_public_inputs_len + 1
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateValidityArgs {
    pub config_hash: [u8; 32],
    pub guest_elf_hash: [u8; 32],
    pub sp1_vkey_hash: [u8; 32],
    pub fixed_public_inputs: Vec<u8>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ValidityFulfillment {
    pub proof: Vec<u8>,
    pub public_inputs_suffix: Vec<u8>,
}

pub fn hash_config(
    guest_elf_hash: &[u8; 32],
    sp1_vkey_hash: &[u8; 32],
    fixed_public_inputs: &[u8],
) -> [u8; 32] {
    let mut data = Vec::with_capacity(2 + 32 + 32 + 4 + fixed_public_inputs.len());
    data.extend_from_slice(b"validity-config-v1");
    data.extend_from_slice(&VALIDITY_SPEC_VERSION.to_be_bytes());
    data.extend_from_slice(guest_elf_hash);
    data.extend_from_slice(sp1_vkey_hash);
    data.extend_from_slice(&(fixed_public_inputs.len() as u32).to_be_bytes());
    data.extend_from_slice(fixed_public_inputs);
    hash(&data).to_bytes()
}

/// Reconstruct the full public-input vector for SP1 Groth16 verification.
///
/// Layout (mandatory):
/// ```text
/// intent_binding_tag (32) ‖ config.fixed_public_inputs ‖ fulfillment.public_inputs_suffix
/// ```
///
/// The 32-byte `intent_binding_tag` is `laplace::binding::intent_binding_hash(request)` and is
/// injected by the adapter — it MUST NOT appear in `fixed_public_inputs`.
/// `fixed_public_inputs` now holds ONLY criterion-specific constants (ELF parameters, threshold
/// values, etc.); intent-identity fields are injected by the adapter via the binding tag.
///
/// # Guest-authoring contract
/// The SP1 guest MUST commit the 32-byte `intent_binding_hash` as its **leading** public input,
/// followed by its fixed values, then any suffix values.
pub fn reconstruct_public_inputs(
    intent_binding_tag: &[u8; 32],
    fixed_public_inputs: &[u8],
    suffix: &[u8],
) -> Vec<u8> {
    let mut public_inputs =
        Vec::with_capacity(32 + fixed_public_inputs.len() + suffix.len());
    public_inputs.extend_from_slice(intent_binding_tag);
    public_inputs.extend_from_slice(fixed_public_inputs);
    public_inputs.extend_from_slice(suffix);
    public_inputs
}

pub fn format_sp1_vkey_hash(sp1_vkey_hash: &[u8; 32]) -> String {
    format!("0x{}", hex::encode(sp1_vkey_hash))
}
