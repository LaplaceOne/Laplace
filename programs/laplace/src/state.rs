use anchor_lang::prelude::*;

#[account]
pub struct Intent {
    pub id: [u8; 32],
    pub maker: Pubkey,
    pub receiver: Pubkey,
    pub refund_recipient: Pubkey,
    pub criterion_program: Pubkey,
    pub asset: EscrowAsset,
    pub amount: u64,
    pub expiry_slot: u64,
    pub created_slot: u64,
    pub criterion_data_hash: [u8; 32],
    pub criterion_interface_version: u16,
    pub status: IntentStatus,
    pub bump: u8,
}

impl Intent {
    pub const LEN: usize = 32 // id
        + 32 // maker
        + 32 // receiver
        + 32 // refund_recipient
        + 32 // criterion_program
        + EscrowAsset::LEN
        + 8 // amount
        + 8 // expiry_slot
        + 8 // created_slot
        + 32 // criterion_data_hash
        + 2 // criterion_interface_version
        + IntentStatus::LEN
        + 1; // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum EscrowAsset {
    NativeSol,
    SplToken {
        mint: Pubkey,
        token_program: Pubkey,
        vault: Pubkey,
    },
}

impl EscrowAsset {
    pub const LEN: usize = 1 + 32 + 32 + 32;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum IntentStatus {
    Active,
    Fulfilled,
    Refunded,
}

impl IntentStatus {
    pub const LEN: usize = 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateIntentArgs {
    pub id: [u8; 32],
    pub receiver: Pubkey,
    pub refund_recipient: Pubkey,
    pub criterion_program: Pubkey,
    pub asset: EscrowAsset,
    pub amount: u64,
    pub expiry_slot: u64,
    pub criterion_data_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CriterionVerificationRequest {
    pub interface_version: u16,
    pub protocol_program: Pubkey,
    pub intent: Pubkey,
    pub intent_id: [u8; 32],
    pub maker: Pubkey,
    pub receiver: Pubkey,
    pub refund_recipient: Pubkey,
    pub asset: EscrowAsset,
    pub amount: u64,
    pub expiry_slot: u64,
    pub created_slot: u64,
    pub criterion_program: Pubkey,
    pub criterion_data_hash: [u8; 32],
    pub fulfillment_data: Vec<u8>,
}
