use anchor_lang::{prelude::Pubkey, AnchorDeserialize, AnchorSerialize};

fn encrypted_disclosure_fixture() -> (
    encrypted_disclosure::EncryptedDisclosureInput,
    validity::ValidityConfig,
    laplace::CriterionVerificationRequest,
) {
    let intent = encrypted_disclosure::IntentBinding {
        protocol_program: laplace::id().to_bytes(),
        criterion_program: validity::id().to_bytes(),
        intent_id: [8; 32],
        maker: [9; 32],
        receiver: [10; 32],
        refund_recipient: [11; 32],
        asset_hash: [12; 32],
        amount: 1_000,
        expiry_slot: 2_000,
    };
    let input = encrypted_disclosure::sample_fixture(intent.clone());
    let fixed_public_inputs =
        encrypted_disclosure::validity_fixed_public_inputs(&input.public_inputs);
    let guest_elf_hash = encrypted_disclosure::guest_elf_hash();
    let sp1_vkey_hash = [2u8; 32];
    let config_hash = validity::hash_config(&guest_elf_hash, &sp1_vkey_hash, &fixed_public_inputs);

    let config = validity::ValidityConfig {
        config_hash,
        guest_elf_hash,
        sp1_vkey_hash,
        fixed_public_inputs: fixed_public_inputs.clone(),
        bump: 255,
    };

    let request = laplace::CriterionVerificationRequest {
        interface_version: laplace::CRITERION_INTERFACE_VERSION,
        protocol_program: laplace::id(),
        intent: Pubkey::new_from_array([7; 32]),
        intent_id: intent.intent_id,
        maker: Pubkey::new_from_array(intent.maker),
        receiver: Pubkey::new_from_array(intent.receiver),
        refund_recipient: Pubkey::new_from_array(intent.refund_recipient),
        asset: laplace::EscrowAsset::NativeSol,
        amount: intent.amount,
        expiry_slot: intent.expiry_slot,
        created_slot: 100,
        criterion_program: validity::id(),
        criterion_data_hash: config_hash,
        fulfillment_data: encrypted_disclosure::validity_public_inputs_suffix(),
    };

    (input, config, request)
}

fn serialize_fulfillment(payload: &validity::ValidityFulfillment) -> Vec<u8> {
    let mut data = Vec::new();
    payload.serialize(&mut data).unwrap();
    data
}

fn sample_config() -> (
    laplace::CriterionVerificationRequest,
    [u8; 32],
    [u8; 32],
    Vec<u8>,
) {
    let guest_elf_hash = [1u8; 32];
    let sp1_vkey_hash = [2u8; 32];
    let fixed_public_inputs = vec![3, 4, 5, 6];
    let config_hash = validity::hash_config(&guest_elf_hash, &sp1_vkey_hash, &fixed_public_inputs);
    let fulfillment = validity::ValidityFulfillment {
        proof: vec![12, 13, 14],
        public_inputs_suffix: vec![15, 16],
    };

    let request = laplace::CriterionVerificationRequest {
        interface_version: laplace::CRITERION_INTERFACE_VERSION,
        protocol_program: laplace::id(),
        intent: Pubkey::new_from_array([7; 32]),
        intent_id: [8; 32],
        maker: Pubkey::new_from_array([9; 32]),
        receiver: Pubkey::new_from_array([10; 32]),
        refund_recipient: Pubkey::new_from_array([11; 32]),
        asset: laplace::EscrowAsset::NativeSol,
        amount: 1_000,
        expiry_slot: 2_000,
        created_slot: 100,
        criterion_program: validity::id(),
        criterion_data_hash: config_hash,
        fulfillment_data: serialize_fulfillment(&fulfillment),
    };

    (request, guest_elf_hash, sp1_vkey_hash, fixed_public_inputs)
}

fn validity_config(
    guest_elf_hash: [u8; 32],
    sp1_vkey_hash: [u8; 32],
    fixed_public_inputs: Vec<u8>,
) -> validity::ValidityConfig {
    validity::ValidityConfig {
        config_hash: validity::hash_config(&guest_elf_hash, &sp1_vkey_hash, &fixed_public_inputs),
        guest_elf_hash,
        sp1_vkey_hash,
        fixed_public_inputs,
        bump: 255,
    }
}

#[test]
fn config_hash_is_stable_and_binds_elf_and_vkey() {
    let guest_elf_hash = [1u8; 32];
    let sp1_vkey_hash = [2u8; 32];
    let fixed_public_inputs = vec![3, 4, 5, 6];

    let config_hash = validity::hash_config(&guest_elf_hash, &sp1_vkey_hash, &fixed_public_inputs);
    let config_hash_again =
        validity::hash_config(&guest_elf_hash, &sp1_vkey_hash, &fixed_public_inputs);

    assert_eq!(config_hash, config_hash_again);
    assert_ne!(
        config_hash,
        validity::hash_config(&[9u8; 32], &sp1_vkey_hash, &fixed_public_inputs)
    );
    assert_ne!(
        config_hash,
        validity::hash_config(&guest_elf_hash, &[9u8; 32], &fixed_public_inputs)
    );
}

#[test]
fn public_inputs_reconstruct_from_prefix_and_suffix() {
    let prefix = vec![1, 2, 3];
    let suffix = vec![4, 5, 6];

    assert_eq!(
        validity::reconstruct_public_inputs(&prefix, &suffix),
        vec![1, 2, 3, 4, 5, 6]
    );
}

#[test]
fn request_round_trip_binds_validity_config_hash() {
    let (request, _guest_elf_hash, _sp1_vkey_hash, _fixed_public_inputs) = sample_config();
    let mut data = laplace::VERIFY_CRITERION_DISCRIMINATOR.to_vec();
    request.serialize(&mut data).unwrap();

    let decoded = laplace::CriterionVerificationRequest::try_from_slice(&data[8..]).unwrap();
    assert_eq!(decoded.criterion_program, validity::id());
    assert_eq!(decoded.criterion_data_hash, request.criterion_data_hash);
}

#[test]
fn fulfillment_payload_round_trips() {
    let payload = validity::ValidityFulfillment {
        proof: vec![12, 13, 14],
        public_inputs_suffix: vec![15, 16],
    };

    let data = serialize_fulfillment(&payload);
    let decoded = validity::ValidityFulfillment::try_from_slice(&data).unwrap();
    assert_eq!(decoded.proof, payload.proof);
    assert_eq!(decoded.public_inputs_suffix, payload.public_inputs_suffix);
}

#[test]
fn encrypted_disclosure_helper_binds_validity_inputs() {
    let (input, config, request) = encrypted_disclosure_fixture();

    assert_eq!(
        config.fixed_public_inputs,
        encrypted_disclosure::validity_fixed_public_inputs(&input.public_inputs)
    );
    assert_eq!(
        request.fulfillment_data,
        encrypted_disclosure::validity_public_inputs_suffix()
    );
}

#[test]
fn validity_request_rejects_wrong_criterion_program() {
    let (mut request, guest_elf_hash, sp1_vkey_hash, fixed_public_inputs) = sample_config();
    let config = validity_config(guest_elf_hash, sp1_vkey_hash, fixed_public_inputs);
    request.criterion_program = Pubkey::new_from_array([99; 32]);

    assert!(validity::validate_request(&config, &request).is_err());
}

#[test]
fn validity_request_rejects_malformed_fulfillment() {
    let (mut request, guest_elf_hash, sp1_vkey_hash, fixed_public_inputs) = sample_config();
    let config = validity_config(guest_elf_hash, sp1_vkey_hash, fixed_public_inputs);
    request.fulfillment_data = vec![1, 2, 3];

    assert!(validity::validate_request(&config, &request).is_err());
}

#[test]
fn validity_request_rejects_fake_proof() {
    let (request, guest_elf_hash, sp1_vkey_hash, fixed_public_inputs) = sample_config();
    let config = validity_config(guest_elf_hash, sp1_vkey_hash, fixed_public_inputs);

    assert!(validity::validate_request(&config, &request).is_err());
}
