use {
    anchor_lang::{
        prelude::Pubkey, solana_program::instruction::Instruction, AccountDeserialize,
        AnchorSerialize, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const INTENT_ID: [u8; 32] = [21; 32];
const FIBONACCI_GUEST_ELF_HASH: [u8; 32] = [
    0x3d, 0x92, 0xce, 0xf6, 0xed, 0x0f, 0x49, 0x9a, 0xa7, 0xa1, 0x92, 0x02, 0xec, 0xa8, 0xe4, 0x2d,
    0xcb, 0x80, 0xf5, 0x4f, 0x60, 0x69, 0xed, 0xc1, 0x09, 0xb9, 0xd4, 0x59, 0xf2, 0xfa, 0x5f, 0x4a,
];
const FIBONACCI_SP1_VKEY_HASH: [u8; 32] = [
    0x00, 0xbb, 0x9e, 0x57, 0x31, 0x4d, 0x7e, 0xe4, 0xf6, 0x5a, 0x4b, 0x9f, 0xb4, 0x6f, 0xbe, 0xae,
    0x04, 0x95, 0xf2, 0x01, 0x5c, 0x5a, 0x8a, 0x73, 0x73, 0x33, 0x68, 0x0c, 0xe6, 0xbb, 0x42, 0x4e,
];

fn load_programs(svm: &mut LiteSVM) -> bool {
    let Ok(laplace_bytes) = std::fs::read("target/deploy/laplace.so") else {
        eprintln!("skipping validity e2e: run `anchor build --ignore-keys` first");
        return false;
    };
    let Ok(validity_bytes) = std::fs::read("target/deploy/validity.so") else {
        eprintln!("skipping validity e2e: run `anchor build --ignore-keys` first");
        return false;
    };

    svm.add_program(laplace::id(), &laplace_bytes).unwrap();
    svm.add_program(validity::id(), &validity_bytes).unwrap();
    true
}

fn send_ix(svm: &mut LiteSVM, payer: &Keypair, ix: Instruction) -> Result<(), String> {
    send_ixs(svm, payer, vec![ix])
}

fn send_ixs(svm: &mut LiteSVM, payer: &Keypair, ixs: Vec<Instruction>) -> Result<(), String> {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&ixs, Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer])
        .map_err(|err| err.to_string())?;
    svm.send_transaction(tx)
        .map(|_| ())
        .map_err(|err| format!("{err:?}"))?;
    Ok(())
}

fn compute_budget_limit_ix(units: u32) -> Instruction {
    let mut data = Vec::with_capacity(5);
    // ComputeBudgetInstruction::SetComputeUnitLimit is encoded as tag 2 + little-endian u32.
    data.push(2);
    data.extend_from_slice(&units.to_le_bytes());

    Instruction {
        program_id: "ComputeBudget111111111111111111111111111111"
            .parse()
            .unwrap(),
        accounts: vec![],
        data,
    }
}

fn intent_pda(maker: &Pubkey, intent_id: &[u8; 32]) -> Pubkey {
    Pubkey::find_program_address(
        &[laplace::INTENT_SEED, maker.as_ref(), intent_id.as_ref()],
        &laplace::id(),
    )
    .0
}

fn validity_pda(config_hash: &[u8; 32]) -> Pubkey {
    Pubkey::find_program_address(
        &[validity::VALIDITY_SEED, config_hash.as_ref()],
        &validity::id(),
    )
    .0
}

fn read_intent(svm: &mut LiteSVM, intent: &Pubkey) -> laplace::Intent {
    let account = svm.get_account(intent).unwrap();
    laplace::Intent::try_deserialize(&mut account.data.as_slice()).unwrap()
}

fn read_validity_config(svm: &mut LiteSVM, config: &Pubkey) -> validity::ValidityConfig {
    let account = svm.get_account(config).unwrap();
    validity::ValidityConfig::try_deserialize(&mut account.data.as_slice()).unwrap()
}

fn create_validity_ix(
    payer: &Pubkey,
    config: &Pubkey,
    args: validity::CreateValidityArgs,
) -> Instruction {
    Instruction::new_with_bytes(
        validity::id(),
        &validity::instruction::CreateValidity { args }.data(),
        validity::accounts::CreateValidity {
            payer: *payer,
            config: *config,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn create_intent_ix(
    maker: &Pubkey,
    receiver: &Pubkey,
    intent: &Pubkey,
    criterion_data_hash: [u8; 32],
) -> Instruction {
    let args = laplace::CreateIntentArgs {
        id: INTENT_ID,
        receiver: *receiver,
        refund_recipient: *maker,
        criterion_program: validity::id(),
        asset: laplace::EscrowAsset::NativeSol,
        amount: 10_000,
        expiry_slot: 1_000,
        criterion_data_hash,
    };

    Instruction::new_with_bytes(
        laplace::id(),
        &laplace::instruction::CreateIntent { args }.data(),
        laplace::accounts::CreateIntent {
            maker: *maker,
            intent: *intent,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn fulfill_ix(
    receiver: &Pubkey,
    intent: &Pubkey,
    config: &Pubkey,
    payload: Vec<u8>,
) -> Instruction {
    let mut accounts = laplace::accounts::FulfillWithCriterion {
        intent: *intent,
        receiver: *receiver,
        criterion_program: validity::id(),
    }
    .to_account_metas(None);
    accounts
        .push(anchor_lang::solana_program::instruction::AccountMeta::new_readonly(*config, false));

    Instruction::new_with_bytes(
        laplace::id(),
        &laplace::instruction::FulfillWithCriterion {
            fulfillment_data: payload,
            criterion_account_count: 1,
        }
        .data(),
        accounts,
    )
}

fn fibonacci_fixture() -> (Vec<u8>, Vec<u8>, Vec<u8>) {
    let proof = hex::decode(include_str!("fixtures/fibonacci_groth16_proof.hex").trim()).unwrap();
    let public_values =
        hex::decode(include_str!("fixtures/fibonacci_public_values.hex").trim()).unwrap();

    // Bind the SP1 program input n=20 in the config and let the fulfiller supply outputs.
    let fixed_public_inputs = public_values[..4].to_vec();
    let public_inputs_suffix = public_values[4..].to_vec();

    (proof, fixed_public_inputs, public_inputs_suffix)
}

#[test]
fn validity_e2e_creates_config_and_rejects_bad_proof() {
    let mut svm = LiteSVM::new();
    if !load_programs(&mut svm) {
        return;
    }

    let maker = Keypair::new();
    let receiver = Keypair::new();
    svm.airdrop(&maker.pubkey(), 1_000_000_000).unwrap();
    svm.airdrop(&receiver.pubkey(), 1_000_000).unwrap();

    let guest_elf_hash = [1u8; 32];
    let sp1_vkey_hash = [2u8; 32];
    let fixed_public_inputs = vec![3, 4, 5, 6];
    let config_hash = validity::hash_config(&guest_elf_hash, &sp1_vkey_hash, &fixed_public_inputs);
    let config = validity_pda(&config_hash);
    let intent = intent_pda(&maker.pubkey(), &INTENT_ID);

    send_ix(
        &mut svm,
        &maker,
        create_validity_ix(
            &maker.pubkey(),
            &config,
            validity::CreateValidityArgs {
                config_hash,
                guest_elf_hash,
                sp1_vkey_hash,
                fixed_public_inputs: fixed_public_inputs.clone(),
            },
        ),
    )
    .unwrap();

    let stored_config = read_validity_config(&mut svm, &config);
    assert_eq!(stored_config.config_hash, config_hash);
    assert_eq!(stored_config.fixed_public_inputs, fixed_public_inputs);

    send_ix(
        &mut svm,
        &maker,
        create_intent_ix(&maker.pubkey(), &receiver.pubkey(), &intent, config_hash),
    )
    .unwrap();

    assert!(send_ix(
        &mut svm,
        &maker,
        fulfill_ix(
            &receiver.pubkey(),
            &intent,
            &config,
            validity::ValidityFulfillment {
                proof: vec![1, 2, 3, 4],
                public_inputs_suffix: vec![7, 8],
            }
            .serialize_to_vec()
        ),
    )
    .is_err());

    let active_intent = read_intent(&mut svm, &intent);
    assert_eq!(active_intent.status, laplace::IntentStatus::Active);
}

#[test]
fn validity_e2e_accepts_real_sp1_fibonacci_proof() {
    let mut svm = LiteSVM::new();
    if !load_programs(&mut svm) {
        return;
    }

    let maker = Keypair::new();
    let receiver = Keypair::new();
    svm.airdrop(&maker.pubkey(), 1_000_000_000).unwrap();
    svm.airdrop(&receiver.pubkey(), 1_000_000).unwrap();
    let receiver_before = svm.get_balance(&receiver.pubkey()).unwrap();

    let (proof, fixed_public_inputs, public_inputs_suffix) = fibonacci_fixture();
    let config_hash = validity::hash_config(
        &FIBONACCI_GUEST_ELF_HASH,
        &FIBONACCI_SP1_VKEY_HASH,
        &fixed_public_inputs,
    );
    let config = validity_pda(&config_hash);
    let intent = intent_pda(&maker.pubkey(), &INTENT_ID);

    send_ix(
        &mut svm,
        &maker,
        create_validity_ix(
            &maker.pubkey(),
            &config,
            validity::CreateValidityArgs {
                config_hash,
                guest_elf_hash: FIBONACCI_GUEST_ELF_HASH,
                sp1_vkey_hash: FIBONACCI_SP1_VKEY_HASH,
                fixed_public_inputs,
            },
        ),
    )
    .unwrap();

    send_ix(
        &mut svm,
        &maker,
        create_intent_ix(&maker.pubkey(), &receiver.pubkey(), &intent, config_hash),
    )
    .unwrap();

    send_ixs(
        &mut svm,
        &maker,
        vec![
            compute_budget_limit_ix(350_000),
            fulfill_ix(
                &receiver.pubkey(),
                &intent,
                &config,
                validity::ValidityFulfillment {
                    proof,
                    public_inputs_suffix,
                }
                .serialize_to_vec(),
            ),
        ],
    )
    .unwrap();

    let fulfilled = read_intent(&mut svm, &intent);
    assert_eq!(fulfilled.status, laplace::IntentStatus::Fulfilled);
    assert_eq!(
        svm.get_balance(&receiver.pubkey()).unwrap(),
        receiver_before + 10_000
    );
}

trait SerializeToVec {
    fn serialize_to_vec(&self) -> Vec<u8>;
}

impl SerializeToVec for validity::ValidityFulfillment {
    fn serialize_to_vec(&self) -> Vec<u8> {
        let mut data = Vec::new();
        self.serialize(&mut data).unwrap();
        data
    }
}
