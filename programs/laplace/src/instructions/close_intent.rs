use anchor_lang::{prelude::*, AccountDeserialize};
use anchor_spl::token_interface::{self, CloseAccount, TokenAccount};

use crate::{constants::INTENT_SEED, error::ErrorCode, EscrowAsset, Intent, IntentStatus};

#[derive(Accounts)]
pub struct CloseIntent<'info> {
    #[account(
        mut,
        has_one = maker,
        close = maker
    )]
    pub intent: Account<'info, Intent>,
    #[account(mut)]
    pub maker: Signer<'info>,
}

pub(crate) fn handler<'info>(ctx: Context<'info, CloseIntent<'info>>) -> Result<()> {
    require!(
        ctx.accounts.intent.status == IntentStatus::Fulfilled
            || ctx.accounts.intent.status == IntentStatus::Refunded,
        ErrorCode::IntentNotClosable
    );

    match ctx.accounts.intent.asset {
        EscrowAsset::NativeSol => {
            require!(
                ctx.remaining_accounts.is_empty(),
                ErrorCode::InvalidAssetAccounts
            );
            Ok(())
        }
        EscrowAsset::SplToken {
            token_program,
            vault,
            ..
        } => close_token_vault(ctx, vault, token_program),
    }
}

fn close_token_vault<'info>(
    ctx: Context<'info, CloseIntent<'info>>,
    expected_vault: Pubkey,
    expected_token_program: Pubkey,
) -> Result<()> {
    require!(
        ctx.remaining_accounts.len() == 2,
        ErrorCode::InvalidAssetAccounts
    );

    let vault_token_account = deserialize_token_account(&ctx.remaining_accounts[0])?;
    let token_program_account = &ctx.remaining_accounts[1];

    require_keys_eq!(
        ctx.remaining_accounts[0].key(),
        expected_vault,
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
    require_keys_eq!(
        token_program_account.key(),
        expected_token_program,
        ErrorCode::InvalidTokenProgram
    );
    require!(
        token_program_account.executable,
        ErrorCode::InvalidTokenProgram
    );

    let signer_seeds: &[&[&[u8]]] = &[&[
        INTENT_SEED,
        ctx.accounts.intent.maker.as_ref(),
        ctx.accounts.intent.id.as_ref(),
        &[ctx.accounts.intent.bump],
    ]];
    let cpi_accounts = CloseAccount {
        account: ctx.remaining_accounts[0].clone(),
        destination: ctx.accounts.maker.to_account_info(),
        authority: ctx.accounts.intent.to_account_info(),
    };
    let cpi_context =
        CpiContext::new_with_signer(expected_token_program, cpi_accounts, signer_seeds);
    token_interface::close_account(cpi_context)
}

fn deserialize_token_account<'info>(info: &AccountInfo<'info>) -> Result<TokenAccount> {
    let mut data: &[u8] = &info.try_borrow_data()?;
    TokenAccount::try_deserialize(&mut data).map_err(|_| error!(ErrorCode::InvalidTokenAccount))
}
