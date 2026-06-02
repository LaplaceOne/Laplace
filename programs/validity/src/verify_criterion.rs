use anchor_lang::prelude::*;
use sp1_solana::{verify_proof, GROTH16_VK_5_0_0_BYTES};

use crate::{
    constants::{MIN_SP1_GROTH16_PROOF_LEN, VALIDITY_SEED},
    error::ErrorCode,
    format_sp1_vkey_hash, reconstruct_public_inputs, ValidityConfig, ValidityFulfillment,
};

#[derive(Accounts)]
#[instruction(request: laplace::CriterionVerificationRequest)]
pub struct VerifyCriterion<'info> {
    #[account(
        seeds = [VALIDITY_SEED, request.criterion_data_hash.as_ref()],
        bump = config.bump,
        constraint = config.config_hash == request.criterion_data_hash @ ErrorCode::InvalidConfigHash
    )]
    pub config: Account<'info, ValidityConfig>,
}

pub(crate) fn handler(
    ctx: Context<VerifyCriterion>,
    request: laplace::CriterionVerificationRequest,
) -> Result<()> {
    validate_request(&ctx.accounts.config, &request)
}

pub fn validate_request(
    config: &ValidityConfig,
    request: &laplace::CriterionVerificationRequest,
) -> Result<()> {
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

    let fulfillment = ValidityFulfillment::try_from_slice(&request.fulfillment_data)
        .map_err(|_| error!(ErrorCode::InvalidFulfillmentData))?;
    require!(
        fulfillment.proof.len() >= MIN_SP1_GROTH16_PROOF_LEN,
        ErrorCode::InvalidFulfillmentData
    );

    // Compute the 32-byte intent-binding tag and prepend it as the leading public input.
    // This enforces that the Groth16 proof is cryptographically bound to this exact intent:
    // a proof accepted for intent A cannot be replayed against intent B (different intent_id
    // ⇒ different tag ⇒ different public_inputs ⇒ proof verification fails).
    let intent_binding_tag = laplace::binding::intent_binding_hash(request);
    let public_inputs = reconstruct_public_inputs(
        &intent_binding_tag,
        &config.fixed_public_inputs,
        &fulfillment.public_inputs_suffix,
    );

    let sp1_vkey_hash = format_sp1_vkey_hash(&config.sp1_vkey_hash);

    verify_proof(
        &fulfillment.proof,
        &public_inputs,
        &sp1_vkey_hash,
        GROTH16_VK_5_0_0_BYTES,
    )
    .map_err(|_| error!(ErrorCode::InvalidProof))
}
