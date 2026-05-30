use anchor_lang::prelude::*;
use solana_sha256_hasher::hash;

use crate::error::ErrorCode;

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

    require!(
        preimage_matches(&request.criterion_data_hash, &request.fulfillment_data),
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
