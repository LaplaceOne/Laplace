# Laplace — Main Site Specification

The main site (`apps/main`) is the Laplace hub: marketing landing, developer
portal, and the **general protocol console**. Primary audiences: **developers /
integrators** and **protocol power users**. Targets devnet; SOL + SPL assets;
official criteria **hashlock** and **validity**.

It does **not** deploy programs or generate SP1 proofs. It creates/tracks/settles
intents and *configures & registers* existing criteria.

## 1. Site map

```
/                         Landing (value prop, how it works, live stats, CTAs)
/docs                     Developer portal (concepts, SDK quickstart, IDL refs)
/criteria                 Criterion catalog (hashlock, validity; status, schema)
/criteria/[key]           Criterion detail + configure/register actions
/app                      Console home — dashboard of the wallet's intents
/app/create               Create intent (recipe picker → hashlock | validity)
/app/intent/[pda]         Intent detail (countdown + role-aware action)
/app/i/[pda]              Public shareable view (resolves cluster from query)
/app/manual               Manual operations (raw per-instruction console)
/app/validity/new         Create a ValidityConfig (register a validity criterion)
```

## 2. Landing (`/`)

Sections, top to bottom:

1. **Hero** — one-sentence definition + "Launch console" / "Read docs" CTAs +
   network badge (Devnet).
2. **How it works** — the lifecycle diagram: create → (fulfill | refund) →
   close. Three steps in plain language.
3. **Criteria** — cards for hashlock and validity; "many faces, one protocol"
   framing; links to Bridge / Disclosure as derived products.
4. **For developers** — SDK quickstart snippet (`@laplace-one/sdk`), IDL/program-ID
   table per cluster, link to `/docs`.
5. **Live protocol stats** — counts by status (Active / Fulfilled / Refunded),
   total value escrowed (best-effort from client indexing).
6. **Footer** — program IDs, GitHub, docs, security note.

Tone: clean, technical, scientific (matches the "Laplace" name). No hype.

## 3. Console home (`/app`)

The dashboard is a **role-aware projection of the intent state machine**.

- **Role tabs / filters**: `Made by me` (maker), `To me` (receiver),
  `Refundable by me` (refund_recipient), `All` — backed by `useIntents({role})`
  (`getProgramAccounts` + memcmp; see frontend-architecture.md §6).
- **Status filters**: Active · Expiring soon · Fulfilled · Refunded · Closed.
- **Intent list/grid**: `IntentCard` shows asset+amount, counterparty (receiver),
  criterion, `IntentStatusBadge`, `ExpiryCountdown`, and the primary
  `RoleActionButton`.
- **Empty state**: "Create your first intent" → `/app/create`.

`RoleActionButton` logic:

```
status=Active & slot≤expiry & wallet has fulfillment path  → "Fulfill"
status=Active & slot>expiry  & wallet=refund_recipient      → "Refund"
status∈{Fulfilled,Refunded} & wallet=maker                  → "Close (reclaim rent)"
otherwise                                                   → disabled + reason
```

## 4. Create intent (`/app/create`)

A **recipe picker** then a criterion-specific form. Today: two recipes.

### Shared step 1 — Escrow & parties
- **Asset**: SOL or SPL. SPL shows a mint selector (devnet stablecoin presets +
  custom mint), reads decimals/symbol, validates the maker's ATA balance.
- **Amount**: human units; SDK converts to base units (lamports / token decimals).
- **Receiver**: pubkey (required). Inline validation.
- **Refund recipient**: defaults to maker; editable.
- **Expiry**: wall-clock duration input → SDK computes
  `expiry_slot = currentSlot + minutesToSlots(n)`. Shows the resolved slot and
  approximate time. Slot is the source of truth.

### Shared step 2 — Choose criterion (recipe)

#### Recipe A — Hashlock
Two sub-modes (the create form must offer both):
- **Generate a secret** (default): app generates a high-entropy 32-byte secret
  client-side, computes `criterion_data_hash = sha256(secret)`, and **forces a
  "save your secret" step** (copy / download) before signing. Warns: losing the
  secret means the intent can only be refunded; revealing it later is public.
- **I already have a hashlock**: paste `criterion_data_hash` directly (e.g. a
  counterparty's `h` for a cross-chain swap). No secret stored locally.

Commitment: `criterion_data_hash = SHA256(secret)` (the adapter is stateless and
checks only this — surface the "use unique secrets" warning from product-vision).

#### Recipe B — Validity (SP1)
- Select an existing **ValidityConfig** (from `/app/validity/new` or the
  registry), or link out to create one. The config commits
  `guest_elf_hash`, `sp1_vkey_hash`, and `fixed_public_inputs` via `hash_config`.
- `criterion_data_hash` for the intent = the config's `config_hash`.
- Form notes that fulfillment requires a Groth16 proof + public-input suffix,
  generated **off-app** for the MVP.

### Step 3 — Review & sign
- Full summary: asset, amount, parties, expiry (slot + time), criterion, derived
  intent PDA. One `createIntent` transaction (SOL locks into the PDA; SPL
  transfers into the vault). `TxToast` + redirect to `/app/intent/[pda]`.

## 5. Intent detail (`/app/intent/[pda]` and public `/app/i/[pda]`)

- **Header**: status badge, asset+amount, criterion, `ExpiryCountdown` (live,
  slot-driven; flips action exactly when chain crosses expiry).
- **Parties**: maker, receiver, refund_recipient (with role highlight for the
  connected wallet).
- **Timeline**: created_slot → expiry_slot → terminal state, with tx links.
- **Action panel** (role + slot aware):
  - **Fulfill** (hashlock): paste/confirm preimage → `fulfillIntent`
    (`criterion_account_count=0`, no settlement remaining-accounts for SOL; SDK
    adds the 4 SPL settlement accounts for tokens). **Irreversible-reveal warning**
    shown before signing.
  - **Fulfill** (validity): upload/paste proof + public-input suffix → SDK passes
    the `ValidityConfig` PDA as the single criterion account
    (`criterion_account_count=1`).
  - **Refund**: enabled only when `slot > expiry_slot` and Active. Permissionless
    crank (anyone can pay fees; funds go to refund_recipient).
  - **Close**: maker-only, after Fulfilled/Refunded; reclaims rent (and closes
    the SPL vault).
- **Share**: copy `/{app}/i/{pda}?cluster={cluster}` link. **Never** embeds a
  secret.

## 6. Manual operations (`/app/manual`)

Power-user / debugging console. Raw, per-instruction forms mapping 1:1 to the
program, with no recipe abstraction:

- `initialize`, `create_intent`, `fulfill_with_criterion`, `refund_expired_intent`,
  `close_intent` (laplace).
- `create_validity`, `verify_criterion` (validity); `verify_criterion` (hashlock,
  read-only simulate).
- Each form: editable accounts, args, and remaining-accounts with explicit
  `criterion_account_count`. Shows the serialized instruction + simulation result
  before sending. This is the escape hatch when the recipe UIs don't fit.

## 7. Criterion catalog (`/criteria`, `/criteria/[key]`)

- Catalog cards from `@laplace-one/registry`: name, status (official), program ID per
  cluster, stateful?, fulfillment kind, docs link.
- Detail page: commitment scheme, fulfillment payload shape, account layout,
  `criterion_account_count`, and "Configure / Register" actions:
  - hashlock: a hashlock calculator (secret → `sha256`).
  - validity: link to `/app/validity/new`.

## 8. Validity config creation (`/app/validity/new`)

Registers a reusable validity criterion (does **not** author guests):
- Inputs: `guest_elf_hash`, `sp1_vkey_hash` (from `vk.bytes32()`),
  `fixed_public_inputs` (hex).
- App computes `config_hash = hash_config(...)`, derives the
  `[VALIDITY_SEED, config_hash]` PDA, sends `create_validity`.
- On success, offers to add the config to the local/registry list for reuse in
  `/app/create` Recipe B.

## 9. Cross-cutting UX rules

- **Slots are truth, time is display.** Every deadline polls `getSlot`.
- **Asset correctness**: SPL flows always validate mint, decimals, ATA existence,
  and vault state before enabling the action.
- **Irreversibility & disclosure warnings** before any fulfill that reveals data.
- **Secret custody**: hashlock secrets are generated client-side and must be saved
  before signing; never transmitted in URLs.
- **Failure clarity**: map program `ErrorCode`s (InvalidPreimage, IntentExpired,
  IntentNotActive, InvalidReceiver, …) to plain-language messages.
- **Cluster banner**: persistent Devnet indicator; guard against wrong-cluster
  wallets.

## 10. Out of scope (main site)

- Program/guest deployment, SP1 proof generation, on-chain registry program,
  server-side indexer. (Bridge relaying and Disclosure encryption flows live in
  their own product specs.)
