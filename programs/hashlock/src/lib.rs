pub mod constants;
pub mod error;

use anchor_lang::prelude::*;

pub use constants::*;

declare_id!("9FWQGf16ZB5wdrwg3gDCmUcpRJNVuzp1uG12C6z5RVTw");

#[program]
pub mod hashlock {
    use super::*;

    pub fn verify_criterion(
        ctx: Context<VerifyCriterion>,
        request: laplace::CriterionVerificationRequest,
    ) -> Result<()> {
        verify_criterion::handler(ctx, request)
    }
}

mod verify_criterion;

pub use verify_criterion::*;
