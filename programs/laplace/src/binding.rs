use solana_sha256_hasher::hash;

use crate::{CriterionVerificationRequest, EscrowAsset};

/// Domain separator for the universal intent-binding hash. Shared by all criteria that derive
/// their accept/reject decision from this primitive. Bumping this is a breaking change.
pub const INTENT_BINDING_DOMAIN: &[u8] = b"laplace-intent-bind-v1";

/// Canonical, replay-resistant 32-byte binding over an intent's identity. Every criterion derives
/// its accept/reject decision from this value. Excludes `created_slot` and the intent PDA
/// (a maker does not know them at commit time), `fulfillment_data`, `criterion_data_hash`,
/// and `protocol_program`.
///
/// ```text
/// SHA256(
///   INTENT_BINDING_DOMAIN
///   ‖ u16be(interface_version)
///   ‖ criterion_program   (32)
///   ‖ intent_id           (32)
///   ‖ maker               (32)
///   ‖ receiver            (32)
///   ‖ refund_recipient    (32)
///   ‖ asset_canonical     ([0] = NativeSol; [1] ‖ mint ‖ token_program = SplToken)
///   ‖ u64be(amount)
///   ‖ u64be(expiry_slot)
/// )
/// ```
///
/// Mirrored byte-for-byte by `@laplace-one/sdk` `intentBindingHash`.
pub fn intent_binding_hash(req: &CriterionVerificationRequest) -> [u8; 32] {
    intent_binding_hash_from_parts(
        req.interface_version,
        req.criterion_program.as_ref(),
        &req.intent_id,
        req.maker.as_ref(),
        req.receiver.as_ref(),
        req.refund_recipient.as_ref(),
        &req.asset,
        req.amount,
        req.expiry_slot,
    )
}

/// Inner function over individual fields. Backed by [`intent_binding_hash`] and reused directly
/// in unit-test vectors so tests can construct inputs without building a full
/// [`CriterionVerificationRequest`].
pub fn intent_binding_hash_from_parts(
    interface_version: u16,
    criterion_program: &[u8],   // 32 bytes
    intent_id: &[u8; 32],
    maker: &[u8],               // 32 bytes
    receiver: &[u8],            // 32 bytes
    refund_recipient: &[u8],    // 32 bytes
    asset: &EscrowAsset,
    amount: u64,
    expiry_slot: u64,
) -> [u8; 32] {
    // Worst-case capacity: domain(22) + version(2) + 5×pubkey(160) + asset_spl(65) + u64×2(16) = 265
    let mut data = Vec::with_capacity(280);
    data.extend_from_slice(INTENT_BINDING_DOMAIN);
    data.extend_from_slice(&interface_version.to_be_bytes());
    data.extend_from_slice(criterion_program);
    data.extend_from_slice(intent_id);
    data.extend_from_slice(maker);
    data.extend_from_slice(receiver);
    data.extend_from_slice(refund_recipient);
    encode_asset_canonical(asset, &mut data);
    data.extend_from_slice(&amount.to_be_bytes());
    data.extend_from_slice(&expiry_slot.to_be_bytes());
    hash(&data).to_bytes()
}

/// Canonical asset encoding: NativeSol = `[0]`; SplToken = `[1] ‖ mint ‖ token_program`.
/// The `vault` is excluded — it is a deterministic ATA of the intent PDA + mint, adding no binding.
fn encode_asset_canonical(asset: &EscrowAsset, out: &mut Vec<u8>) {
    match asset {
        EscrowAsset::NativeSol => out.push(0u8),
        EscrowAsset::SplToken {
            mint,
            token_program,
            ..
        } => {
            out.push(1u8);
            out.extend_from_slice(mint.as_ref());
            out.extend_from_slice(token_program.as_ref());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::prelude::Pubkey;

    // ---------------------------------------------------------------------------
    // Shared test fixtures
    // ---------------------------------------------------------------------------

    fn sol_args() -> (u16, Pubkey, [u8; 32], Pubkey, Pubkey, Pubkey, EscrowAsset, u64, u64) {
        let criterion_program = Pubkey::new_from_array([0x01; 32]);
        let intent_id = [0x02u8; 32];
        let maker = Pubkey::new_from_array([0x03; 32]);
        let receiver = Pubkey::new_from_array([0x04; 32]);
        let refund_recipient = Pubkey::new_from_array([0x05; 32]);
        let asset = EscrowAsset::NativeSol;
        let amount: u64 = 1_000_000_000;
        let expiry_slot: u64 = 500_000;
        (2u16, criterion_program, intent_id, maker, receiver, refund_recipient, asset, amount, expiry_slot)
    }

    fn spl_args() -> (u16, Pubkey, [u8; 32], Pubkey, Pubkey, Pubkey, EscrowAsset, u64, u64) {
        let criterion_program = Pubkey::new_from_array([0x01; 32]);
        let intent_id = [0x02u8; 32];
        let maker = Pubkey::new_from_array([0x03; 32]);
        let receiver = Pubkey::new_from_array([0x04; 32]);
        let refund_recipient = Pubkey::new_from_array([0x05; 32]);
        let mint = Pubkey::new_from_array([0xaa; 32]);
        let token_program = Pubkey::new_from_array([0xbb; 32]);
        let vault = Pubkey::new_from_array([0xcc; 32]);
        let asset = EscrowAsset::SplToken { mint, token_program, vault };
        let amount: u64 = 50_000_000;
        let expiry_slot: u64 = 750_000;
        (2u16, criterion_program, intent_id, maker, receiver, refund_recipient, asset, amount, expiry_slot)
    }

    // ---------------------------------------------------------------------------
    // Stability vectors (printed on first run, then locked in)
    // ---------------------------------------------------------------------------

    #[test]
    fn sol_stability_vector() {
        let (version, criterion_program, intent_id, maker, receiver, refund_recipient, asset, amount, expiry_slot) = sol_args();
        let got = intent_binding_hash_from_parts(
            version,
            criterion_program.as_ref(),
            &intent_id,
            maker.as_ref(),
            receiver.as_ref(),
            refund_recipient.as_ref(),
            &asset,
            amount,
            expiry_slot,
        );
        println!("SOL vector: {}", bytes_to_hex(&got));
        // Locked-in stability vector — if this changes the canonical byte layout has changed.
        const EXPECTED_SOL_HEX: &str = "e58282acb895cf6f1cfd851a63462465b9c9a8209c883feca9c6132891655051";
        let expected = hex_to_bytes(EXPECTED_SOL_HEX);
        assert_eq!(got, expected.as_slice(), "SOL binding hash changed — stability vector mismatch");
    }

    #[test]
    fn spl_stability_vector() {
        let (version, criterion_program, intent_id, maker, receiver, refund_recipient, asset, amount, expiry_slot) = spl_args();
        let got = intent_binding_hash_from_parts(
            version,
            criterion_program.as_ref(),
            &intent_id,
            maker.as_ref(),
            receiver.as_ref(),
            refund_recipient.as_ref(),
            &asset,
            amount,
            expiry_slot,
        );
        println!("SPL vector: {}", bytes_to_hex(&got));
        // Locked-in stability vector — if this changes the canonical byte layout has changed.
        const EXPECTED_SPL_HEX: &str = "44f9b4056fb98817cef04357a163d90c06538f6b9e542033b8d6e43bb5059dcd";
        let expected = hex_to_bytes(EXPECTED_SPL_HEX);
        assert_eq!(got, expected.as_slice(), "SPL binding hash changed — stability vector mismatch");
    }

    // ---------------------------------------------------------------------------
    // SOL != SPL
    // ---------------------------------------------------------------------------

    #[test]
    fn sol_and_spl_hashes_differ() {
        let (version, cp, iid, maker, recv, rr, sol_asset, amount, expiry) = sol_args();
        let (_, _, _, _, _, _, spl_asset, _, _) = spl_args();
        let sol_hash = intent_binding_hash_from_parts(
            version, cp.as_ref(), &iid, maker.as_ref(), recv.as_ref(), rr.as_ref(), &sol_asset, amount, expiry,
        );
        let spl_hash = intent_binding_hash_from_parts(
            version, cp.as_ref(), &iid, maker.as_ref(), recv.as_ref(), rr.as_ref(), &spl_asset, amount, expiry,
        );
        assert_ne!(sol_hash, spl_hash, "NativeSol and SplToken must hash differently");
    }

    // ---------------------------------------------------------------------------
    // Sensitivity: each field change produces a different hash
    // ---------------------------------------------------------------------------

    #[test]
    fn flip_interface_version_changes_hash() {
        let (version, cp, iid, maker, recv, rr, asset, amount, expiry) = sol_args();
        let h1 = intent_binding_hash_from_parts(version, cp.as_ref(), &iid, maker.as_ref(), recv.as_ref(), rr.as_ref(), &asset, amount, expiry);
        let h2 = intent_binding_hash_from_parts(version + 1, cp.as_ref(), &iid, maker.as_ref(), recv.as_ref(), rr.as_ref(), &asset, amount, expiry);
        assert_ne!(h1, h2);
    }

    #[test]
    fn flip_criterion_program_changes_hash() {
        let (version, cp, iid, maker, recv, rr, asset, amount, expiry) = sol_args();
        let cp2 = Pubkey::new_from_array([0xfe; 32]);
        let h1 = intent_binding_hash_from_parts(version, cp.as_ref(), &iid, maker.as_ref(), recv.as_ref(), rr.as_ref(), &asset, amount, expiry);
        let h2 = intent_binding_hash_from_parts(version, cp2.as_ref(), &iid, maker.as_ref(), recv.as_ref(), rr.as_ref(), &asset, amount, expiry);
        assert_ne!(h1, h2);
    }

    #[test]
    fn flip_intent_id_changes_hash() {
        let (version, cp, iid, maker, recv, rr, asset, amount, expiry) = sol_args();
        let mut iid2 = iid;
        iid2[0] ^= 0xff;
        let h1 = intent_binding_hash_from_parts(version, cp.as_ref(), &iid, maker.as_ref(), recv.as_ref(), rr.as_ref(), &asset, amount, expiry);
        let h2 = intent_binding_hash_from_parts(version, cp.as_ref(), &iid2, maker.as_ref(), recv.as_ref(), rr.as_ref(), &asset, amount, expiry);
        assert_ne!(h1, h2);
    }

    #[test]
    fn flip_maker_changes_hash() {
        let (version, cp, iid, maker, recv, rr, asset, amount, expiry) = sol_args();
        let maker2 = Pubkey::new_from_array([0xdd; 32]);
        let h1 = intent_binding_hash_from_parts(version, cp.as_ref(), &iid, maker.as_ref(), recv.as_ref(), rr.as_ref(), &asset, amount, expiry);
        let h2 = intent_binding_hash_from_parts(version, cp.as_ref(), &iid, maker2.as_ref(), recv.as_ref(), rr.as_ref(), &asset, amount, expiry);
        assert_ne!(h1, h2);
    }

    #[test]
    fn flip_receiver_changes_hash() {
        let (version, cp, iid, maker, recv, rr, asset, amount, expiry) = sol_args();
        let recv2 = Pubkey::new_from_array([0xee; 32]);
        let h1 = intent_binding_hash_from_parts(version, cp.as_ref(), &iid, maker.as_ref(), recv.as_ref(), rr.as_ref(), &asset, amount, expiry);
        let h2 = intent_binding_hash_from_parts(version, cp.as_ref(), &iid, maker.as_ref(), recv2.as_ref(), rr.as_ref(), &asset, amount, expiry);
        assert_ne!(h1, h2);
    }

    #[test]
    fn flip_refund_recipient_changes_hash() {
        let (version, cp, iid, maker, recv, rr, asset, amount, expiry) = sol_args();
        let rr2 = Pubkey::new_from_array([0xff; 32]);
        let h1 = intent_binding_hash_from_parts(version, cp.as_ref(), &iid, maker.as_ref(), recv.as_ref(), rr.as_ref(), &asset, amount, expiry);
        let h2 = intent_binding_hash_from_parts(version, cp.as_ref(), &iid, maker.as_ref(), recv.as_ref(), rr2.as_ref(), &asset, amount, expiry);
        assert_ne!(h1, h2);
    }

    #[test]
    fn flip_amount_changes_hash() {
        let (version, cp, iid, maker, recv, rr, asset, amount, expiry) = sol_args();
        let h1 = intent_binding_hash_from_parts(version, cp.as_ref(), &iid, maker.as_ref(), recv.as_ref(), rr.as_ref(), &asset, amount, expiry);
        let h2 = intent_binding_hash_from_parts(version, cp.as_ref(), &iid, maker.as_ref(), recv.as_ref(), rr.as_ref(), &asset, amount + 1, expiry);
        assert_ne!(h1, h2);
    }

    #[test]
    fn flip_expiry_slot_changes_hash() {
        let (version, cp, iid, maker, recv, rr, asset, amount, expiry) = sol_args();
        let h1 = intent_binding_hash_from_parts(version, cp.as_ref(), &iid, maker.as_ref(), recv.as_ref(), rr.as_ref(), &asset, amount, expiry);
        let h2 = intent_binding_hash_from_parts(version, cp.as_ref(), &iid, maker.as_ref(), recv.as_ref(), rr.as_ref(), &asset, amount, expiry + 1);
        assert_ne!(h1, h2);
    }

    // ---------------------------------------------------------------------------
    // intent_binding_hash (request entry point) round-trips through from_parts
    // ---------------------------------------------------------------------------

    #[test]
    fn request_entry_point_matches_from_parts() {
        use crate::CriterionVerificationRequest;

        let (version, cp, iid, maker, recv, rr, asset, amount, expiry) = sol_args();
        let req = CriterionVerificationRequest {
            interface_version: version,
            protocol_program: Pubkey::default(),
            intent: Pubkey::default(),
            intent_id: iid,
            maker,
            receiver: recv,
            refund_recipient: rr,
            asset: asset.clone(),
            amount,
            expiry_slot: expiry,
            created_slot: 9999,   // must be excluded
            criterion_program: cp,
            criterion_data_hash: [0u8; 32],
            fulfillment_data: vec![0xde, 0xad],
        };
        let via_request = intent_binding_hash(&req);
        let via_parts = intent_binding_hash_from_parts(
            version, cp.as_ref(), &iid, maker.as_ref(), recv.as_ref(), rr.as_ref(), &asset, amount, expiry,
        );
        assert_eq!(via_request, via_parts, "entry point must delegate to from_parts");
    }

    // ---------------------------------------------------------------------------
    // Helper
    // ---------------------------------------------------------------------------

    fn hex_to_bytes(s: &str) -> Vec<u8> {
        (0..s.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap())
            .collect()
    }

    fn bytes_to_hex(b: &[u8]) -> String {
        b.iter().map(|byte| format!("{:02x}", byte)).collect()
    }
}
