# Conditional Escrow Protocol

Laplace is a general conditional escrow protocol for Solana. A maker locks assets in an intent, and the escrow is released only when a configured criterion program accepts a fulfillment before expiry. If the criterion is not satisfied in time, the maker can refund the escrow.

Atomic Disclosure is one use case of this model. Cross-chain atomic swaps, signature approvals, hashlocks, and SP1-backed private computation are other use cases built from the same escrow lifecycle.

The core abstraction is:

```text
Intent = escrow + recipient + expiry + criterion program
```

## Goals

- Support multiple criteria without rewriting the escrow lifecycle.
- Let intents reference any external criterion program that implements the Laplace criterion interface.
- Keep escrow settlement atomic: either the criterion accepts and assets are released, or the maker refunds after expiry.
- Allow simple criteria, such as hash preimages, without requiring ZK.
- Allow complex criteria through SP1 proofs when private or cross-chain computation is needed.
- Bind every fulfillment payload to one exact intent to prevent replay across users, assets, chains, or programs.

## Recommended Stack

| Layer | Tool | Reason |
| --- | --- | --- |
| Solana program | Anchor | Account model, PDA escrow, SPL token integration |
| Escrow assets | SOL or SPL token vault PDA | Program-controlled settlement |
| Criterion interface | Solana CPI | Core escrow calls external criterion programs |
| Official criteria | Separate adapter programs | Hashlocks, signatures, SP1, and cross-chain proofs share one interface |
| Programmable criteria | SP1 | Arbitrary Rust guest logic for private or complex criteria |
| On-chain SP1 verifier | `sp1-solana` | Verifies SP1 Groth16-wrapped proofs through Solana BN254 syscalls |
| Off-chain data | Content commitments | Keeps Solana state small while preserving verifiability |

SP1 should be treated as a programmable criterion backend, not as a requirement for every intent.

## Current Implementation

The current workspace implements the core conditional escrow layer for SOL and SPL tokens, a stateless official hashlock criterion adapter, and an SP1-backed `validity` criterion adapter.

Implemented in `programs/laplace`:

- `Intent` account with maker, receiver, refund recipient, criterion program, asset, amount, expiry, criterion data hash, interface version, and lifecycle status.
- `create_intent`, which creates an intent PDA and locks SOL or SPL tokens depending on the asset.
- `fulfill_with_criterion`, which calls the configured external criterion program by CPI and releases SOL or SPL tokens if the CPI succeeds.
- `refund_expired_intent`, which refunds SOL or SPL tokens after expiry if the intent is still active.
- `close_intent`, which lets the maker close fulfilled or refunded intent accounts and recover rent, and closes SPL vault accounts.
- `CriterionVerificationRequest`, the canonical request payload forwarded to criterion programs.
- Interface constants for versioning, fulfillment data limit, and the `verify_criterion` discriminator.

Not implemented yet:

- Official criterion registry or SDK lookup table.
- Result accounts for large ciphertexts or off-chain data references.

Official criterion adapters that sit directly on Laplace should live in separate programs under `programs/` and implement the same `verify_criterion` interface.
The `programs/hashlock` adapter implements the universal intent-bound commitment: `criterion_data_hash = SHA256(intent_binding_hash(req) ‖ hash_fn_id ‖ SHA256(secret))`, where `intent_binding_hash` is the shared primitive from `programs/laplace/src/binding.rs` (domain `laplace-intent-bind-v1`). The adapter recomputes the commitment from the request's intent fields plus `SHA256(fulfillment_data)` and accepts only on an exact match. This binds every fulfillment to one exact intent while preserving atomic swaps — the shared secret unlocks each leg, because every leg recomputes the commitment with its own fields.
The current `programs/validity` adapter stores a `ValidityConfig` account that binds a user-defined SP1 guest ELF hash, the SP1 vkey hash from `vk.bytes32()`, and a `fixed_public_inputs` prefix of criterion-specific constants. The adapter mandatorily prepends the 32-byte `intent_binding_hash` before `fixed_public_inputs` when reconstructing the full public-input vector. The fulfiller supplies a Groth16 proof and a public-input suffix.
The encrypted-disclosure profile lives as a guest/helper crate under `guests/encrypted-disclosure` implementing a symmetric-key SHA256-derived XOR stream cipher; Laplace still invokes `validity`, and `validity` verifies the SP1 proof for that guest.
The `validity` e2e tests include a checked-in SP1 Fibonacci Groth16 proof fixture from `succinctlabs/sp1-solana`. This fixture is unbound (it predates the guest-authoring contract) and is used as a rejection test — the adapter must reject an unbound proof. A positive bound-proof test is deferred pending SP1 toolchain availability.

## Actors

- Maker: creates the intent and funds the escrow.
- Receiver: receives the escrowed assets if the criterion is fulfilled.
- Refund recipient: receives the escrowed assets after expiry if the intent is unfulfilled.
- Fulfiller: submits the fulfillment payload. This may be the receiver or a third party.
- Criterion program: external Solana program that validates a fulfillment payload.
- Solana program: owns the escrow lifecycle and performs final settlement.

For encrypted-disclosure criteria, users should use separate signing and encryption keys:

- Solana wallet keys are Ed25519 signing keys.
- For the reference implementation, encryption uses a symmetric decryption key with a SHA256-derived XOR stream cipher. The key commitment is published in criterion data.
- Dedicated public-key encryption (e.g. X25519 or HPKE) can be added as a future profile upgrade.

## High-Level Flow

1. Maker creates an intent.
2. Maker deposits SOL into the intent escrow account or SPL tokens into the vault account.
3. Intent records the common escrow fields, criterion program, asset, and criterion data hash.
4. A fulfiller submits arbitrary fulfillment bytes and any accounts required by the criterion program.
5. The core program forwards a canonical verification request to the configured criterion program by CPI.
6. If the criterion program returns success, the core program releases escrow to the receiver and marks the intent fulfilled.
7. If the intent expires before fulfillment, the refund recipient can reclaim the escrow.

## Intent Account

An intent should contain common settlement data and a commitment to criterion-specific configuration.

```rust
pub struct Intent {
    pub id: [u8; 32],
    pub maker: Pubkey,
    pub receiver: Pubkey,
    pub refund_recipient: Pubkey,
    pub criterion_program: Pubkey,
    pub asset: EscrowAsset,
    pub amount: u64,
    pub expiry_slot: u64,
    pub created_slot: u64,
    pub criterion_data_hash: [u8; 32],
    pub criterion_interface_version: u16,
    pub status: IntentStatus,
    pub bump: u8,
}
```

Useful instructions:

```text
create_intent
fulfill_with_criterion
refund_expired_intent
close_intent
```

The core stays small: it does not know whether the criterion is a hashlock, SP1 proof, signature approval, or cross-chain proof. It only calls the configured `criterion_program` through the standard interface.

## Criterion Program Interface

Every pluggable criterion program must expose a `verify_criterion` instruction. The core program calls it by CPI and releases escrow only if the CPI succeeds.

Current interface constants:

```rust
pub const CRITERION_INTERFACE_VERSION: u16 = 2;
pub const MAX_FULFILLMENT_DATA_LEN: usize = 1024;
```

Instruction discriminator:

```text
first_8_bytes(sha256("global:verify_criterion"))
```

Current discriminator bytes:

```rust
[0x8c, 0x7b, 0x8b, 0x85, 0x67, 0xd5, 0x72, 0xab]
```

Request payload:

```rust
pub struct CriterionVerificationRequest {
    pub interface_version: u16,
    pub protocol_program: Pubkey,
    pub intent: Pubkey,
    pub intent_id: [u8; 32],
    pub maker: Pubkey,
    pub receiver: Pubkey,
    pub refund_recipient: Pubkey,
    pub asset: EscrowAsset,
    pub amount: u64,
    pub expiry_slot: u64,
    pub created_slot: u64,
    pub criterion_program: Pubkey,
    pub criterion_data_hash: [u8; 32],
    pub fulfillment_data: Vec<u8>,
}
```

The criterion program should return success only if `fulfillment_data` and any remaining accounts satisfy the criterion committed by `criterion_data_hash`.

The request is serialized after the discriminator using Anchor/Borsh serialization. `fulfill_with_criterion` includes a `criterion_account_count` argument; only that prefix of `remaining_accounts` is forwarded to the criterion program, while any later accounts are reserved for asset settlement such as SPL token vault transfers. The current implementation rejects attempts to pass protected core accounts, including the intent account, receiver account, and SPL vault account, as criterion CPI accounts.

The criterion program must treat these request fields as part of the security boundary:

- `protocol_program`
- `intent`
- `intent_id`
- `maker`
- `receiver`
- `refund_recipient`
- `asset`
- `amount`
- `expiry_slot`
- `created_slot`
- `criterion_program`
- `criterion_data_hash`

This prevents a fulfillment accepted for one intent from being replayed against another.

## Official Criteria

Official criteria are standalone programs or adapters that implement `verify_criterion`.

| Criterion | Use Case | Fulfillment |
| --- | --- | --- |
| `Hashlock` | Atomic swaps, public preimage unlocks | Reveal `s` where `H(s) == h` |
| `Signature` | Manual approval, OTC settlement | Submit an authorized signature over the intent |
| `Sp1Proof` | Private or complex computation | Submit SP1 proof and public inputs |
| `EncryptedDisclosure` | Buying a hidden secret | Submit encrypted secret plus proof that plaintext satisfies criteria |
| `CrossChainLockProof` | ZK-assisted cross-chain intents | Prove a counterparty lock exists on another chain |
| `MultiCriterion` | Complex workflows | Require several criteria together |

The core program does not whitelist these by default. A maker explicitly chooses the criterion program address when creating an intent. Frontends and SDKs should maintain a curated registry of official criterion program IDs.

## Criterion Commitment

Each intent should commit to the complete criterion configuration.

```text
criterion_data_hash = H(
  domain_separator,
  criterion_program,
  version,
  maker,
  receiver,
  refund_recipient,
  asset,
  amount,
  expiry_slot,
  criterion_specific_config
)
```

For `Hashlock`:

```text
criterion_specific_config = {
  hash_function_id,
  hashlock: H(secret)
}
```

For `Signature`:

```text
criterion_specific_config = {
  signer,
  message_schema_hash
}
```

For `Sp1Proof`:

```text
criterion_specific_config = {
  sp1_vkey_hash,
  public_input_schema_hash,
  expected_output_hash
}
```

For `EncryptedDisclosure`:

```text
criterion_specific_config = {
  sp1_vkey_hash,
  criteria_hash,
  buyer_encryption_pubkey,
  encryption_scheme_id,
  ciphertext_commitment_policy
}
```

For `CrossChainLockProof`:

```text
criterion_specific_config = {
  source_chain_id,
  source_contract,
  source_asset,
  source_amount,
  source_receiver,
  hashlock,
  min_source_timeout,
  proof_system_or_light_client_id
}
```

## Fulfillment Rules

All fulfillment paths should check:

- Intent is active.
- Current slot is before or equal to the expiry slot.
- Submitted criterion program matches `intent.criterion_program`.
- Criterion program is executable.
- Fulfillment data is forwarded to the criterion program.
- Criterion program returns success.
- Settlement cannot be replayed against another intent.
- Escrow transfer succeeds.
- Intent status changes to fulfilled before returning.

State transitions should be one-way:

```text
Active -> Fulfilled
Active -> Refunded
Fulfilled -> Closed
Refunded -> Closed
```

## Universal Intent Binding

Every official criterion adapter derives its accept/reject decision from a single shared primitive: the `intent_binding_hash`. This prevents a fulfillment accepted for one intent from being replayed against any other intent — across different makers, assets, amounts, or expiry times.

### `intent_binding_hash`

```text
intent_binding_hash = SHA256(
  "laplace-intent-bind-v1"          // INTENT_BINDING_DOMAIN
  ‖ u16be(interface_version)
  ‖ criterion_program   (32 bytes)
  ‖ intent_id           (32 bytes)
  ‖ maker               (32 bytes)
  ‖ receiver            (32 bytes)
  ‖ refund_recipient    (32 bytes)
  ‖ asset_canonical
  ‖ u64be(amount)
  ‖ u64be(expiry_slot)
)
```

`asset_canonical` encoding: `[0x00]` for NativeSol; `[0x01] ‖ mint ‖ token_program` for SplToken. The SPL vault is excluded because it is a deterministic ATA of the intent PDA — it adds no additional binding.

All integers are big-endian.

**Excluded fields:** `created_slot` (unknown to the maker at commit time), the intent PDA address (same reason), `fulfillment_data` (the criterion-specific payload), `criterion_data_hash`, and `protocol_program`. Binding `criterion_program` prevents pointing a commitment at a different criterion adapter. Binding `protocol_program` is noted as optional future hardening, out of scope in the current version.

**Defined in:** `programs/laplace/src/binding.rs` (`INTENT_BINDING_DOMAIN`, `intent_binding_hash`). Mirrored byte-for-byte in the TypeScript SDK as `intentBindingHash(ctx)`.

### Adapter enforcement

Both official adapters (`hashlock`, `validity`) enforce the binding at the adapter level — it is not optional. Custom criterion programs can call `laplace::binding::intent_binding_hash` from the same crate; conformant custom criteria are expected to bind on this value, though the core cannot introspect a CPI'd program to enforce it.

## Hashlock Criterion

The hashlock criterion is the simplest settlement condition.

```text
Release escrow if H(preimage) == hashlock.
```

This does not require ZK because the preimage is intentionally revealed.

Use cases:

- Cross-chain atomic swaps.
- Public commitment unlocks.
- Simple puzzle-based settlement.

The fulfillment payload is:

```text
preimage
```

The adapter computes the commitment as:

```text
criterion_data_hash = SHA256( intent_binding_hash ‖ hash_fn_id ‖ SHA256(secret) )
```

where `intent_binding_hash` is the universal primitive defined above (domain `laplace-intent-bind-v1`), and `hash_fn_id` is a one-byte identifier for the hash function used (0 = SHA256, reserved for future preimage-hash agility). The adapter recomputes this value from the request's intent fields plus `SHA256(fulfillment_data)` and accepts only on an exact match.

This binds every fulfillment to one exact intent. Atomic swaps still work because the shared secret unlocks each leg — every leg recomputes the commitment with its own fields, so cross-leg replay is also prevented.

## Cross-Chain Atomic Swap

A basic cross-chain token swap can be implemented as two hashlock escrows on different chains.

Actors:

```text
Alice has token A on Chain A.
Bob has token B on Chain B.
Alice wants token B.
Bob wants token A.
```

Flow:

1. Alice samples `s = random_32_bytes()` and publishes `h = H(s)`.
2. Alice locks token A on Chain A for Bob with hashlock `h` and timeout `T_A`.
3. Bob verifies Alice's Chain A lock.
4. Bob locks token B on Chain B for Alice with hashlock `h` and timeout `T_B`.
5. Alice claims token B on Chain B by revealing `s`.
6. Bob observes `s` on Chain B and claims token A on Chain A.

Timeout rule:

```text
T_A > T_B + finality_margin + relay_margin
```

This gives Bob enough time to use the revealed preimage on Chain A after Alice claims on Chain B.

ZK is not required for this basic swap. A ZK proof can be useful only for proving cross-chain facts, such as finality or inclusion of the counterparty lock, without trusting an oracle.

## SP1 Validity Criterion

The `validity` criterion lets an intent settle based on arbitrary SP1 guest logic.

On-chain, the adapter verifies:

```text
proof is valid under expected sp1_vkey_hash
criterion_data_hash == hash(validity_config)
public_inputs = intent_binding_hash(req) ‖ fixed_public_inputs ‖ suffix
```

The adapter mandatorily prepends the 32-byte `intent_binding_hash` before the config's `fixed_public_inputs` and the fulfiller's suffix. This means the full public-input vector seen by `sp1-solana::verify_proof` is:

```text
public_inputs = intent_binding_hash   (32 bytes, adapter-injected)
              ‖ fixed_public_inputs   (from ValidityConfig, criterion-specific constants)
              ‖ public_inputs_suffix  (from ValidityFulfillment, fulfiller-supplied)
```

`criterion_data_hash` stays `= config_hash`. Configs remain reusable across intents; the config PDA seed (`[VALIDITY_SEED, criterion_data_hash]`) and the `config.config_hash == request.criterion_data_hash` check are unchanged. Per-intent binding now comes from the adapter-injected prefix: a proof for intent A no longer verifies for intent B because the two intents have different `intent_id` values and therefore different `intent_binding_hash` values.

The SP1 vkey hash is derived from the user-defined guest ELF off-chain:

```text
let (pk, vk) = client.setup(ELF);
let sp1_vkey_hash = vk.bytes32();
```

The `validity` config stores both:

```text
guest_elf_hash
sp1_vkey_hash
```

The `sp1_vkey_hash` is what `sp1-solana::verify_proof` uses cryptographically. The `guest_elf_hash` is still committed for auditability and user intent, so the maker can identify the exact guest ELF they intended.

The fulfillment payload is:

```rust
pub struct ValidityFulfillment {
    pub proof: Vec<u8>,
    pub public_inputs_suffix: Vec<u8>,
}
```

The fulfiller submits only proof + suffix. The adapter builds the binding prefix; the fulfiller never needs to construct it. This wire format is unchanged from the pre-binding adapter.

For Solana verification, SP1 should use Groth16 proofs. `sp1-solana` verifies with:

```rust
verify_proof(proof, public_inputs, sp1_vkey_hash, GROTH16_VK_5_0_0_BYTES)
```

SP1 Groth16 proofs are roughly 260 bytes. Verification requires a raised compute budget, around 270k-280k CU.

### Guest-authoring contract

**The SP1 guest MUST commit the 32-byte `intent_binding_hash` as its leading public input**, followed by its own criterion-specific fixed values, and then any per-fulfillment suffix values:

```text
committed public inputs = intent_binding_hash (32 bytes, leading)
                        ‖ criterion-fixed values
                        ‖ per-fulfillment suffix values
```

`fixed_public_inputs` in `ValidityConfig` carries only criterion-specific constants. It MUST NOT carry intent-identity fields (maker, receiver, intent ID, asset, amount, expiry) — the adapter injects those via the binding prefix. Guests that include intent fields in `fixed_public_inputs` will fail verification because the adapter prepends the binding tag ahead of `fixed_public_inputs`, shifting all offsets.

The `criterion_data_hash = config_hash` relationship is unchanged; `config_hash` does not commit to per-intent values and that is intentional — the adapter-injected prefix provides per-intent binding.

## Encrypted Disclosure Criterion

Encrypted Disclosure is the secret-sale version of conditional escrow.

Example:

```text
Alice locks assets in an intent.
Bob receives the assets only if he publishes an encrypted secret and an SP1 proof that the plaintext secret satisfies Alice's criteria.
Alice decrypts the published ciphertext locally after settlement.
```

The SP1 guest must prove more than just:

```text
criteria(secret) == true
```

It must also prove that the submitted ciphertext is bound to that same secret:

```text
criteria(secret) == true
ciphertext_hash == hash(encrypt(secret, buyer_encryption_pubkey, encryption_randomness))
intent fields are included in the public inputs
```

Private inputs:

```text
secret
optional_file_key
optional_file_metadata
```

Public inputs:

```text
domain_separator
program_id
intent_id
criterion_data_hash
buyer_wallet_pubkey
buyer_encryption_pubkey
seller_wallet_pubkey
criteria_hash
sp1_vkey_hash
ciphertext_hash
optional_file_commitment
```

The exact encryption algorithm matters. Prefer a deterministic proof-friendly construction for the part proven in SP1, or prove a hash of a reproducible encryption transcript. If using standard hybrid encryption, define the transcript precisely so the seller cannot prove one plaintext and publish unrelated ciphertext.

## Large File Disclosure

Large files should not be stored on-chain.

Use the disclosed secret as a decryption key for an encrypted file stored off-chain.

Suggested flow:

1. Seller encrypts the file off-chain.
2. Seller uploads the encrypted file to Arweave, IPFS, Filecoin, or another storage layer.
3. Seller commits to the encrypted file hash and, when needed, a plaintext file hash or Merkle root.
4. The SP1 guest proves that the secret decrypts or authenticates the committed file according to the buyer's criteria.
5. The Solana program verifies only the final SP1 proof and stores the content reference or commitment.

Avoid relying on random spot checks unless the challenge is generated after the seller commits to the file. Spot checks are probabilistic. For strong integrity, prove a full hash, Merkle root, or authenticated encryption tag over the relevant content.

## Asset Escrow

For SOL escrow:

- Maker transfers lamports into the intent PDA account.
- On valid fulfillment, the program transfers lamports to the receiver.
- On expiry, the refund recipient can reclaim funds.
- After fulfillment or refund, the maker can close the intent account and reclaim rent.

For SPL token escrow:

- Create an initialized vault token account whose authority is the intent PDA.
- Maker deposits the agreed token amount through `create_intent`.
- The program signs with PDA seeds to transfer to the receiver on fulfillment.
- The refund recipient can refund after expiry if the intent remains unfulfilled.
- After fulfillment or refund, `close_intent` closes the empty vault token account.

## Security Requirements

- Every fulfillment must bind to a specific intent ID and domain separator.
- Criterion data hashes must be computed over canonical encodings.
- The program must reject fulfillment attempts whose criterion program does not match `intent.criterion_program`.
- ZK public inputs must include the intent ID, program ID, criterion data hash, asset, amount, parties, and expiry.
- Signatures must cover the intent ID and domain separator.
- Hashlock secrets must be high entropy if secrecy before reveal matters.
- Encrypted-disclosure proofs must bind plaintext, ciphertext, encryption metadata, and intent data.
- Cross-chain swaps still need timeout and finality margins.
- Transaction size is limited. Large public inputs or ciphertexts need account storage, chunking, compression, or off-chain references.
- `sp1-solana` depends on Groth16-wrapped SP1 proofs and Solana BN254 syscalls; compute budget must be raised for verification.
- `validity` currently uses `GROTH16_VK_5_0_0_BYTES`; supporting multiple SP1 circuit versions should be explicit in future config versions.
- Production deployments require cryptographic review and program audit.

## Open Design Questions

- Which official criterion programs should be included in the MVP?
- Should criterion-specific config be stored directly in the intent account or only committed by hash?
- Should ciphertext live directly in an account, in transaction data, or off-chain behind a commitment?
- Should SP1 criteria be one reusable guest program or many criteria-specific guests?
- Which encryption scheme should be standardized for encrypted disclosure?
- How should users publish and rotate encryption keys?
- Should cross-chain criteria use ZK proofs, light clients, relayers, or manual verification first?
- What file storage layer should be used for large-file disclosures?

## Minimal MVP

The current implementation covers the core MVP spine:

- SOL and SPL token escrow.
- Pluggable criterion CPI interface.
- Stateless official hashlock criterion adapter.
- SP1-backed `validity` criterion adapter with config hashing and public-input prefix/suffix binding.
- Expiry-based refund.
- Rent recovery through `close_intent`.

The next MVP layer should add additional criterion adapters:

- Encrypted-disclosure criterion for small secrets.
- Ciphertext hash stored on-chain.
- Ciphertext submitted in the fulfillment transaction or stored in a result account.
- No large-file support until the small-secret path is complete.

After the MVP works, add large-file commitments, cross-chain criterion helpers, reusable criteria registries, and better off-chain indexing.
