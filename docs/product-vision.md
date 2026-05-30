# Laplace — Product Vision

## One sentence

Laplace is a Solana protocol for intent-based atomic settlement: a maker locks
assets in an escrow that releases to a recipient only when a pluggable on-chain
criterion (a revealed secret, a ZK validity proof, a cross-chain lock) is
provably satisfied before expiry — otherwise the maker is refunded.

## What Laplace actually is

Laplace is **not a single app**. It is a protocol with a small, auditable core
and a pluggable criterion interface, plus a **family of front-ends** built on a
shared SDK. The core escrow lifecycle never changes; each *criterion* defines
what "the condition was met" means, and each criterion can be packaged into a
focused, easy-to-use product.

```
                Laplace Protocol  (laplace core + criterion programs)
                            │
                shared SDK + criterion registry + design system
                            │
   ┌────────────────────────┼─────────────────────────────┐
   ▼                         ▼                             ▼
 Main Site               Laplace Bridge              Laplace Disclosure        … future verticals
 (landing + dev portal   (cross-chain atomic swap    (encrypted secret sale     (DeFi / investor
  + protocol console)     via hashlock + relayers)    via validity / SP1)        use cases)
```

The protocol stays general; the products stay narrow. The main site is the hub
that exposes *all* criteria for developers and power users; each spin-off site
hides the protocol behind one polished use case for end users.

## Core abstraction

```
Intent = escrow + recipient + refund recipient + expiry + criterion program + criterion commitment
```

The on-chain core (`programs/laplace`) owns only the escrow lifecycle:

```
create_intent → Active ──fulfill_with_criterion──▶ Fulfilled ──close_intent──▶ (rent reclaimed)
                  │
                  └────────refund_expired_intent──▶ Refunded ──close_intent──▶ (rent reclaimed)
```

It does not know whether a criterion is a hashlock, a ZK proof, or a cross-chain
attestation. It forwards a canonical `CriterionVerificationRequest` to the
configured `criterion_program` by CPI and releases funds only if that CPI
succeeds. This is what lets one protocol fan out into many products.

## Official criteria (shipping)

| Criterion | Program | Statefulness | Fulfillment | Powers |
| --- | --- | --- | --- | --- |
| **Hashlock** | `hashlock` | Stateless | Reveal preimage `s` where `SHA256(s) == criterion_data_hash` | Atomic swaps, Laplace Bridge, public unlocks |
| **Validity (SP1)** | `validity` | Stateful (`ValidityConfig`) | Groth16 proof + public-input suffix verified against a committed `sp1_vkey_hash` | Private/complex settlement, Laplace Disclosure, custom DeFi conditions |

Future official criteria named in the protocol design: `Signature`,
`EncryptedDisclosure`, `CrossChainLockProof`, `MultiCriterion`.

## Products

### Main Site (the Laplace hub)
The protocol's home: marketing landing, developer documentation, the criterion
catalog, and a **general protocol console** for power users and integrators.
Audiences, in priority order: **developers / integrators** and **protocol power
users**. It supports SOL and SPL escrow (stablecoins are a first-class asset),
both official criteria, intent creation/tracking/fulfillment/refund/close,
manual per-instruction operations, and criterion *configuration & registration*
(e.g. creating `ValidityConfig` accounts, computing hashlocks, curating the
registry). It does **not** compile or deploy new programs.

### Laplace Bridge
A cross-chain atomic swap product. Two chains that both run Laplace (or a
compatible HTLC escrow) and operate relayer nodes can swap tokens using a shared
hashlock and asymmetric timeouts. The protocol's hashlock criterion is the
on-chain primitive; the product adds counterparty discovery, relaying, and
timeout/finality safety rails.

### Laplace Disclosure
A "buy a verifiable secret" product built on the validity / encrypted-disclosure
criterion. A seller is paid only after publishing an encrypted secret plus an
SP1 proof that the plaintext satisfies the buyer's criteria and is bound to the
published ciphertext. Targets data sales, key escrow, and bounty-style
disclosures.

## Audiences

- **Developers / integrators (B2B):** consume the SDK + registry, configure
  criteria, embed intent flows. Primary audience for the main site.
- **Protocol power users:** create and manage intents directly, run manual
  operations, fulfill/refund.
- **End users:** arrive through a focused product (Bridge, Disclosure) and never
  see protocol jargon.
- **DeFi / investors (future):** conditional OTC settlement, escrowed options,
  proof-gated payouts, and cross-chain liquidity routing.

## Positioning principles

1. **The lifecycle is the product.** Laplace is an order/offer with verifiable
   settlement, not a "swap now" button. Every UI is a projection of the intent
   state machine.
2. **Collapse the abstraction.** Normal users never see "criterion interface
   v2." Each product exposes one concrete recipe.
3. **One protocol, many faces.** New use cases become new criteria + new
   front-ends, never forks of the escrow core.
4. **Honest about trust.** Where a step is centralized (relayers, hosted
   provers) or irreversible (revealing a secret on-chain), the product says so.
5. **Devnet first.** All products target devnet initially; the registry carries
   per-cluster program addresses so mainnet is a config change, not a rewrite.

## Roadmap shape

1. **Foundation (now):** monorepo, shared SDK + registry + design system,
   devnet program deployment, main-site general dashboard for SOL + SPL with
   hashlock and validity.
2. **Bridge MVP:** single token pair, hashlock HTLC across two chains, manual
   then relayed.
3. **Disclosure MVP:** small-secret encrypted disclosure with on-chain
   ciphertext hash.
4. **DeFi / investor verticals:** proof-gated settlement products and an
   on-chain criterion registry / governance layer.

## Known gaps that shape the products

- **No on-chain criterion registry program yet.** "Criterion management" ships
  as a *curated off-chain registry* (program IDs + metadata) in the SDK; an
  on-chain registry is future work.
- **Criterion authoring is not a website feature.** Creating a genuinely new
  criterion means deploying an on-chain program (and, for validity, authoring an
  SP1 guest + verifying key). The products *configure and register* existing
  criteria; authoring stays in CLI/SDK territory.
- **Hashlock is not intent-bound in the current adapter.** It checks only
  `SHA256(preimage) == criterion_data_hash`, so secrets must be unique and
  high-entropy. Products must generate secrets client-side and surface this.
- **Indexing is client-side for now** (`getProgramAccounts` + `memcmp`); a
  dedicated indexer is a later optimization behind the same SDK interface.
