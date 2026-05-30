use {
    anchor_lang::{
        prelude::Pubkey, system_program, AccountDeserialize, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_program_pack::Pack,
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
    spl_token_interface::state::{Account as TokenAccount, Mint},
};

const INTENT_ID: [u8; 32] = [11; 32];
const ESCROW_AMOUNT: u64 = 10_000;
const TOKEN_SUPPLY: u64 = 100_000;

fn load_e2e_programs(svm: &mut LiteSVM) -> bool {
    let Ok(laplace_bytes) = std::fs::read("target/deploy/laplace.so") else {
        eprintln!("skipping e2e: run `anchor build --ignore-keys` first");
        return false;
    };
    let Ok(hashlock_bytes) = std::fs::read("target/deploy/hashlock.so") else {
        eprintln!("skipping e2e: run `anchor build --ignore-keys` first");
        return false;
    };

    svm.add_program(laplace::id(), &laplace_bytes).unwrap();
    svm.add_program(hashlock::id(), &hashlock_bytes).unwrap();
    true
}

fn intent_pda(maker: &Pubkey, intent_id: &[u8; 32]) -> Pubkey {
    Pubkey::find_program_address(
        &[laplace::INTENT_SEED, maker.as_ref(), intent_id.as_ref()],
        &laplace::id(),
    )
    .0
}

fn send_ix(
    svm: &mut LiteSVM,
    payer: &Keypair,
    ix: anchor_lang::solana_program::instruction::Instruction,
) {
    send_ixs(svm, payer, vec![ix], &[]);
}

fn send_ixs(
    svm: &mut LiteSVM,
    payer: &Keypair,
    ixs: Vec<anchor_lang::solana_program::instruction::Instruction>,
    extra_signers: &[&Keypair],
) {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&ixs, Some(&payer.pubkey()), &blockhash);
    let mut signers: Vec<&dyn Signer> = vec![payer];
    signers.extend(extra_signers.iter().map(|signer| *signer as &dyn Signer));
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &signers).unwrap();

    svm.send_transaction(tx).unwrap();
}

fn try_send_ix(
    svm: &mut LiteSVM,
    payer: &Keypair,
    ix: anchor_lang::solana_program::instruction::Instruction,
) -> bool {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer]).unwrap();

    svm.send_transaction(tx).is_ok()
}

fn create_intent_ix(
    maker: &Pubkey,
    receiver: &Pubkey,
    intent: &Pubkey,
    preimage: &[u8],
) -> anchor_lang::solana_program::instruction::Instruction {
    let args = laplace::CreateIntentArgs {
        id: INTENT_ID,
        receiver: *receiver,
        refund_recipient: *maker,
        criterion_program: hashlock::id(),
        asset: laplace::EscrowAsset::NativeSol,
        amount: ESCROW_AMOUNT,
        expiry_slot: 1_000,
        criterion_data_hash: hashlock::hash_preimage(preimage),
    };

    anchor_lang::solana_program::instruction::Instruction::new_with_bytes(
        laplace::id(),
        &laplace::instruction::CreateIntent { args }.data(),
        laplace::accounts::CreateIntent {
            maker: *maker,
            intent: *intent,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn create_spl_intent_ix(
    maker: &Pubkey,
    receiver: &Pubkey,
    intent: &Pubkey,
    preimage: &[u8],
    mint: &Pubkey,
    maker_token: &Pubkey,
    vault_token: &Pubkey,
) -> anchor_lang::solana_program::instruction::Instruction {
    let args = laplace::CreateIntentArgs {
        id: INTENT_ID,
        receiver: *receiver,
        refund_recipient: *maker,
        criterion_program: hashlock::id(),
        asset: laplace::EscrowAsset::SplToken {
            mint: *mint,
            token_program: spl_token_interface::ID,
            vault: *vault_token,
        },
        amount: ESCROW_AMOUNT,
        expiry_slot: 1_000,
        criterion_data_hash: hashlock::hash_preimage(preimage),
    };

    let mut accounts = laplace::accounts::CreateIntent {
        maker: *maker,
        intent: *intent,
        system_program: system_program::ID,
    }
    .to_account_metas(None);
    accounts.extend([
        anchor_lang::solana_program::instruction::AccountMeta::new(*maker_token, false),
        anchor_lang::solana_program::instruction::AccountMeta::new(*vault_token, false),
        anchor_lang::solana_program::instruction::AccountMeta::new_readonly(*mint, false),
        anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
            spl_token_interface::ID,
            false,
        ),
    ]);

    anchor_lang::solana_program::instruction::Instruction::new_with_bytes(
        laplace::id(),
        &laplace::instruction::CreateIntent { args }.data(),
        accounts,
    )
}

fn fulfill_ix(
    receiver: &Pubkey,
    intent: &Pubkey,
    preimage: &[u8],
) -> anchor_lang::solana_program::instruction::Instruction {
    anchor_lang::solana_program::instruction::Instruction::new_with_bytes(
        laplace::id(),
        &laplace::instruction::FulfillWithCriterion {
            fulfillment_data: preimage.to_vec(),
            criterion_account_count: 0,
        }
        .data(),
        laplace::accounts::FulfillWithCriterion {
            intent: *intent,
            receiver: *receiver,
            criterion_program: hashlock::id(),
        }
        .to_account_metas(None),
    )
}

fn fulfill_spl_ix(
    receiver: &Pubkey,
    intent: &Pubkey,
    preimage: &[u8],
    mint: &Pubkey,
    receiver_token: &Pubkey,
    vault_token: &Pubkey,
) -> anchor_lang::solana_program::instruction::Instruction {
    let mut accounts = laplace::accounts::FulfillWithCriterion {
        intent: *intent,
        receiver: *receiver,
        criterion_program: hashlock::id(),
    }
    .to_account_metas(None);
    accounts.extend([
        anchor_lang::solana_program::instruction::AccountMeta::new(*vault_token, false),
        anchor_lang::solana_program::instruction::AccountMeta::new(*receiver_token, false),
        anchor_lang::solana_program::instruction::AccountMeta::new_readonly(*mint, false),
        anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
            spl_token_interface::ID,
            false,
        ),
    ]);

    anchor_lang::solana_program::instruction::Instruction::new_with_bytes(
        laplace::id(),
        &laplace::instruction::FulfillWithCriterion {
            fulfillment_data: preimage.to_vec(),
            criterion_account_count: 0,
        }
        .data(),
        accounts,
    )
}

fn refund_spl_ix(
    refund_recipient: &Pubkey,
    intent: &Pubkey,
    mint: &Pubkey,
    refund_token: &Pubkey,
    vault_token: &Pubkey,
) -> anchor_lang::solana_program::instruction::Instruction {
    let mut accounts = laplace::accounts::RefundExpiredIntent {
        intent: *intent,
        refund_recipient: *refund_recipient,
    }
    .to_account_metas(None);
    accounts.extend([
        anchor_lang::solana_program::instruction::AccountMeta::new(*vault_token, false),
        anchor_lang::solana_program::instruction::AccountMeta::new(*refund_token, false),
        anchor_lang::solana_program::instruction::AccountMeta::new_readonly(*mint, false),
        anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
            spl_token_interface::ID,
            false,
        ),
    ]);

    anchor_lang::solana_program::instruction::Instruction::new_with_bytes(
        laplace::id(),
        &laplace::instruction::RefundExpiredIntent {}.data(),
        accounts,
    )
}

fn close_spl_intent_ix(
    maker: &Pubkey,
    intent: &Pubkey,
    vault_token: &Pubkey,
) -> anchor_lang::solana_program::instruction::Instruction {
    let mut accounts = laplace::accounts::CloseIntent {
        intent: *intent,
        maker: *maker,
    }
    .to_account_metas(None);
    accounts.extend([
        anchor_lang::solana_program::instruction::AccountMeta::new(*vault_token, false),
        anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
            spl_token_interface::ID,
            false,
        ),
    ]);

    anchor_lang::solana_program::instruction::Instruction::new_with_bytes(
        laplace::id(),
        &laplace::instruction::CloseIntent {}.data(),
        accounts,
    )
}

fn read_intent(svm: &mut LiteSVM, intent: &Pubkey) -> laplace::Intent {
    let account = svm.get_account(intent).unwrap();
    laplace::Intent::try_deserialize(&mut account.data.as_slice()).unwrap()
}

fn read_token_account(svm: &mut LiteSVM, token_account: &Pubkey) -> TokenAccount {
    let account = svm.get_account(token_account).unwrap();
    TokenAccount::unpack(&account.data).unwrap()
}

fn setup_token_accounts(
    svm: &mut LiteSVM,
    payer: &Keypair,
    mint: &Keypair,
    maker_token: &Keypair,
    receiver_token: &Keypair,
    vault_token: &Keypair,
    receiver: &Pubkey,
    vault_owner: &Pubkey,
) {
    let mint_rent = svm.minimum_balance_for_rent_exemption(Mint::LEN);
    let token_rent = svm.minimum_balance_for_rent_exemption(TokenAccount::LEN);

    let ixs = vec![
        solana_system_interface::instruction::create_account(
            &payer.pubkey(),
            &mint.pubkey(),
            mint_rent,
            Mint::LEN as u64,
            &spl_token_interface::ID,
        ),
        spl_token_interface::instruction::initialize_mint2(
            &spl_token_interface::ID,
            &mint.pubkey(),
            &payer.pubkey(),
            None,
            6,
        )
        .unwrap(),
        solana_system_interface::instruction::create_account(
            &payer.pubkey(),
            &maker_token.pubkey(),
            token_rent,
            TokenAccount::LEN as u64,
            &spl_token_interface::ID,
        ),
        spl_token_interface::instruction::initialize_account3(
            &spl_token_interface::ID,
            &maker_token.pubkey(),
            &mint.pubkey(),
            &payer.pubkey(),
        )
        .unwrap(),
        solana_system_interface::instruction::create_account(
            &payer.pubkey(),
            &receiver_token.pubkey(),
            token_rent,
            TokenAccount::LEN as u64,
            &spl_token_interface::ID,
        ),
        spl_token_interface::instruction::initialize_account3(
            &spl_token_interface::ID,
            &receiver_token.pubkey(),
            &mint.pubkey(),
            receiver,
        )
        .unwrap(),
        solana_system_interface::instruction::create_account(
            &payer.pubkey(),
            &vault_token.pubkey(),
            token_rent,
            TokenAccount::LEN as u64,
            &spl_token_interface::ID,
        ),
        spl_token_interface::instruction::initialize_account3(
            &spl_token_interface::ID,
            &vault_token.pubkey(),
            &mint.pubkey(),
            vault_owner,
        )
        .unwrap(),
        spl_token_interface::instruction::mint_to(
            &spl_token_interface::ID,
            &mint.pubkey(),
            &maker_token.pubkey(),
            &payer.pubkey(),
            &[],
            TOKEN_SUPPLY,
        )
        .unwrap(),
    ];

    send_ixs(
        svm,
        payer,
        ixs,
        &[mint, maker_token, receiver_token, vault_token],
    );
}

#[test]
fn hashlock_fulfillment_releases_escrow_to_receiver() {
    let mut svm = LiteSVM::new();
    if !load_e2e_programs(&mut svm) {
        return;
    }

    let maker = Keypair::new();
    let receiver = Keypair::new();
    let preimage = b"correct preimage";
    let intent = intent_pda(&maker.pubkey(), &INTENT_ID);

    svm.airdrop(&maker.pubkey(), 1_000_000_000).unwrap();
    svm.airdrop(&receiver.pubkey(), 1_000_000).unwrap();
    let receiver_before = svm.get_balance(&receiver.pubkey()).unwrap();

    send_ix(
        &mut svm,
        &maker,
        create_intent_ix(&maker.pubkey(), &receiver.pubkey(), &intent, preimage),
    );

    let created = read_intent(&mut svm, &intent);
    assert_eq!(created.status, laplace::IntentStatus::Active);
    assert_eq!(created.criterion_program, hashlock::id());
    assert_eq!(
        created.criterion_data_hash,
        hashlock::hash_preimage(preimage)
    );

    send_ix(
        &mut svm,
        &maker,
        fulfill_ix(&receiver.pubkey(), &intent, preimage),
    );

    let fulfilled = read_intent(&mut svm, &intent);
    assert_eq!(fulfilled.status, laplace::IntentStatus::Fulfilled);
    assert_eq!(
        svm.get_balance(&receiver.pubkey()).unwrap(),
        receiver_before + ESCROW_AMOUNT
    );
}

#[test]
fn hashlock_fulfillment_rejects_wrong_preimage() {
    let mut svm = LiteSVM::new();
    if !load_e2e_programs(&mut svm) {
        return;
    }

    let maker = Keypair::new();
    let receiver = Keypair::new();
    let preimage = b"correct preimage";
    let intent = intent_pda(&maker.pubkey(), &INTENT_ID);

    svm.airdrop(&maker.pubkey(), 1_000_000_000).unwrap();
    svm.airdrop(&receiver.pubkey(), 1_000_000).unwrap();
    let receiver_before = svm.get_balance(&receiver.pubkey()).unwrap();

    send_ix(
        &mut svm,
        &maker,
        create_intent_ix(&maker.pubkey(), &receiver.pubkey(), &intent, preimage),
    );

    assert!(!try_send_ix(
        &mut svm,
        &maker,
        fulfill_ix(&receiver.pubkey(), &intent, b"wrong preimage"),
    ));

    let active = read_intent(&mut svm, &intent);
    assert_eq!(active.status, laplace::IntentStatus::Active);
    assert_eq!(
        svm.get_balance(&receiver.pubkey()).unwrap(),
        receiver_before
    );
}

#[test]
fn hashlock_spl_fulfillment_releases_tokens_to_receiver() {
    let mut svm = LiteSVM::new();
    if !load_e2e_programs(&mut svm) {
        return;
    }

    let maker = Keypair::new();
    let receiver = Keypair::new();
    let mint = Keypair::new();
    let maker_token = Keypair::new();
    let receiver_token = Keypair::new();
    let vault_token = Keypair::new();
    let preimage = b"token preimage";
    let intent = intent_pda(&maker.pubkey(), &INTENT_ID);

    svm.airdrop(&maker.pubkey(), 1_000_000_000).unwrap();
    svm.airdrop(&receiver.pubkey(), 1_000_000).unwrap();

    setup_token_accounts(
        &mut svm,
        &maker,
        &mint,
        &maker_token,
        &receiver_token,
        &vault_token,
        &receiver.pubkey(),
        &intent,
    );

    send_ix(
        &mut svm,
        &maker,
        create_spl_intent_ix(
            &maker.pubkey(),
            &receiver.pubkey(),
            &intent,
            preimage,
            &mint.pubkey(),
            &maker_token.pubkey(),
            &vault_token.pubkey(),
        ),
    );

    assert_eq!(
        read_token_account(&mut svm, &maker_token.pubkey()).amount,
        TOKEN_SUPPLY - ESCROW_AMOUNT
    );
    assert_eq!(
        read_token_account(&mut svm, &vault_token.pubkey()).amount,
        ESCROW_AMOUNT
    );

    send_ix(
        &mut svm,
        &maker,
        fulfill_spl_ix(
            &receiver.pubkey(),
            &intent,
            preimage,
            &mint.pubkey(),
            &receiver_token.pubkey(),
            &vault_token.pubkey(),
        ),
    );

    let fulfilled = read_intent(&mut svm, &intent);
    assert_eq!(fulfilled.status, laplace::IntentStatus::Fulfilled);
    assert_eq!(
        read_token_account(&mut svm, &receiver_token.pubkey()).amount,
        ESCROW_AMOUNT
    );
    assert_eq!(
        read_token_account(&mut svm, &vault_token.pubkey()).amount,
        0
    );

    send_ix(
        &mut svm,
        &maker,
        close_spl_intent_ix(&maker.pubkey(), &intent, &vault_token.pubkey()),
    );

    assert!(svm.get_account(&vault_token.pubkey()).is_none());
}

#[test]
fn hashlock_spl_refund_returns_tokens_after_expiry() {
    let mut svm = LiteSVM::new();
    if !load_e2e_programs(&mut svm) {
        return;
    }

    let maker = Keypair::new();
    let receiver = Keypair::new();
    let mint = Keypair::new();
    let maker_token = Keypair::new();
    let receiver_token = Keypair::new();
    let vault_token = Keypair::new();
    let preimage = b"refund preimage";
    let intent = intent_pda(&maker.pubkey(), &INTENT_ID);

    svm.airdrop(&maker.pubkey(), 1_000_000_000).unwrap();
    svm.airdrop(&receiver.pubkey(), 1_000_000).unwrap();

    setup_token_accounts(
        &mut svm,
        &maker,
        &mint,
        &maker_token,
        &receiver_token,
        &vault_token,
        &receiver.pubkey(),
        &intent,
    );

    send_ix(
        &mut svm,
        &maker,
        create_spl_intent_ix(
            &maker.pubkey(),
            &receiver.pubkey(),
            &intent,
            preimage,
            &mint.pubkey(),
            &maker_token.pubkey(),
            &vault_token.pubkey(),
        ),
    );

    svm.warp_to_slot(1_001);
    send_ix(
        &mut svm,
        &maker,
        refund_spl_ix(
            &maker.pubkey(),
            &intent,
            &mint.pubkey(),
            &maker_token.pubkey(),
            &vault_token.pubkey(),
        ),
    );

    let refunded = read_intent(&mut svm, &intent);
    assert_eq!(refunded.status, laplace::IntentStatus::Refunded);
    assert_eq!(
        read_token_account(&mut svm, &maker_token.pubkey()).amount,
        TOKEN_SUPPLY
    );
    assert_eq!(
        read_token_account(&mut svm, &vault_token.pubkey()).amount,
        0
    );
}
