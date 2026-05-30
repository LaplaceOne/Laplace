pub mod constants;
pub mod error;

use anchor_lang::prelude::*;

pub use constants::*;

declare_id!("DNotXVWh1ifzp9MHSd5H4F78SRHptF9p8vGfMmjtuWX2");

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
