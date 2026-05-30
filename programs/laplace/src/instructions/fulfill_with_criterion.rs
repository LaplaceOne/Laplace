use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke,
};
use anchor_lang::{prelude::*, AccountDeserialize};
use anchor_spl::token_interface::{self, Mint, TokenAccount, TransferChecked};

use crate::{
    constants::{INTENT_SEED, MAX_FULFILLMENT_DATA_LEN, VERIFY_CRITERION_DISCRIMINATOR},
    error::ErrorCode,
    CriterionVerificationRequest, EscrowAsset, Intent, IntentStatus,
};

#[derive(Accounts)]
pub struct FulfillWithCriterion<'info> {
    #[account(mut)]
    pub intent: Account<'info, Intent>,
    /// CHECK: Receiver is checked against the intent and only receives lamports.
    #[account(mut)]
    pub receiver: UncheckedAccount<'info>,
    /// CHECK: Program id is checked against the intent before CPI.
    pub criterion_program: UncheckedAccount<'info>,
}

pub(crate) fn handler<'info>(
    mut ctx: Context<'info, FulfillWithCriterion<'info>>,
    fulfillment_data: Vec<u8>,
    criterion_account_count: u8,
) -> Result<()> {
    require!(
        fulfillment_data.len() <= MAX_FULFILLMENT_DATA_LEN,
        ErrorCode::FulfillmentDataTooLarge
    );

    let intent = &ctx.accounts.intent;
    require!(
        intent.status == IntentStatus::Active,
        ErrorCode::IntentNotActive
    );
    require!(
        Clock::get()?.slot <= intent.expiry_slot,
        ErrorCode::IntentExpired
    );
    require_keys_eq!(
        ctx.accounts.receiver.key(),
        intent.receiver,
        ErrorCode::InvalidReceiver
    );
    require_keys_eq!(
        ctx.accounts.criterion_program.key(),
        intent.criterion_program,
        ErrorCode::InvalidCriterionProgram
    );
    require!(
        ctx.accounts.criterion_program.executable,
        ErrorCode::CriterionProgramNotExecutable
    );

    let criterion_account_count = usize::from(criterion_account_count);
    require!(
        criterion_account_count <= ctx.remaining_accounts.len(),
        ErrorCode::InvalidCriterionAccountCount
    );
    let criterion_accounts = ctx.remaining_accounts[..criterion_account_count].to_vec();
    let settlement_accounts = ctx.remaining_accounts[criterion_account_count..].to_vec();

    for account in &criterion_accounts {
        require!(
            !is_protected_criterion_account(intent, &ctx.accounts, account.key()),
            ErrorCode::ProtectedAccountPassedToCriterion
        );
    }

    verify_criterion(&ctx, criterion_accounts, fulfillment_data)?;

    let asset = ctx.accounts.intent.asset;
    match asset {
        EscrowAsset::NativeSol => release_native_sol(&mut ctx, settlement_accounts)?,
        EscrowAsset::SplToken { .. } => release_spl_tokens(&mut ctx, settlement_accounts)?,
    }

    Ok(())
}

fn verify_criterion<'info>(
    ctx: &Context<'info, FulfillWithCriterion<'info>>,
    criterion_accounts: Vec<AccountInfo<'info>>,
    fulfillment_data: Vec<u8>,
) -> Result<()> {
    let intent = &ctx.accounts.intent;
    let request = CriterionVerificationRequest {
        interface_version: intent.criterion_interface_version,
        protocol_program: *ctx.program_id,
        intent: ctx.accounts.intent.key(),
        intent_id: intent.id,
        maker: intent.maker,
        receiver: intent.receiver,
        refund_recipient: intent.refund_recipient,
        asset: intent.asset,
        amount: intent.amount,
        expiry_slot: intent.expiry_slot,
        created_slot: intent.created_slot,
        criterion_program: intent.criterion_program,
        criterion_data_hash: intent.criterion_data_hash,
        fulfillment_data,
    };

    let mut data = VERIFY_CRITERION_DISCRIMINATOR.to_vec();
    request
        .serialize(&mut data)
        .map_err(|_| error!(ErrorCode::CriterionRequestSerializationFailed))?;

    let accounts = criterion_accounts
        .iter()
        .map(|account| {
            if account.is_writable {
                AccountMeta::new(account.key(), account.is_signer)
            } else {
                AccountMeta::new_readonly(account.key(), account.is_signer)
            }
        })
        .collect::<Vec<_>>();

    let instruction = Instruction {
        program_id: ctx.accounts.criterion_program.key(),
        accounts,
        data,
    };

    invoke(&instruction, &criterion_accounts)?;
    Ok(())
}

fn is_protected_criterion_account(
    intent: &Intent,
    accounts: &FulfillWithCriterion,
    account_key: Pubkey,
) -> bool {
    account_key == accounts.intent.key()
        || account_key == accounts.receiver.key()
        || match intent.asset {
            EscrowAsset::NativeSol => false,
            EscrowAsset::SplToken { vault, .. } => account_key == vault,
        }
}

fn release_native_sol<'info>(
    ctx: &mut Context<'info, FulfillWithCriterion<'info>>,
    settlement_accounts: Vec<AccountInfo<'info>>,
) -> Result<()> {
    require!(
        settlement_accounts.is_empty(),
        ErrorCode::InvalidAssetAccounts
    );

    let amount = ctx.accounts.intent.amount;
    require!(
        **ctx.accounts.intent.to_account_info().lamports.borrow() >= amount,
        ErrorCode::EscrowInsufficientFunds
    );

    ctx.accounts.intent.status = IntentStatus::Fulfilled;
    **ctx
        .accounts
        .intent
        .to_account_info()
        .try_borrow_mut_lamports()? -= amount;
    **ctx
        .accounts
        .receiver
        .to_account_info()
        .try_borrow_mut_lamports()? += amount;

    Ok(())
}

fn release_spl_tokens<'info>(
    ctx: &mut Context<'info, FulfillWithCriterion<'info>>,
    settlement_accounts: Vec<AccountInfo<'info>>,
) -> Result<()> {
    let EscrowAsset::SplToken {
        mint,
        token_program,
        vault,
    } = ctx.accounts.intent.asset
    else {
        return err!(ErrorCode::InvalidAssetAccounts);
    };

    require!(
        settlement_accounts.len() == 4,
        ErrorCode::InvalidAssetAccounts
    );

    let vault_token_account = deserialize_token_account(&settlement_accounts[0])?;
    let receiver_token_account = deserialize_token_account(&settlement_accounts[1])?;
    let mint_account = deserialize_mint(&settlement_accounts[2])?;
    let token_program_account = &settlement_accounts[3];

    validate_token_vault(
        &vault_token_account,
        ctx.accounts.intent.key(),
        settlement_accounts[0].key(),
        vault,
        mint,
        ctx.accounts.intent.amount,
    )?;
    validate_token_destination(&receiver_token_account, ctx.accounts.intent.receiver, mint)?;
    require_keys_eq!(
        settlement_accounts[2].key(),
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

    ctx.accounts.intent.status = IntentStatus::Fulfilled;
    transfer_from_vault(
        ctx.accounts.intent.to_account_info(),
        settlement_accounts[0].clone(),
        settlement_accounts[1].clone(),
        settlement_accounts[2].clone(),
        token_program,
        ctx.accounts.intent.amount,
        ctx.accounts.intent.maker,
        ctx.accounts.intent.id,
        ctx.accounts.intent.bump,
        mint_account.decimals,
    )
}

fn validate_token_vault(
    vault_token_account: &TokenAccount,
    intent_key: Pubkey,
    vault_account_key: Pubkey,
    expected_vault: Pubkey,
    expected_mint: Pubkey,
    expected_amount: u64,
) -> Result<()> {
    require_keys_eq!(
        vault_account_key,
        expected_vault,
        ErrorCode::InvalidTokenAccount
    );
    require_keys_eq!(
        vault_token_account.mint,
        expected_mint,
        ErrorCode::InvalidTokenAccount
    );
    require_keys_eq!(
        vault_token_account.owner,
        intent_key,
        ErrorCode::InvalidTokenAccount
    );
    require!(
        vault_token_account.amount >= expected_amount,
        ErrorCode::InvalidTokenVaultBalance
    );
    Ok(())
}

fn validate_token_destination(
    token_account: &TokenAccount,
    expected_owner: Pubkey,
    expected_mint: Pubkey,
) -> Result<()> {
    require_keys_eq!(
        token_account.mint,
        expected_mint,
        ErrorCode::InvalidTokenAccount
    );
    require_keys_eq!(
        token_account.owner,
        expected_owner,
        ErrorCode::InvalidTokenAccount
    );
    Ok(())
}

fn transfer_from_vault<'info>(
    authority: AccountInfo<'info>,
    vault_token_account: AccountInfo<'info>,
    destination_token_account: AccountInfo<'info>,
    mint_account: AccountInfo<'info>,
    token_program: Pubkey,
    amount: u64,
    maker: Pubkey,
    id: [u8; 32],
    bump: u8,
    decimals: u8,
) -> Result<()> {
    let signer_seeds: &[&[&[u8]]] = &[&[INTENT_SEED, maker.as_ref(), id.as_ref(), &[bump]]];
    let cpi_accounts = TransferChecked {
        mint: mint_account,
        from: vault_token_account,
        to: destination_token_account,
        authority,
    };
    let cpi_context = CpiContext::new_with_signer(token_program, cpi_accounts, signer_seeds);
    token_interface::transfer_checked(cpi_context, amount, decimals)
}

fn deserialize_token_account<'info>(info: &AccountInfo<'info>) -> Result<TokenAccount> {
    let mut data: &[u8] = &info.try_borrow_data()?;
    TokenAccount::try_deserialize(&mut data).map_err(|_| error!(ErrorCode::InvalidTokenAccount))
}

fn deserialize_mint<'info>(info: &AccountInfo<'info>) -> Result<Mint> {
    let mut data: &[u8] = &info.try_borrow_data()?;
    Mint::try_deserialize(&mut data).map_err(|_| error!(ErrorCode::InvalidTokenAccount))
}
