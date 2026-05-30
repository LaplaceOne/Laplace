use anchor_lang::prelude::*;
use solana_sha256_hasher::hash;

use crate::{
    constants::{HASH_FUNCTION_ID_SHA256, HASHLOCK_COMMITMENT_DOMAIN},
    error::ErrorCode,
};

#[derive(Accounts)]
#[instruction(request: laplace::CriterionVerificationRequest)]
pub struct VerifyCriterion {}

pub(crate) fn handler(
    _ctx: Context<VerifyCriterion>,
    request: laplace::CriterionVerificationRequest,
) -> Result<()> {
    validate_request(&request)
}

pub fn validate_request(request: &laplace::CriterionVerificationRequest) -> Result<()> {
    require!(
        request.interface_version == laplace::CRITERION_INTERFACE_VERSION,
        ErrorCode::InvalidCriterionProgram
    );
    require!(
        request.criterion_program == crate::id(),
        ErrorCode::InvalidCriterionProgram
    );
    require!(
        request.fulfillment_data.len() <= laplace::MAX_FULFILLMENT_DATA_LEN,
        ErrorCode::InvalidFulfillmentData
    );
    require!(
        !request.fulfillment_data.is_empty(),
        ErrorCode::InvalidFulfillmentData
    );

    // The fulfiller reveals the preimage `secret`; the hashlock is `h = SHA256(secret)`. The intent's
    // criterion_data_hash is NOT `h` directly — it is an intent-bound commitment over `h` plus the
    // intent's fields, so a revealed secret cannot be replayed against a different intent. The shared
    // secret still unlocks every leg of an atomic swap, because each leg recomputes the commitment with
    // its OWN fields (see docs/conditional-escrow.md "Criterion Commitment").
    let hashlock = hash_preimage(&request.fulfillment_data);
    let expected = hash_hashlock_commitment(request, &hashlock);
    require!(
        expected == request.criterion_data_hash,
        ErrorCode::InvalidPreimage
    );
    Ok(())
}

pub fn hash_preimage(preimage: &[u8]) -> [u8; 32] {
    hash(preimage).to_bytes()
}

pub fn preimage_matches(hashlock: &[u8; 32], preimage: &[u8]) -> bool {
    hash_preimage(preimage) == *hashlock
}

/// Intent-bound hashlock commitment:
/// `SHA256(domain ‖ u16be(version) ‖ criterion_program ‖ intent_id ‖ maker ‖ receiver ‖
///          refund_recipient ‖ asset ‖ u64be(amount) ‖ u64be(expiry_slot) ‖ hash_fn_id ‖ hashlock)`
/// where `hashlock = SHA256(secret)`. `created_slot` and the intent PDA are excluded — the maker does
/// not know them at commit time. Mirrored byte-for-byte by `@laplace/sdk` `hashHashlockCommitment`.
pub fn hash_hashlock_commitment(
    request: &laplace::CriterionVerificationRequest,
    hashlock: &[u8; 32],
) -> [u8; 32] {
    let mut data = Vec::with_capacity(256);
    data.extend_from_slice(HASHLOCK_COMMITMENT_DOMAIN);
    data.extend_from_slice(&request.interface_version.to_be_bytes());
    data.extend_from_slice(request.criterion_program.as_ref());
    data.extend_from_slice(&request.intent_id);
    data.extend_from_slice(request.maker.as_ref());
    data.extend_from_slice(request.receiver.as_ref());
    data.extend_from_slice(request.refund_recipient.as_ref());
    encode_asset(&request.asset, &mut data);
    data.extend_from_slice(&request.amount.to_be_bytes());
    data.extend_from_slice(&request.expiry_slot.to_be_bytes());
    data.push(HASH_FUNCTION_ID_SHA256);
    data.extend_from_slice(hashlock);
    hash(&data).to_bytes()
}

/// Canonical asset encoding for the commitment: NativeSol = `[0]`; SplToken = `[1] ‖ mint ‖ token_program`.
/// The vault is excluded — it is a deterministic ATA of the intent PDA + mint, so it adds no binding.
fn encode_asset(asset: &laplace::EscrowAsset, out: &mut Vec<u8>) {
    match asset {
        laplace::EscrowAsset::NativeSol => out.push(0u8),
        laplace::EscrowAsset::SplToken {
            mint,
            token_program,
            ..
        } => {
            out.push(1u8);
            out.extend_from_slice(mint.as_ref());
            out.extend_from_slice(token_program.as_ref());
        }
    }
}
