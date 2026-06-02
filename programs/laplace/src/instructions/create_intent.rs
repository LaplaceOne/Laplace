use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::AccountDeserialize;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TransferChecked};

use crate::{
    constants::{CRITERION_INTERFACE_VERSION, INTENT_SEED},
    error::ErrorCode,
    CreateIntentArgs, EscrowAsset, Intent, IntentCreated, IntentStatus,
};

#[derive(Accounts)]
#[instruction(args: CreateIntentArgs)]
pub struct CreateIntent<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,
    #[account(
        init,
        payer = maker,
        space = 8 + Intent::LEN,
        seeds = [INTENT_SEED, maker.key().as_ref(), args.id.as_ref()],
        bump
    )]
    pub intent: Account<'info, Intent>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn handler<'info>(
    ctx: Context<'info, CreateIntent<'info>>,
    args: CreateIntentArgs,
) -> Result<()> {
    require!(args.amount > 0, ErrorCode::InvalidAmount);

    let current_slot = Clock::get()?.slot;
    require!(args.expiry_slot > current_slot, ErrorCode::InvalidExpiry);

    let intent = &mut ctx.accounts.intent;
    intent.id = args.id;
    intent.maker = ctx.accounts.maker.key();
    intent.receiver = args.receiver;
    intent.refund_recipient = args.refund_recipient;
    intent.criterion_program = args.criterion_program;
    intent.asset = args.asset;
    intent.amount = args.amount;
    intent.expiry_slot = args.expiry_slot;
    intent.created_slot = current_slot;
    intent.criterion_data_hash = args.criterion_data_hash;
    intent.criterion_interface_version = CRITERION_INTERFACE_VERSION;
    intent.status = IntentStatus::Active;
    intent.bump = ctx.bumps.intent;

    let created_event = IntentCreated {
        intent: ctx.accounts.intent.key(),
        id: ctx.accounts.intent.id,
        maker: ctx.accounts.intent.maker,
        receiver: ctx.accounts.intent.receiver,
        refund_recipient: ctx.accounts.intent.refund_recipient,
        criterion_program: ctx.accounts.intent.criterion_program,
        criterion_data_hash: ctx.accounts.intent.criterion_data_hash,
        criterion_interface_version: ctx.accounts.intent.criterion_interface_version,
        asset: ctx.accounts.intent.asset,
        amount: ctx.accounts.intent.amount,
        expiry_slot: ctx.accounts.intent.expiry_slot,
        created_slot: ctx.accounts.intent.created_slot,
    };

    match args.asset {
        EscrowAsset::NativeSol => lock_native_sol(ctx, args.amount)?,
        EscrowAsset::SplToken { .. } => lock_spl_tokens(ctx, args.amount)?,
    }

    emit!(created_event);
    Ok(())
}

fn lock_native_sol<'info>(ctx: Context<'info, CreateIntent<'info>>, amount: u64) -> Result<()> {
    require!(
        ctx.remaining_accounts.is_empty(),
        ErrorCode::InvalidAssetAccounts
    );

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.key(),
            system_program::Transfer {
                from: ctx.accounts.maker.to_account_info(),
                to: ctx.accounts.intent.to_account_info(),
            },
        ),
        amount,
    )
}

fn lock_spl_tokens<'info>(ctx: Context<'info, CreateIntent<'info>>, amount: u64) -> Result<()> {
    let EscrowAsset::SplToken {
        mint,
        token_program,
        vault,
    } = ctx.accounts.intent.asset
    else {
        return err!(ErrorCode::InvalidAssetAccounts);
    };

    require!(
        ctx.remaining_accounts.len() == 4,
        ErrorCode::InvalidAssetAccounts
    );

    let maker_token_account = deserialize_token_account(&ctx.remaining_accounts[0])?;
    let vault_token_account = deserialize_token_account(&ctx.remaining_accounts[1])?;
    let mint_account = deserialize_mint(&ctx.remaining_accounts[2])?;
    let token_program_account = &ctx.remaining_accounts[3];

    require_keys_eq!(
        ctx.remaining_accounts[2].key(),
        mint,
        ErrorCode::InvalidTokenMint
    );
    require_keys_eq!(
        token_program_account.key(),
        token_program,
        ErrorCode::InvalidTokenProgram
    );
    require!(
        token_program_account.executable,
        ErrorCode::InvalidTokenProgram
    );
    require_keys_eq!(
        maker_token_account.mint,
        mint,
        ErrorCode::InvalidTokenAccount
    );
    require_keys_eq!(
        maker_token_account.owner,
        ctx.accounts.maker.key(),
        ErrorCode::InvalidTokenAccount
    );
    require_keys_eq!(
        ctx.remaining_accounts[1].key(),
        vault,
        ErrorCode::InvalidTokenAccount
    );
    require_keys_eq!(
        vault_token_account.mint,
        mint,
        ErrorCode::InvalidTokenAccount
    );
    require_keys_eq!(
        vault_token_account.owner,
        ctx.accounts.intent.key(),
        ErrorCode::InvalidTokenAccount
    );
    require!(
        vault_token_account.amount == 0,
        ErrorCode::InvalidTokenVaultBalance
    );

    let cpi_accounts = TransferChecked {
        mint: ctx.remaining_accounts[2].clone(),
        from: ctx.remaining_accounts[0].clone(),
        to: ctx.remaining_accounts[1].clone(),
        authority: ctx.accounts.maker.to_account_info(),
    };
    let cpi_context = CpiContext::new(token_program, cpi_accounts);
    token_interface::transfer_checked(cpi_context, amount, mint_account.decimals)
}

fn deserialize_token_account<'info>(info: &AccountInfo<'info>) -> Result<TokenAccount> {
    let mut data: &[u8] = &info.try_borrow_data()?;
    TokenAccount::try_deserialize(&mut data).map_err(|_| error!(ErrorCode::InvalidTokenAccount))
}

fn deserialize_mint<'info>(info: &AccountInfo<'info>) -> Result<Mint> {
    let mut data: &[u8] = &info.try_borrow_data()?;
    Mint::try_deserialize(&mut data).map_err(|_| error!(ErrorCode::InvalidTokenAccount))
}
