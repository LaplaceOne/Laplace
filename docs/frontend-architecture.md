# Laplace — Frontend Architecture

Scope: the front-end family (main site, Bridge, Disclosure) and the shared layers
they sit on. Targets **devnet** first. Asset support: **SOL + SPL** (stablecoins
are first-class). Builds on the existing Anchor workspace; does not change the
on-chain core.

## 0. Pinned stack (latest, aligned with on-chain Anchor v1)

The on-chain programs are **Anchor v1.0.2** (`@anchor-lang/core`). The frontend
therefore uses the modern Anchor v1 TS client on top of **`@solana/kit`** (the
successor to `web3.js` v1), and the **Wallet Standard** wallet layer — not the
legacy `@coral-xyz/anchor` + `@solana/web3.js@1` + `@solana/wallet-adapter-react`
path.

| Concern | Library | Version (latest verified) |
| --- | --- | --- |
| Framework | `next` + `react` | 16.x / 19.x |
| Styling | `tailwindcss` | 4.x |
| Monorepo | `turbo` | 2.9.x |
| Language | `typescript` | 5.7+ |
| Anchor TS client | `@anchor-lang/core` | 1.0.2 (matches on-chain) |
| RPC / primitives | `@solana/kit` | 6.x |
| SPL token client | `@solana-program/token` | 0.13.x |
| Wallet hooks | `@solana/react` + `@wallet-standard/react` | 6.x / 1.x |

`gill` (kit-based helper toolkit) is an option for ergonomic RPC/tx helpers if we
want less boilerplate than raw `@solana/kit`. Versions are pinned in the registry
and root workspace; bump deliberately, not implicitly.

## 1. Goals

- One protocol, many front-ends, **maximum shared code**.
- A single typed SDK is the only thing that talks to the chain. UIs never hand-build
  instructions.
- A criterion registry decouples "which programs exist on which cluster" from app code.
- Each app can later get its own domain/deployment without restructuring.

## 2. Repo topology — Turborepo monorepo

The Anchor workspace stays at the repo root. The web monorepo lives under `app/`
(currently empty), keeping Anchor's conventional frontend location.

```
Laplace/                         # existing Anchor workspace (unchanged)
  programs/                      # laplace, hashlock, validity (on-chain)
  guests/ tools/ migrations/
  target/idl/*.json              # source of truth for SDK types
  docs/
  app/                           # ← Turborepo root (npm workspaces, matches Anchor.toml)
    turbo.json
    package.json
    apps/
      main/                      # Next.js (App Router) — landing + dev portal + console
      bridge/                    # Next.js — Laplace Bridge
      disclosure/                # Next.js — Laplace Disclosure
    packages/
      sdk/                       # @laplace/sdk   — Anchor v1 + kit clients, PDA derivation, flows
      registry/                  # @laplace/registry — criterion + per-cluster program metadata
      ui/                        # @laplace/ui    — design system, shared React components
      wallet/                    # @laplace/wallet — Wallet Standard provider + cluster context
      config/                    # shared tsconfig / eslint / tailwind presets
```

Package manager: **npm workspaces** (Anchor.toml sets `package_manager = "npm"`).
Turborepo orchestrates `build` / `lint` / `typecheck` / `dev` across packages.

### Dependency direction
```
apps/*  ─▶  @laplace/ui ─▶ @laplace/sdk ─▶ @laplace/registry
         └▶ @laplace/wallet ─┘                 ▲
target/idl/*.json ───────────────────────────┘ (codegen input to sdk)
```
Apps never import `@solana/kit` or build instructions directly; they import
hooks/functions from `@laplace/sdk`.

## 3. `@laplace/sdk` — the only chain interface

Generated from the Anchor IDLs (`target/idl/laplace.json`, `hashlock.json`,
`validity.json`) via the **Anchor v1 (`@anchor-lang/core`) TS client over
`@solana/kit`**. Responsibilities:

- **PDA derivation**
  - Intent: `["intent", maker, id]` → `programs/laplace` (`Bkb7…8ACG`)
  - ValidityConfig: `[VALIDITY_SEED, config_hash]` → `programs/validity` (`CuSV…3Kq1`)
- **Intent lifecycle helpers** (build full transactions, asset-aware):
  - `createIntent(args)` — generates random 32-byte `id`, locks SOL or SPL.
  - `fulfillIntent(intent, criterion, fulfillment)` — assembles criterion +
    settlement accounts and `criterion_account_count`.
  - `refundExpiredIntent(intent)` — permissionless crank.
  - `closeIntent(intent)` — maker-only rent reclaim.
- **Criterion plugins** (per-criterion fulfillment + commitment logic):
  - `hashlock`: `commit(secret) = sha256(secret)`, `fulfillment = secretBytes`,
    `criterion_account_count = 0`, no settlement-side criterion accounts.
  - `validity`: `createValidityConfig(args)`, commitment via `hash_config`,
    `fulfillment = ValidityFulfillment { proof, public_inputs_suffix }`,
    passes the `ValidityConfig` PDA as the one criterion account
    (`criterion_account_count = 1`). Proof generation is **out of SDK scope** for
    the MVP (deferred; supplied by caller).
- **Account decoding + queries** (see indexing, §6).
- **Asset model**: `EscrowAsset = NativeSol | SplToken { mint, token_program, vault }`.
  For SPL, the SDK derives the vault token account and assembles the 4 settlement
  remaining-accounts in the order the program expects
  (`[maker/vault, vault/dest, mint, token_program]`).

### Protocol constants the SDK pins
```
CRITERION_INTERFACE_VERSION = 2
MAX_FULFILLMENT_DATA_LEN     = 1024
VERIFY_CRITERION_DISCRIMINATOR = 8c7b8b8567d572ab
```

## 4. `@laplace/registry` — criterion & cluster metadata

A curated, typed dataset (no on-chain registry program exists yet). It maps each
criterion to its per-cluster program IDs plus display/UX metadata, and carries
per-cluster RPC + stablecoin presets.

```ts
interface ClusterConfig {
  cluster: "localnet" | "devnet" | "mainnet-beta";
  rpcUrl: string;
  programs: { laplace: Address; hashlock: Address; validity: Address };
  stablecoins: { symbol: string; mint: Address; decimals: number }[];
}
```

The full `CriterionDescriptor` / `ValidityConfigEntry` schema and the canonical
program-ID table are defined in **criteria-registry.md (§4–§5)** — that doc is the
single source of truth for registry shape and addresses. Switching clusters or
adding mainnet is a registry edit, not an app change.

## 5. Wallet & cluster (`@laplace/wallet`)

- **Wallet Standard** via `@solana/react` + `@wallet-standard/react` (Phantom,
  Solflare, Backpack auto-discovered), with a kit RPC connection keyed off the
  active `ClusterConfig`. Transactions are signed through kit
  `TransactionSendingSigner`s from the connected wallet account — no `web3.js@1`
  `Connection`/`Keypair` glue.
- Devnet airdrop helper for SOL.
- SPL: ship a devnet stablecoin reference (devnet USDC-Dev mint or a project test
  mint) and an ATA-creation helper so SPL flows are testable without manual setup.
- Slot clock service: polls `getSlot` and exposes `currentSlot` + a
  `slotToApproxTime` helper (~400ms/slot) for countdowns. **Slots are the source
  of truth**; wall-clock is display-only.

## 6. Indexing / discovery (client-side, swappable)

No indexer yet. The SDK exposes role queries via `getProgramAccounts` with
`memcmp` filters at fixed `Intent` byte offsets:

```
offset  8  : id              (32)
offset 40  : maker           (32)   ← filter "intents I made"
offset 72  : receiver        (32)   ← filter "intents I can receive"
offset 104 : refund_recipient(32)   ← filter "intents I can reclaim"
offset 136 : criterion_program(32)  ← filter by criterion
```

Exposed as `useIntents({ role })` so a real indexer (Helius / custom) can be
slotted in later behind the same interface with zero UI change.

## 7. Shareable links

Format: `/{app}/i/{intentPda}?cluster={cluster}`. The page resolves the intent
on-chain and renders the role-aware action.

**Security rule: secrets never travel in a link.** A hashlock preimage is a
*reveal* (it lands in public tx calldata when fulfilled); a disclosure secret is
the sold asset. Links carry only the intent address + cluster. Secret/preimage
delivery to a counterparty is explicitly off-band (out of scope for the URL).

## 8. Per-app surface (summary; full spec in main-site-spec.md)

| App | Primary flows | Criteria |
| --- | --- | --- |
| **main** | landing, dev docs/SDK quickstart, criterion catalog, create/track/fulfill/refund/close, manual per-instruction ops, criterion config & registration | hashlock + validity |
| **bridge** | counterparty setup, dual-chain HTLC with asymmetric timeouts, reveal/claim, refund | hashlock |
| **disclosure** | list a secret, buy, publish ciphertext + proof, decrypt locally, refund | validity / encrypted-disclosure |

## 9. Shared lifecycle UI model (`@laplace/ui`)

One canonical state machine drives every status surface:

```
Active ──(slot ≤ expiry)──▶ fulfill ──▶ Fulfilled ──▶ close
   └────(slot >  expiry)──▶ refund  ──▶ Refunded  ──▶ close
```

Shared primitives: `IntentStatusBadge` (Active / Expiring soon / Fulfilled /
Refunded / Closed), `ExpiryCountdown` (slot-driven), `AssetAmount`
(SOL/SPL decimals + symbol), `RoleActionButton` (renders Fulfill | Refund |
Close based on wallet role + slot), `TxToast`, `IntentCard`.

## 10. Build / deploy

- Each `apps/*` deploys independently (e.g. Vercel) with its own domain;
  `main` is the hub.
- `turbo run build` with remote caching; shared packages built once.
- Env per app: `NEXT_PUBLIC_CLUSTER`, `NEXT_PUBLIC_RPC_URL` (registry provides
  the rest). Devnet defaults baked into the registry.

## 11. Out of scope for the frontend (explicit)

- Compiling/deploying criterion programs or SP1 guests.
- SP1 proof generation in-app (validity MVP accepts a caller-supplied proof;
  hosted vs WASM proving is a later, separate decision).
- An on-chain criterion registry / governance program.
- Server-side indexer (client `getProgramAccounts` for now).
