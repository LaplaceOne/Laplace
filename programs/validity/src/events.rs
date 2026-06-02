use anchor_lang::prelude::*;

#[event]
pub struct ValidityConfigCreated {
    pub config: Pubkey,
    pub config_hash: [u8; 32],
    pub guest_elf_hash: [u8; 32],
    pub sp1_vkey_hash: [u8; 32],
    pub fixed_public_inputs_len: u32,
    pub payer: Pubkey,
}
