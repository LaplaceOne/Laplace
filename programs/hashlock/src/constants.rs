pub const HASHLOCK_CRITERION_NAME: &str = "hashlock-sha256";

/// Identifies the preimage hash function used for the hashlock (`H(secret)`). 0 = SHA-256.
/// Reserved for future preimage-hash agility (e.g. SHA-3, BLAKE3).
pub const HASH_FUNCTION_ID_SHA256: u8 = 0;
