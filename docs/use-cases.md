# Laplace — Use Cases

Concrete scenarios the protocol enables, organized by the derived products
(Bridge, Disclosure) and future DeFi/investor verticals. Each maps back to the
same escrow lifecycle: `create_intent → fulfill_with_criterion | refund_expired_intent → close_intent`.

## 1. Laplace Bridge — cross-chain atomic swap (hashlock)

**Scenario.** Alice holds token A on Chain A, Bob holds token B on Chain B. Both
chains run Laplace (or a compatible HTLC escrow) and operate relayer nodes.

**Flow.**
1. Alice samples `s = random_32_bytes()`, publishes `h = SHA256(s)`.
2. Alice creates a Laplace intent on Chain A: escrow token A, receiver = Bob,
   criterion = hashlock with `criterion_data_hash = h`, expiry `T_A`.
3. Bob verifies Alice's lock, then creates a mirror intent on Chain B: escrow
   token B, receiver = Alice, hashlock `h`, expiry `T_B`.
4. Alice fulfills on Chain B by revealing `s` → receives token B.
5. Bob observes `s` on Chain B and fulfills on Chain A → receives token A.

**Safety rule.** `T_A > T_B + finality_margin + relay_margin` so Bob can always
claim on Chain A after Alice reveals on Chain B. If a side stalls, the
`refund_expired_intent` path returns funds after expiry.

**What the product adds over raw protocol.** Counterparty/offer discovery,
relayer nodes to observe + propagate the revealed `s`, timeout/finality guidance,
and a guided two-leg UI. ZK is optional and only needed to prove cross-chain
facts (e.g. inclusion/finality) without trusting a relayer.

**Trust notes.** Relayers are liveness helpers, not custodians — safety rests on
the hashlock + asymmetric timeouts. Revealing `s` is public by design.

## 2. Laplace Disclosure — buy a verifiable secret (validity / encrypted disclosure)

**Scenario.** A seller will be paid only after publishing an encrypted secret and
a proof that the plaintext satisfies the buyer's criteria and is bound to that
ciphertext.

**Flow.**
1. Buyer (maker) creates an intent escrowing payment, criterion = validity bound
   to a `ValidityConfig` whose guest proves:
   `criteria(secret) == true ∧ ciphertext_hash == hash(encrypt(secret, buyer_pubkey, r))`
   with intent fields in the public inputs.
2. Seller (fulfiller) produces the SP1 Groth16 proof + public-input suffix and the
   ciphertext, submits `fulfill_with_criterion` (validity config passed as the
   single criterion account).
3. On valid proof, escrow releases to the seller; the ciphertext (or its hash +
   off-chain pointer) is recorded.
4. Buyer decrypts locally with their key.

**Encryption keys are separate from wallet keys** (Ed25519 signing ≠ encryption).
The reference profile uses a SHA256-derived XOR stream cipher with a published key
commitment; X25519/HPKE is a future profile.

**Large files.** Don't store on-chain. Encrypt off-chain (Arweave/IPFS/Filecoin),
commit the encrypted-file hash (and a plaintext hash/Merkle root when needed), and
have the guest prove the secret authenticates the committed file. Avoid
probabilistic spot checks; prove a full hash/Merkle root/AEAD tag.

**MVP cut.** Small secrets only, ciphertext hash on-chain, ciphertext in the
fulfillment tx or a result account. Large-file support comes after.

## 3. Main-site / power-user primitives

Built directly on the console with hashlock or validity, no spin-off product:

- **Public unlock / puzzle settlement** — pay a fixed receiver when any party
  reveals a committed secret (hashlock).
- **Proof-gated payout** — release funds only when someone submits a valid SP1
  proof of an arbitrary computation (validity), e.g. "prove you ran this model /
  solved this instance."
- **Time-boxed conditional escrow** — any of the above with automatic refund on
  expiry; rent reclaimed via `close_intent`.

## 4. Future DeFi / investor verticals

These are directional, dependent on future criteria (signature, multi-criterion,
cross-chain proof) and possibly an on-chain registry:

- **Conditional OTC settlement** — large trades that settle only when an agreed,
  verifiable condition holds (signature or proof), with refund fallback. Removes
  counterparty custody risk for OTC desks.
- **Escrowed options / structured payouts** — payout gated by a proof of a
  reference value or event; expiry = option expiry; refund = unexercised.
- **Proof-gated grants / bounties** — funds released when a claimant proves they
  met objective criteria (validity), reducing manual adjudication.
- **Cross-chain liquidity routing** — Bridge generalized to multi-hop atomic
  swaps with asymmetric timeouts; ZK attestations for trust-minimized relaying.
- **Compliance-gated disbursement** — release only on a proof of an off-chain
  attestation (KYC/AML, audit), without revealing underlying data on-chain.

Each vertical is a *criterion + a front-end*, never a fork of the escrow core.

## 5. Why the model generalizes

Every use case above reuses the identical lifecycle and the identical
`verify_criterion` CPI boundary. The differences are entirely in:

1. the criterion program (what "satisfied" means),
2. the commitment (`criterion_data_hash`), and
3. the fulfillment payload + criterion accounts.

That separation is what lets Laplace grow by adding criteria and faces rather than
rebuilding settlement — the basis for the product family in
`product-vision.md`.
