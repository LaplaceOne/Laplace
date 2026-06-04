use anchor_lang::prelude::*;
use solana_sha256_hasher::hash;

use crate::{constants::HASH_FUNCTION_ID_SHA256, error::ErrorCode};

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
/// `SHA256( intent_binding_hash(request) ‖ hash_fn_id ‖ SHA256(secret) )`
///
/// `intent_binding_hash` is the shared, domain-separated canonical binding defined in the `laplace`
/// crate (see `programs/laplace/src/binding.rs`). Using it here means the domain and field
/// serialization live in exactly one place. Mirrored byte-for-byte by `@laplace-one/sdk`
/// `hashHashlockCommitment`.
pub fn hash_hashlock_commitment(
    request: &laplace::CriterionVerificationRequest,
    hashlock: &[u8; 32],
) -> [u8; 32] {
    let binding_tag = laplace::binding::intent_binding_hash(request);
    // capacity: 32 (tag) + 1 (hash_fn_id) + 32 (hashlock) = 65
    let mut data = Vec::with_capacity(65);
    data.extend_from_slice(&binding_tag);
    data.push(HASH_FUNCTION_ID_SHA256);
    data.extend_from_slice(hashlock);
    hash(&data).to_bytes()
}
