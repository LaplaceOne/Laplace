pub mod constants;
pub mod create_validity;
pub mod error;
pub mod state;
pub mod verify_criterion;

use anchor_lang::prelude::*;

pub use constants::*;
pub use create_validity::*;
pub use state::*;
pub use verify_criterion::*;

declare_id!("EQfH4VFdxcFYh8prdAsB4XwKCZiiR5uta594bfiwhLsB");

#[program]
pub mod validity {
    use super::*;

    pub fn create_validity(ctx: Context<CreateValidity>, args: CreateValidityArgs) -> Result<()> {
        create_validity::handler(ctx, args)
    }

    pub fn verify_criterion(
        ctx: Context<VerifyCriterion>,
        request: laplace::CriterionVerificationRequest,
    ) -> Result<()> {
        verify_criterion::handler(ctx, request)
    }
}
