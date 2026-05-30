pub const INTENT_SEED: &[u8] = b"intent";

pub const CRITERION_INTERFACE_VERSION: u16 = 2;
pub const MAX_FULFILLMENT_DATA_LEN: usize = 1024;

// First 8 bytes of sha256("global:verify_criterion"). Criterion programs
// implement this instruction to opt into Laplace escrow settlement.
pub const VERIFY_CRITERION_DISCRIMINATOR: [u8; 8] =
    [0x8c, 0x7b, 0x8b, 0x85, 0x67, 0xd5, 0x72, 0xab];
