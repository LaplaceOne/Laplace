use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Hashlock fulfillment payload is malformed")]
    InvalidFulfillmentData,
    #[msg("Hashlock preimage does not match the locked hash")]
    InvalidPreimage,
    #[msg("Hashlock verify_criterion request is not for this adapter")]
    InvalidCriterionProgram,
}
