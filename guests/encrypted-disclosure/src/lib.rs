use borsh::{BorshDeserialize, BorshSerialize};
use sha2::{Digest, Sha256};

pub const ENCRYPTED_DISCLOSURE_SCHEMA_VERSION: u16 = 1;
pub const CIPHER_SUITE_SHA256_XOR: u16 = 1;

const HASH_DOMAIN: &[u8] = b"laplace-encrypted-disclosure-hash-v1";
const STREAM_DOMAIN: &[u8] = b"laplace-encrypted-disclosure-x25519-sha256-xor-v1";

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct IntentBinding {
    pub protocol_program: [u8; 32],
    pub criterion_program: [u8; 32],
    pub intent_id: [u8; 32],
    pub maker: [u8; 32],
    pub receiver: [u8; 32],
    pub refund_recipient: [u8; 32],
    pub asset_hash: [u8; 32],
    pub amount: u64,
    pub expiry_slot: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct DisclosureBinding {
    pub decryption_key_commitment: [u8; 32],
    pub nonce: [u8; 24],
    pub plaintext_len: u32,
    pub ciphertext_hash: [u8; 32],
    pub plaintext_hash: [u8; 32],
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct EncryptedDisclosurePublicInputs {
    pub schema_version: u16,
    pub cipher_suite: u16,
    pub intent: IntentBinding,
    pub disclosure: DisclosureBinding,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct EncryptedDisclosureWitness {
    pub decryption_key: [u8; 32],
    pub ciphertext: Vec<u8>,
    pub plaintext: Vec<u8>,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct EncryptedDisclosureInput {
    pub public_inputs: EncryptedDisclosurePublicInputs,
    pub witness: EncryptedDisclosureWitness,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EncryptedDisclosureError {
    UnsupportedSchemaVersion,
    UnsupportedCipherSuite,
    DecryptionKeyCommitmentMismatch,
    PlaintextLengthMismatch,
    CiphertextLengthMismatch,
    CiphertextHashMismatch,
    PlaintextHashMismatch,
    DecryptionMismatch,
}

pub fn hash_bytes(data: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(HASH_DOMAIN);
    hasher.update((data.len() as u64).to_be_bytes());
    hasher.update(data);
    hasher.finalize().into()
}

pub fn public_inputs_bytes(public_inputs: &EncryptedDisclosurePublicInputs) -> Vec<u8> {
    borsh::to_vec(public_inputs).expect("encrypted disclosure public inputs serialize")
}

pub fn validity_fixed_public_inputs(public_inputs: &EncryptedDisclosurePublicInputs) -> Vec<u8> {
    public_inputs_bytes(public_inputs)
}

pub fn validity_public_inputs_suffix() -> Vec<u8> {
    Vec::new()
}

pub fn guest_elf_hash() -> [u8; 32] {
    hash_bytes(b"laplace-encrypted-disclosure-guest-elf-v1")
}

pub fn decryption_key_commitment(decryption_key: [u8; 32]) -> [u8; 32] {
    hash_bytes(&decryption_key)
}

pub fn input_bytes(input: &EncryptedDisclosureInput) -> Vec<u8> {
    borsh::to_vec(input).expect("encrypted disclosure input serialize")
}

pub fn decode_input(data: &[u8]) -> Result<EncryptedDisclosureInput, std::io::Error> {
    EncryptedDisclosureInput::try_from_slice(data)
}

pub fn encrypt_for_disclosure_key(
    decryption_key: [u8; 32],
    nonce: [u8; 24],
    plaintext: &[u8],
) -> Vec<u8> {
    xor_stream(&decryption_key, &nonce, plaintext)
}

pub fn verify_input(input: &EncryptedDisclosureInput) -> Result<(), EncryptedDisclosureError> {
    let public_inputs = &input.public_inputs;
    let witness = &input.witness;

    if public_inputs.schema_version != ENCRYPTED_DISCLOSURE_SCHEMA_VERSION {
        return Err(EncryptedDisclosureError::UnsupportedSchemaVersion);
    }
    if public_inputs.cipher_suite != CIPHER_SUITE_SHA256_XOR {
        return Err(EncryptedDisclosureError::UnsupportedCipherSuite);
    }

    let expected_decryption_key_commitment = decryption_key_commitment(witness.decryption_key);
    if expected_decryption_key_commitment != public_inputs.disclosure.decryption_key_commitment {
        return Err(EncryptedDisclosureError::DecryptionKeyCommitmentMismatch);
    }

    if witness.plaintext.len() != public_inputs.disclosure.plaintext_len as usize {
        return Err(EncryptedDisclosureError::PlaintextLengthMismatch);
    }
    if witness.ciphertext.len() != public_inputs.disclosure.plaintext_len as usize {
        return Err(EncryptedDisclosureError::CiphertextLengthMismatch);
    }
    if hash_bytes(&witness.ciphertext) != public_inputs.disclosure.ciphertext_hash {
        return Err(EncryptedDisclosureError::CiphertextHashMismatch);
    }
    if hash_bytes(&witness.plaintext) != public_inputs.disclosure.plaintext_hash {
        return Err(EncryptedDisclosureError::PlaintextHashMismatch);
    }

    let decrypted = xor_stream(
        &witness.decryption_key,
        &public_inputs.disclosure.nonce,
        &witness.ciphertext,
    );

    if decrypted != witness.plaintext {
        return Err(EncryptedDisclosureError::DecryptionMismatch);
    }

    Ok(())
}

pub fn sample_fixture(intent: IntentBinding) -> EncryptedDisclosureInput {
    let decryption_key = [11u8; 32];
    let nonce = [13u8; 24];
    let plaintext = b"laplace encrypted disclosure fixture".to_vec();
    let ciphertext = encrypt_for_disclosure_key(decryption_key, nonce, &plaintext);

    EncryptedDisclosureInput {
        public_inputs: EncryptedDisclosurePublicInputs {
            schema_version: ENCRYPTED_DISCLOSURE_SCHEMA_VERSION,
            cipher_suite: CIPHER_SUITE_SHA256_XOR,
            intent,
            disclosure: DisclosureBinding {
                decryption_key_commitment: decryption_key_commitment(decryption_key),
                nonce,
                plaintext_len: plaintext.len() as u32,
                ciphertext_hash: hash_bytes(&ciphertext),
                plaintext_hash: hash_bytes(&plaintext),
            },
        },
        witness: EncryptedDisclosureWitness {
            decryption_key,
            ciphertext,
            plaintext,
        },
    }
}

fn xor_stream(shared_secret: &[u8; 32], nonce: &[u8; 24], input: &[u8]) -> Vec<u8> {
    let mut output = Vec::with_capacity(input.len());

    for (block_index, chunk) in input.chunks(32).enumerate() {
        let mut hasher = Sha256::new();
        hasher.update(STREAM_DOMAIN);
        hasher.update(shared_secret);
        hasher.update(nonce);
        hasher.update((block_index as u64).to_be_bytes());
        let stream_block: [u8; 32] = hasher.finalize().into();

        output.extend(
            chunk
                .iter()
                .zip(stream_block.iter())
                .map(|(input_byte, stream_byte)| input_byte ^ stream_byte),
        );
    }

    output
}

#[cfg(test)]
mod tests {
    use super::*;

    fn intent_binding() -> IntentBinding {
        IntentBinding {
            protocol_program: [1; 32],
            criterion_program: [2; 32],
            intent_id: [3; 32],
            maker: [4; 32],
            receiver: [5; 32],
            refund_recipient: [6; 32],
            asset_hash: [7; 32],
            amount: 8,
            expiry_slot: 9,
        }
    }

    #[test]
    fn sample_fixture_verifies_and_serializes() {
        let input = sample_fixture(intent_binding());

        verify_input(&input).unwrap();
        assert_eq!(decode_input(&input_bytes(&input)).unwrap(), input);
        assert!(!public_inputs_bytes(&input.public_inputs).is_empty());
        assert_eq!(
            validity_fixed_public_inputs(&input.public_inputs),
            public_inputs_bytes(&input.public_inputs)
        );
        assert!(validity_public_inputs_suffix().is_empty());
    }

    #[test]
    fn rejects_tampered_plaintext() {
        let mut input = sample_fixture(intent_binding());
        input.witness.plaintext[0] ^= 1;

        assert_eq!(
            verify_input(&input),
            Err(EncryptedDisclosureError::PlaintextHashMismatch)
        );
    }

    #[test]
    fn rejects_wrong_receiver_key() {
        let mut input = sample_fixture(intent_binding());
        input.witness.decryption_key = [42; 32];

        assert_eq!(
            verify_input(&input),
            Err(EncryptedDisclosureError::DecryptionKeyCommitmentMismatch)
        );
    }
}
