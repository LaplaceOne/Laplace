use anchor_lang::{prelude::*, AccountDeserialize};
use anchor_spl::token_interface::{self, Mint, TokenAccount, TransferChecked};

use crate::{constants::INTENT_SEED, error::ErrorCode, EscrowAsset, Intent, IntentStatus};

#[derive(Accounts)]
pub struct RefundExpiredIntent<'info> {
    #[account(mut)]
    pub intent: Account<'info, Intent>,
    /// CHECK: Refund recipient is checked against the intent and only receives lamports.
    #[account(mut)]
    pub refund_recipient: UncheckedAccount<'info>,
}

pub(crate) fn handler<'info>(mut ctx: Context<'info, RefundExpiredIntent<'info>>) -> Result<()> {
    let intent = &ctx.accounts.intent;
    require!(
        intent.status == IntentStatus::Active,
        ErrorCode::IntentNotActive
    );
    require!(
        Clock::get()?.slot > intent.expiry_slot,
        ErrorCode::IntentNotExpired
    );
    require_keys_eq!(
        ctx.accounts.refund_recipient.key(),
        intent.refund_recipient,
        ErrorCode::InvalidRefundRecipient
    );

    let asset = ctx.accounts.intent.asset;
    match asset {
        EscrowAsset::NativeSol => refund_native_sol(&mut ctx)?,
        EscrowAsset::SplToken { .. } => refund_spl_tokens(&mut ctx)?,
    }

    Ok(())
}

fn refund_native_sol<'info>(ctx: &mut Context<'info, RefundExpiredIntent<'info>>) -> Result<()> {
    require!(
        ctx.remaining_accounts.is_empty(),
        ErrorCode::InvalidAssetAccounts
    );

    let amount = ctx.accounts.intent.amount;
    require!(
        **ctx.accounts.intent.to_account_info().lamports.borrow() >= amount,
        ErrorCode::EscrowInsufficientFunds
    );

    ctx.accounts.intent.status = IntentStatus::Refunded;
    **ctx
        .accounts
        .intent
        .to_account_info()
        .try_borrow_mut_lamports()? -= amount;
    **ctx
        .accounts
        .refund_recipient
        .to_account_info()
        .try_borrow_mut_lamports()? += amount;

    Ok(())
}

fn refund_spl_tokens<'info>(ctx: &mut Context<'info, RefundExpiredIntent<'info>>) -> Result<()> {
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

    let vault_token_account = deserialize_token_account(&ctx.remaining_accounts[0])?;
    let refund_token_account = deserialize_token_account(&ctx.remaining_accounts[1])?;
    let mint_account = deserialize_mint(&ctx.remaining_accounts[2])?;
    let token_program_account = &ctx.remaining_accounts[3];

    require_keys_eq!(
        ctx.remaining_accounts[0].key(),
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
        vault_token_account.amount >= ctx.accounts.intent.amount,
        ErrorCode::InvalidTokenVaultBalance
    );
    require_keys_eq!(
        refund_token_account.mint,
        mint,
        ErrorCode::InvalidTokenAccount
    );
    require_keys_eq!(
        refund_token_account.owner,
        ctx.accounts.intent.refund_recipient,
        ErrorCode::InvalidTokenAccount
    );
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

    ctx.accounts.intent.status = IntentStatus::Refunded;

    let signer_seeds: &[&[&[u8]]] = &[&[
        INTENT_SEED,
        ctx.accounts.intent.maker.as_ref(),
        ctx.accounts.intent.id.as_ref(),
        &[ctx.accounts.intent.bump],
    ]];
    let cpi_accounts = TransferChecked {
        mint: ctx.remaining_accounts[2].clone(),
        from: ctx.remaining_accounts[0].clone(),
        to: ctx.remaining_accounts[1].clone(),
        authority: ctx.accounts.intent.to_account_info(),
    };
    let cpi_context = CpiContext::new_with_signer(token_program, cpi_accounts, signer_seeds);
    token_interface::transfer_checked(
        cpi_context,
        ctx.accounts.intent.amount,
        mint_account.decimals,
    )
}

fn deserialize_token_account<'info>(info: &AccountInfo<'info>) -> Result<TokenAccount> {
    let mut data: &[u8] = &info.try_borrow_data()?;
    TokenAccount::try_deserialize(&mut data).map_err(|_| error!(ErrorCode::InvalidTokenAccount))
}

fn deserialize_mint<'info>(info: &AccountInfo<'info>) -> Result<Mint> {
    let mut data: &[u8] = &info.try_borrow_data()?;
    Mint::try_deserialize(&mut data).map_err(|_| error!(ErrorCode::InvalidTokenAccount))
}
