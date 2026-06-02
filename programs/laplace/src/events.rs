use anchor_lang::prelude::*;

use crate::{EscrowAsset, IntentStatus};

#[event]
pub struct IntentCreated {
    pub intent: Pubkey,
    pub id: [u8; 32],
    pub maker: Pubkey,
    pub receiver: Pubkey,
    pub refund_recipient: Pubkey,
    pub criterion_program: Pubkey,
    pub criterion_data_hash: [u8; 32],
    pub criterion_interface_version: u16,
    pub asset: EscrowAsset,
    pub amount: u64,
    pub expiry_slot: u64,
    pub created_slot: u64,
}

#[event]
pub struct IntentFulfilled {
    pub intent: Pubkey,
    pub id: [u8; 32],
    pub maker: Pubkey,
    pub receiver: Pubkey,
    pub criterion_program: Pubkey,
    pub asset: EscrowAsset,
    pub amount: u64,
    pub slot: u64,
}

#[event]
pub struct IntentRefunded {
    pub intent: Pubkey,
    pub id: [u8; 32],
    pub maker: Pubkey,
    pub refund_recipient: Pubkey,
    pub asset: EscrowAsset,
    pub amount: u64,
    pub slot: u64,
}

#[event]
pub struct IntentClosed {
    pub intent: Pubkey,
    pub id: [u8; 32],
    pub maker: Pubkey,
    pub final_status: IntentStatus,
    pub slot: u64,
}
