#![no_main]

#[cfg(target_os = "zkvm")]
sp1_zkvm::entrypoint!(main);

#[cfg(target_os = "zkvm")]
pub fn main() {
    use borsh::BorshDeserialize;

    let input_bytes = sp1_zkvm::io::read::<Vec<u8>>();
    let input = encrypted_disclosure::EncryptedDisclosureInput::try_from_slice(&input_bytes)
        .expect("invalid encrypted disclosure input");

    encrypted_disclosure::verify_input(&input).expect("encrypted disclosure verification failed");
    let public_inputs = encrypted_disclosure::public_inputs_bytes(&input.public_inputs);
    sp1_zkvm::io::commit_slice(&public_inputs);
}

#[cfg(not(target_os = "zkvm"))]
fn main() {}
