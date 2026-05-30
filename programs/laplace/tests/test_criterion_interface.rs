use anchor_lang::{prelude::Pubkey, AnchorDeserialize, AnchorSerialize};

fn sample_request() -> laplace::CriterionVerificationRequest {
    laplace::CriterionVerificationRequest {
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
        criterion_program: Pubkey::new_from_array([6; 32]),
        criterion_data_hash: [7; 32],
        fulfillment_data: vec![8, 9, 10],
    }
}

fn criterion_instruction_data(request: &laplace::CriterionVerificationRequest) -> Vec<u8> {
    let mut data = laplace::VERIFY_CRITERION_DISCRIMINATOR.to_vec();
    request.serialize(&mut data).unwrap();
    data
}

#[test]
fn interface_constants_are_stable() {
    assert_eq!(laplace::CRITERION_INTERFACE_VERSION, 2);
    assert_eq!(laplace::MAX_FULFILLMENT_DATA_LEN, 1024);
    assert_eq!(laplace::VERIFY_CRITERION_DISCRIMINATOR.len(), 8);
    assert_eq!(
        laplace::VERIFY_CRITERION_DISCRIMINATOR,
        [0x8c, 0x7b, 0x8b, 0x85, 0x67, 0xd5, 0x72, 0xab]
    );
}

#[test]
fn intent_space_matches_manual_layout() {
    assert_eq!(laplace::Intent::LEN, 317);
    assert_eq!(8 + laplace::Intent::LEN, 325);
}

#[test]
fn criterion_request_uses_standard_discriminator_prefix() {
    let request = sample_request();
    let data = criterion_instruction_data(&request);

    assert_eq!(&data[..8], laplace::VERIFY_CRITERION_DISCRIMINATOR);
    assert!(data.len() > laplace::VERIFY_CRITERION_DISCRIMINATOR.len());
}

#[test]
fn criterion_request_round_trips_with_all_intent_bindings() {
    let request = sample_request();
    let data = criterion_instruction_data(&request);
    let decoded = laplace::CriterionVerificationRequest::try_from_slice(&data[8..]).unwrap();

    assert_eq!(
        decoded.interface_version,
        laplace::CRITERION_INTERFACE_VERSION
    );
    assert_eq!(decoded.protocol_program, request.protocol_program);
    assert_eq!(decoded.intent, request.intent);
    assert_eq!(decoded.intent_id, request.intent_id);
    assert_eq!(decoded.maker, request.maker);
    assert_eq!(decoded.receiver, request.receiver);
    assert_eq!(decoded.refund_recipient, request.refund_recipient);
    assert_eq!(decoded.asset, request.asset);
    assert_eq!(decoded.amount, request.amount);
    assert_eq!(decoded.expiry_slot, request.expiry_slot);
    assert_eq!(decoded.created_slot, request.created_slot);
    assert_eq!(decoded.criterion_program, request.criterion_program);
    assert_eq!(decoded.criterion_data_hash, request.criterion_data_hash);
    assert_eq!(decoded.fulfillment_data, request.fulfillment_data);
}
