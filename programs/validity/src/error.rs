use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Validity config hash does not match the configured fields")]
    InvalidConfigHash,
    #[msg("Validity fulfillment payload is malformed")]
    InvalidFulfillmentData,
    #[msg("Validity proof verification failed")]
    InvalidProof,
    #[msg("Validity verify_criterion request is not for this adapter")]
    InvalidCriterionProgram,
    #[msg("Validity fixed public inputs exceed the configured maximum")]
    FixedPublicInputsTooLarge,
}
