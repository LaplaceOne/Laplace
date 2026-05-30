use anchor_lang::prelude::Pubkey;

fn valid_request(preimage: &[u8]) -> laplace::CriterionVerificationRequest {
    let mut request = laplace::CriterionVerificationRequest {
        interface_version: laplace::CRITERION_INTERFACE_VERSION,
        protocol_program: laplace::id(),
        intent: Pubkey::new_from_array([1; 32]),
        intent_id: [2; 32],
        maker: Pubkey::new_from_array([3; 32]),
        receiver: Pubkey::new_from_array([4; 32]),
        refund_recipient: Pubkey::new_from_array([5; 32]),
        asset: laplace::EscrowAsset::NativeSol,
        amount: 1_000,
        expiry_slot: 2_000,
        created_slot: 100,
        criterion_program: hashlock::id(),
        criterion_data_hash: [0; 32],
        fulfillment_data: preimage.to_vec(),
    };
    // The commitment binds the intent fields, so it must be computed over the request itself.
    let hashlock = hashlock::hash_preimage(preimage);
    request.criterion_data_hash = hashlock::hash_hashlock_commitment(&request, &hashlock);
    request
}

#[test]
fn hashlock_adapter_verifies_preimage() {
    let preimage = b"super-secret-preimage-000000000000";
    let hashlock = hashlock::hash_preimage(preimage);

    assert!(hashlock::preimage_matches(&hashlock, preimage));
}

#[test]
fn hashlock_adapter_rejects_wrong_preimage() {
    let hashlock = hashlock::hash_preimage(b"correct preimage");

    assert!(!hashlock::preimage_matches(&hashlock, b"wrong preimage"));
}

#[test]
fn hashlock_adapter_criterion_hash_round_trips() {
    let hashlock = [42u8; 32];
    let mut cloned = hashlock;

    assert_eq!(hashlock, cloned);
    cloned[0] = 7;
    assert_ne!(hashlock, cloned);
}

#[test]
fn hashlock_request_accepts_valid_fulfillment() {
    let request = valid_request(b"correct preimage");

    assert!(hashlock::validate_request(&request).is_ok());
}

#[test]
fn hashlock_request_rejects_wrong_interface_version() {
    let mut request = valid_request(b"correct preimage");
    request.interface_version += 1;

    assert!(hashlock::validate_request(&request).is_err());
}

#[test]
fn hashlock_request_rejects_wrong_criterion_program() {
    let mut request = valid_request(b"correct preimage");
    request.criterion_program = Pubkey::new_from_array([9; 32]);

    assert!(hashlock::validate_request(&request).is_err());
}

#[test]
fn hashlock_request_rejects_empty_fulfillment_data() {
    let mut request = valid_request(b"correct preimage");
    request.fulfillment_data.clear();
    request.criterion_data_hash = hashlock::hash_preimage(&request.fulfillment_data);

    assert!(hashlock::validate_request(&request).is_err());
}

#[test]
fn hashlock_request_rejects_oversized_fulfillment_data() {
    let data = vec![7; laplace::MAX_FULFILLMENT_DATA_LEN + 1];
    let mut request = valid_request(b"correct preimage");
    request.criterion_data_hash = hashlock::hash_preimage(&data);
    request.fulfillment_data = data;

    assert!(hashlock::validate_request(&request).is_err());
}

#[test]
fn hashlock_request_rejects_wrong_preimage() {
    let mut request = valid_request(b"correct preimage");
    request.fulfillment_data = b"wrong preimage".to_vec();

    assert!(hashlock::validate_request(&request).is_err());
}
