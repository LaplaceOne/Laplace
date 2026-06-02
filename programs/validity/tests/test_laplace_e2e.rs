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

/// Read a built program `.so` from the workspace-root `target/deploy`, resolved relative to this
/// crate (`CARGO_MANIFEST_DIR` = `programs/validity`) so it works regardless of the test's CWD.
///
/// Fail-closed: a missing `.so` PANICS rather than skipping, so a green `cargo test` run can never
/// silently hide un-executed e2e coverage. Build with `anchor build --ignore-keys` first.
fn deploy_so(name: &str) -> Vec<u8> {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../target/deploy")
        .join(name);
    std::fs::read(&path).unwrap_or_else(|err| {
        panic!(
            "{name} not found ({err}) — run `anchor build --ignore-keys` before e2e tests (looked in {})",
            path.display()
        )
    })
}

fn load_programs(svm: &mut LiteSVM) {
    svm.add_program(laplace::id(), &deploy_so("laplace.so")).unwrap();
    svm.add_program(validity::id(), &deploy_so("validity.so")).unwrap();
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
    load_programs(&mut svm);

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

/// The Fibonacci fixture was generated WITHOUT an intent-binding prefix (pre-universal-binding).
/// Since the adapter now mandatorily prepends the 32-byte `intent_binding_hash` to the public
/// inputs before calling `verify_proof`, this fixture's public inputs no longer match the proof —
/// the proof is cryptographically invalid against the new prefixed layout.
///
/// This test PROVES the guard fires: an unbound proof is REJECTED by the adapter.
///
/// Note: the intent remains Active (not Fulfilled) because the fulfill transaction fails.
#[test]
fn validity_e2e_rejects_unbound_fibonacci_proof_after_binding_enforcement() {
    let mut svm = LiteSVM::new();
    load_programs(&mut svm);

    let maker = Keypair::new();
    let receiver = Keypair::new();
    svm.airdrop(&maker.pubkey(), 1_000_000_000).unwrap();
    svm.airdrop(&receiver.pubkey(), 1_000_000).unwrap();

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

    // Confirm config_hash parity: the config PDA stores exactly the hash we computed.
    let stored_config = read_validity_config(&mut svm, &config);
    assert_eq!(
        stored_config.config_hash, config_hash,
        "config PDA must store the criterion_data_hash used in create"
    );

    send_ix(
        &mut svm,
        &maker,
        create_intent_ix(&maker.pubkey(), &receiver.pubkey(), &intent, config_hash),
    )
    .unwrap();

    // The adapter now prepends the 32-byte intent_binding_hash to the public inputs before
    // calling verify_proof. The Fibonacci fixture was NOT generated with this prefix, so the
    // Groth16 verifier rejects it — proving the replay guard fires.
    let fulfill_result = send_ixs(
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
    );

    assert!(
        fulfill_result.is_err(),
        "unbound Fibonacci proof must be REJECTED after intent-binding enforcement"
    );

    // The intent must remain Active — no funds were transferred.
    let active_intent = read_intent(&mut svm, &intent);
    assert_eq!(
        active_intent.status,
        laplace::IntentStatus::Active,
        "intent must remain Active when the unbound proof is rejected"
    );
}

// TODO(sp1-tooling): Generate a Groth16 proof whose leading 32 public-input bytes equal
// `intent_binding_hash(request)` (computed from the actual intent fields used in the test),
// followed by the fixed_public_inputs and suffix as before. This requires the SP1 toolchain
// (sp1-sdk, RISC-V guest compiler) which is not available in this environment.
//
// Guest-authoring contract: the SP1 guest MUST commit the 32-byte `intent_binding_hash` as
// its LEADING public output, followed by any criterion-specific fixed values, then suffix values.
// The adapter enforces this layout by construction — it will always prepend the tag before
// calling verify_proof, so a guest that omits the tag will always be rejected.
//
// When SP1 tooling is available, un-ignore this test, generate a bound fixture, and verify
// that `fulfill_result.is_ok()` and `intent.status == IntentStatus::Fulfilled`.
#[test]
#[ignore = "TODO(sp1-tooling): needs a bound Groth16 fixture generated with intent_binding_hash as leading public input"]
fn validity_e2e_accepts_bound_sp1_proof() {
    // Stub — see comment above for the required guest layout and fixture generation steps.
    // The test body should follow the same pattern as the rejection test above, but:
    //   1. Generate a proof where public_inputs[0..32] == intent_binding_hash(request).
    //   2. Set fixed_public_inputs to the criterion-specific constants (NOT intent fields).
    //   3. Assert fulfill_result.is_ok() and intent.status == IntentStatus::Fulfilled.
    todo!("generate bound SP1 fixture — see TODO(sp1-tooling) comment above");
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
