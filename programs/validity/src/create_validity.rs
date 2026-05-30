use anchor_lang::prelude::*;

use crate::{
    constants::{MAX_FIXED_PUBLIC_INPUTS_LEN, VALIDITY_SEED},
    error::ErrorCode,
    hash_config, CreateValidityArgs, ValidityConfig,
};

#[derive(Accounts)]
#[instruction(args: CreateValidityArgs)]
pub struct CreateValidity<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + ValidityConfig::space(args.fixed_public_inputs.len()),
        seeds = [VALIDITY_SEED, args.config_hash.as_ref()],
        bump
    )]
    pub config: Account<'info, ValidityConfig>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(ctx: Context<CreateValidity>, args: CreateValidityArgs) -> Result<()> {
    require!(
        args.fixed_public_inputs.len() <= MAX_FIXED_PUBLIC_INPUTS_LEN,
        ErrorCode::FixedPublicInputsTooLarge
    );

    let expected_hash = hash_config(
        &args.guest_elf_hash,
        &args.sp1_vkey_hash,
        &args.fixed_public_inputs,
    );
    require!(
        expected_hash == args.config_hash,
        ErrorCode::InvalidConfigHash
    );

    let config = &mut ctx.accounts.config;
    config.config_hash = args.config_hash;
    config.guest_elf_hash = args.guest_elf_hash;
    config.sp1_vkey_hash = args.sp1_vkey_hash;
    config.fixed_public_inputs = args.fixed_public_inputs;
    config.bump = ctx.bumps.config;

    Ok(())
}
