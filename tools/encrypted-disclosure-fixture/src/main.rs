use std::{fs, path::Path};

use anyhow::{Context, Result};
use encrypted_disclosure::{EncryptedDisclosureInput, IntentBinding};
use sha2::{Digest, Sha256};
use sp1_sdk::{
    blocking::{ProveRequest, Prover, ProverClient},
    include_elf, Elf, HashableKey, ProvingKey, SP1ProofWithPublicValues, SP1Stdin,
};

const ENCRYPTED_DISCLOSURE_ELF: Elf = include_elf!("encrypted-disclosure");
const FIXTURE_DIR: &str = "../../programs/validity/tests/fixtures";

fn main() -> Result<()> {
    sp1_sdk::utils::setup_logger();
    std::env::set_var("SP1_PROVER", "cpu");
    std::env::set_var("SP1_DOCKER_IMAGE", "ghcr.io/succinctlabs/sp1:v6.1.0");
    std::env::set_var("SP1_GNARK_IMAGE", "ghcr.io/succinctlabs/sp1-gnark:v6.1.0");

    let rt = tokio::runtime::Runtime::new()
        .context("failed to create tokio runtime")?;
    rt.block_on(sp1_prover::build::try_install_circuit_artifacts("groth16"))
        .context("failed to install groth16 circuit artifacts")?;

    let input = fixture_input();
    let fixed_public_inputs = encrypted_disclosure::validity_fixed_public_inputs(&input.public_inputs);

    let client = ProverClient::from_env();
    let pk = client
        .setup(ENCRYPTED_DISCLOSURE_ELF)
        .context("failed to set up encrypted disclosure guest")?;

    let (output, report) = client
        .execute(ENCRYPTED_DISCLOSURE_ELF, fixture_stdin(&input))
        .run()
        .context("failed to execute encrypted disclosure guest")?;
    anyhow::ensure!(
        output.as_slice() == fixed_public_inputs.as_slice(),
        "guest public inputs differ from validity fixed public inputs"
    );
    println!(
        "encrypted-disclosure guest executed in {} cycles",
        report.total_instruction_count()
    );

    let proof = client
        .prove(&pk, fixture_stdin(&input))
        .groth16()
        .run()
        .context("failed to generate encrypted disclosure Groth16 proof")?;

    client
        .verify(&proof, pk.verifying_key(), None)
        .context("failed to verify encrypted disclosure proof")?;

    write_fixture_files(&proof, &fixed_public_inputs, pk.verifying_key().bytes32_raw())
}

fn fixture_input() -> EncryptedDisclosureInput {
    encrypted_disclosure::sample_fixture(IntentBinding {
        protocol_program: laplace::id().to_bytes(),
        criterion_program: validity::id().to_bytes(),
        intent_id: [31; 32],
        maker: [41; 32],
        receiver: [42; 32],
        refund_recipient: [41; 32],
        asset_hash: encrypted_disclosure::hash_bytes(&[0]),
        amount: 10_000,
        expiry_slot: 1_000,
    })
}

fn fixture_stdin(input: &EncryptedDisclosureInput) -> SP1Stdin {
    let mut stdin = SP1Stdin::new();
    stdin.write(&encrypted_disclosure::input_bytes(input));
    stdin
}

fn write_fixture_files(
    proof: &SP1ProofWithPublicValues,
    public_inputs: &[u8],
    sp1_vkey_hash: [u8; 32],
) -> Result<()> {
    let fixture_dir = Path::new(FIXTURE_DIR);
    fs::create_dir_all(fixture_dir).context("failed to create fixture directory")?;

    write_hex(
        fixture_dir.join("encrypted_disclosure_groth16_proof.hex"),
        &proof.bytes(),
    )?;
    write_hex(
        fixture_dir.join("encrypted_disclosure_public_values.hex"),
        public_inputs,
    )?;
    write_hex(
        fixture_dir.join("encrypted_disclosure_guest_elf_hash.hex"),
        &Sha256::digest(&*ENCRYPTED_DISCLOSURE_ELF),
    )?;
    write_hex(
        fixture_dir.join("encrypted_disclosure_sp1_vkey_hash.hex"),
        &sp1_vkey_hash,
    )?;

    println!("wrote encrypted-disclosure fixtures to {FIXTURE_DIR}");
    Ok(())
}

fn write_hex(path: impl AsRef<Path>, bytes: &[u8]) -> Result<()> {
    fs::write(path.as_ref(), format!("{}\n", hex::encode(bytes)))
        .with_context(|| format!("failed to write {}", path.as_ref().display()))
}
