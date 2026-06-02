use {
    anchor_lang::{solana_program::instruction::Instruction, InstructionData, ToAccountMetas},
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

#[test]
fn test_initialize() {
    let program_id = laplace::id();
    let payer = Keypair::new();
    let mut svm = LiteSVM::new();
    // Resolve the .so at the workspace root (CARGO_MANIFEST_DIR = programs/laplace), independent of
    // CWD, and fail-closed if missing so a green run can't hide a skipped smoke test.
    let so_path =
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../target/deploy/laplace.so");
    let bytes = std::fs::read(&so_path).unwrap_or_else(|err| {
        panic!(
            "laplace.so not found ({err}) — run `anchor build --ignore-keys` first (looked in {})",
            so_path.display()
        )
    });
    svm.add_program(program_id, &bytes).unwrap();
    svm.airdrop(&payer.pubkey(), 1_000_000_000).unwrap();

    let instruction = Instruction::new_with_bytes(
        program_id,
        &laplace::instruction::Initialize {}.data(),
        laplace::accounts::Initialize {}.to_account_metas(None),
    );

    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[instruction], Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer]).unwrap();

    let res = svm.send_transaction(tx);
    assert!(res.is_ok());
}
