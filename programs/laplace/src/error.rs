use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Intent amount must be greater than zero")]
    InvalidAmount,
    #[msg("Intent expiry must be in the future")]
    InvalidExpiry,
    #[msg("Intent is not active")]
    IntentNotActive,
    #[msg("Intent has expired")]
    IntentExpired,
    #[msg("Intent has not expired")]
    IntentNotExpired,
    #[msg("Receiver account does not match the intent")]
    InvalidReceiver,
    #[msg("Refund recipient account does not match the intent")]
    InvalidRefundRecipient,
    #[msg("Criterion program account does not match the intent")]
    InvalidCriterionProgram,
    #[msg("Criterion program must be executable")]
    CriterionProgramNotExecutable,
    #[msg("Fulfillment data exceeds the protocol limit")]
    FulfillmentDataTooLarge,
    #[msg("Criterion CPI cannot receive protected core escrow accounts")]
    ProtectedAccountPassedToCriterion,
    #[msg("Failed to serialize criterion verification request")]
    CriterionRequestSerializationFailed,
    #[msg("Escrow account does not contain the locked amount")]
    EscrowInsufficientFunds,
    #[msg("Intent must be fulfilled or refunded before close")]
    IntentNotClosable,
    #[msg("Asset-specific account list is invalid")]
    InvalidAssetAccounts,
    #[msg("Token mint account does not match the intent asset")]
    InvalidTokenMint,
    #[msg("Token program account does not match the intent asset")]
    InvalidTokenProgram,
    #[msg("Token account does not match the intent asset")]
    InvalidTokenAccount,
    #[msg("Token vault balance is invalid for this operation")]
    InvalidTokenVaultBalance,
    #[msg("Criterion account split is invalid")]
    InvalidCriterionAccountCount,
}
