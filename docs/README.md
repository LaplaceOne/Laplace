# Laplace Documentation

Laplace is a Solana protocol for intent-based atomic settlement: a maker locks
assets in an escrow that releases to a recipient only when a pluggable on-chain
criterion (a revealed secret, a ZK validity proof, a cross-chain lock) is
provably satisfied before expiry — otherwise the maker is refunded.

This folder holds the protocol design and the product/frontend design for the
Laplace app family (main site + derived products).

## Documents

| Doc | Purpose | Primary audience |
| --- | --- | --- |
| [conditional-escrow.md](./conditional-escrow.md) | Protocol design: escrow lifecycle, criterion interface, official criteria, security model | protocol / on-chain devs |
| [product-vision.md](./product-vision.md) | Protocol-as-platform thesis, the app family, audiences, positioning, roadmap, known gaps | everyone |
| [frontend-architecture.md](./frontend-architecture.md) | Monorepo layout, pinned stack, shared SDK / registry / UI, wallet, indexing, share links | frontend devs |
| [main-site-spec.md](./main-site-spec.md) | Main site: landing IA + protocol console feature spec (create / track / fulfill / refund / close, manual ops, criterion config) | product / frontend devs |
| [criteria-registry.md](./criteria-registry.md) | Criterion model, the `verify_criterion` interface, official criteria specifics, **canonical registry schema + program IDs** | devs / integrators |
| [use-cases.md](./use-cases.md) | Bridge, Disclosure, power-user primitives, future DeFi/investor verticals | BD / product / investors |

## Suggested reading order

1. **product-vision.md** — what Laplace is and why the platform fans out into many products.
2. **conditional-escrow.md** — the on-chain protocol the products build on.
3. **frontend-architecture.md** — how the app family and shared layers are structured.
4. **criteria-registry.md** — the criterion model and the registry that ties UIs to programs.
5. **main-site-spec.md** — the concrete first product surface.
6. **use-cases.md** — where it goes next.

## Canonical sources (avoid duplication drift)

- **Registry schema + program IDs:** `criteria-registry.md` (§4–§5). Other docs
  reference it; do not re-copy the full schema or address table.
- **Pinned library versions / stack:** `frontend-architecture.md` (§0).
- **Intent lifecycle & state machine:** `conditional-escrow.md`; the UI
  projection lives in `frontend-architecture.md` (§9).
- **On-chain truth:** the programs in `../programs/` and generated
  `../target/idl/*.json` override any prose here if they disagree.

## Shared conventions used across the docs

- **Scope now:** devnet; assets SOL + SPL (stablecoins first-class); official
  criteria **hashlock** (stateless, `criterion_account_count = 0`) and
  **validity** (stateful `ValidityConfig`, `criterion_account_count = 1`).
- **Slots are the source of truth;** wall-clock time is display-only.
- **The lifecycle is the product:** `create_intent → fulfill_with_criterion |
  refund_expired_intent → close_intent`.
- **Secrets never travel in URLs;** revealing a hashlock preimage on-chain is
  public and irreversible.
- **Frontend does not** deploy programs/guests, generate SP1 proofs, or run an
  on-chain registry/indexer (all out of scope for the MVP).

## Open action items

- ✅ **Done.** `laplace`, `hashlock`, `validity` are deployed to **devnet** at the
  addresses already in `@laplace-one/registry` (`cluster: "devnet"`). The program keypair
  fixes the address, so localnet / devnet / mainnet-beta share the same IDs — no
  per-cluster placeholder swap was needed.
- Decide validity proof generation strategy (hosted prover vs client WASM) —
  deferred; not needed for the hashlock-first slice.
