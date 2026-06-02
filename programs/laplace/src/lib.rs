pub mod binding;
pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use binding::*;
pub use constants::*;
pub use events::*;
pub use instructions::*;
pub use state::*;

declare_id!("5ozBamUtiAHCkiipAVL9E8v8r54HqZsHMDbkHdczpidu");

#[program]
pub mod laplace {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        initialize::handler(ctx)
    }

    pub fn create_intent<'info>(
        ctx: Context<'info, CreateIntent<'info>>,
        args: CreateIntentArgs,
    ) -> Result<()> {
        create_intent::handler(ctx, args)
    }

    pub fn fulfill_with_criterion<'info>(
        ctx: Context<'info, FulfillWithCriterion<'info>>,
        fulfillment_data: Vec<u8>,
        criterion_account_count: u8,
    ) -> Result<()> {
        fulfill_with_criterion::handler(ctx, fulfillment_data, criterion_account_count)
    }

    pub fn refund_expired_intent<'info>(
        ctx: Context<'info, RefundExpiredIntent<'info>>,
    ) -> Result<()> {
        refund_expired_intent::handler(ctx)
    }

    pub fn close_intent<'info>(ctx: Context<'info, CloseIntent<'info>>) -> Result<()> {
        close_intent::handler(ctx)
    }
}
