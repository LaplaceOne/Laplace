pub const HASHLOCK_CRITERION_NAME: &str = "hashlock-sha256";

/// Domain separator for the intent-bound hashlock commitment (see docs/conditional-escrow.md
/// "Criterion Commitment"). Bumping this is a breaking change to how criterion_data_hash is computed.
pub const HASHLOCK_COMMITMENT_DOMAIN: &[u8] = b"laplace-hashlock-commit-v1";

/// Identifies the preimage hash function used for the hashlock (`H(secret)`). 0 = SHA-256.
pub const HASH_FUNCTION_ID_SHA256: u8 = 0;
