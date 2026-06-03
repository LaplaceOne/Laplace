# Laplace Website — Design Spec

_Date: 2026-06-03 · Status: approved (brainstorming) → ready for implementation planning_

## 1. Goal

Build the Laplace website as a real React application that faithfully reproduces
the approved HTML/CSS/JS design prototype (line-art aesthetic on the AnyUI token
system) across **all five surfaces** — Landing, Docs, Lab, Registry, and the
interactive **Console** — and wires the Console to the real protocol via
`@laplace/sdk`, `@laplace/indexer`, and Solana wallets.

The design prototype is a "pure HTML/CSS/JS showcase." We **re-implement it as our
own React program** — we do not lift the prototype's vanilla-JS/HTML wholesale.
We follow the design's **styling, layout, and tokens closely** (pixel-faithful
surface), while content may differ where it makes the site more correct/coherent.

Source design bundle (extracted reference): `Laplace Site Overview.html` (canvas
index), `index.html`, `docs.html`, `lab.html`, `registry.html` (marketing pages),
`app.css` + `app.js` (the Console — the prototype's `app.html` host shell was not
exported, but its styling and logic fully specify the Console), plus
`styles/anyui-tokens.css`, `styles/laplace.css`, `styles/laplace.js`,
`styles/bg.js`, `registry.js`.

## 2. Locked decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Framework | **Vite + React 19 + React Router (SPA)** | Matches the "react.js / our own react program" brief; leanest for a wallet-gated, client-side dApp; static-deployable. Consciously diverges from `frontend-architecture.md` §0 (Next.js) — that doc's stack pin is superseded for this app. |
| Scope (this build) | **All five surfaces** | Full site; Console is the interactive heart. |
| Chain wiring | **Full read + write** | Real wallet connect, indexer-backed discovery (SDK `getProgramAccounts` fallback), live `create/fulfill/refund/close`. SP1 validity proof generation stays caller-supplied/off-app. |
| Component decoupling (A) | **Create `@laplace/ui`** | User emphasized decoupling; architecture doc + "one protocol, many faces" thesis want a shared design system for future Bridge/Disclosure apps. |
| Styling strategy (B) | **Re-author AnyUI CSS as our own, organized + component-scoped (CSS Modules)** | Preserves exact tokens/measurements for fidelity while being our own structured code; avoids Tailwind rewrite drift and avoids verbatim copy. |

## 3. Monorepo placement

```
app/
  apps/
    main/                          ← NEW: Vite SPA (this build)
      index.html                   inline pre-paint theme script (no FOUC)
      vite.config.ts
      package.json                 name: @laplace/main (private)
      src/
        main.tsx                   root: providers + RouterProvider
        router.tsx                 route table
        env.ts                     VITE_CLUSTER / VITE_RPC_URL / VITE_INDEXER_URL
        layouts/                   SiteLayout (marketing), ConsoleLayout (app)
        routes/                    one module per page/view (see §6, §7)
        features/                  console feature modules (dashboard, detail, create, manual, validity)
        wallet/                    wallet-standard connect provider + modal + button
        lib/                       indexerClient, query hooks, formatting glue
        content/                   page copy + registry-derived data
  packages/
    ui/                            ← NEW: @laplace/ui (design system + shared primitives)
      package.json                 name: @laplace/ui
      src/
        styles/tokens.css          re-authored anyui-tokens.css (exact values)
        styles/base.css            globals: scrollbar, typography, gradient-text, selection
        theme/ThemeProvider.tsx    data-theme on <html>, localStorage 'laplace-theme'
        components/...              primitives (see §4)
        index.ts                   barrel
    sdk/ wallet/ registry/ indexer/ config/   (existing, UNCHANGED)
```

Dependency direction: `apps/main → @laplace/ui → @laplace/sdk → @laplace/registry`;
`apps/main → @laplace/wallet`. Apps never import `@solana/kit` directly.

Build: turbo-orchestrated (`build`/`dev`/`lint`/`typecheck`/`test`). `@laplace/ui`
builds via the shared `@laplace/config` tsup preset (ESM/CJS/types) and ships its
CSS as importable assets.

## 4. `@laplace/ui` — shared design system

**Foundation**
- `styles/tokens.css` — re-authored AnyUI tokens (brand `--primary` light
  `rgb(15,111,239)` / dark `rgb(54,138,255)`; cyan `--secondary`; surfaces, text,
  borders, inky-blue `--shadow` elevations, radii, spacing, type scale; Nunito +
  JetBrains Mono; full `[data-theme="dark"]` block + `prefers-color-scheme`).
- `styles/base.css` — `*{box-sizing}`, html/body, custom scrollbar (primary-tinted
  thumb), `.wrap` (max 1140px / 36px pad), `.mono`, `.label`, `hr.rule`,
  `.gradient-text`, `::selection`.
- `ThemeProvider` — sets `data-theme` on `<html>`, persists `laplace-theme`
  (default `light`), exposes `useTheme()`; pairs with a blocking inline script in
  `index.html` that applies the stored theme **before paint** (no FOUC).

**Atoms / behaviors**
- `Icon` — wraps `@iconify/react` `<Icon>` (replaces the prototype's
  `<iconify-icon>` web component; same `eva:*` / `mdi:github` names).
- `Button` (`.btn`, `--accent`, `--ghost`, `--lg`), `ArrowLink`, `CopyButton`
  (clipboard + "copied" confirm), `CodeBlock` (`.code` with bar + dot-row +
  syntax-highlight spans).
- `Reveal` — IntersectionObserver fade/slide-up (threshold 0.12) + ~1.4s fallback;
  respects `prefers-reduced-motion`.
- `AmbientBackground` — React port of `bg.js`: fixed canvas flow-field of hairline
  segments on a layered sine field; magnetic pointer (radius ~230px, gaussian
  falloff) bends segments radially toward the cursor (no spin, no brightness
  change); two drifting brand glows (CSS keyframes); re-reads `--primary-solid` on
  theme change; pauses on `visibilitychange`; debounced resize; reduced-motion =
  single static frame. **Marketing pages only.**
- `CursorRing` — React port of the `laplace.js` accent-ring cursor: fine-pointer
  only; ring eases via rAF lerp, dot tracks instantly; `.hot` over interactive
  selectors, `.tap` on pointerdown; reduced-motion-aware. Site-wide.

**Lifecycle primitives** (shared UI state machine, per architecture doc §9)
- `IntentStatusBadge` (Active / Expiring soon / Fulfilled / Refunded / Closed) —
  driven by `effectiveStatus`.
- `ExpiryCountdown` — slot-driven via `useSlot()` + `slotToApproxTime`; `.urgent`
  (<~15min) / `.past`.
- `AssetAmount` — SOL/SPL decimals + symbol via `toDisplay`.
- `RoleActionButton` — renders Fulfill / Refund / Close / disabled-with-reason from
  `actionFor(intent, { wallet, currentSlot })`.
- `IntentCard` — amount, criterion chip, counterparty, badge, countdown, action.
- `Toast` / `ToastProvider` / `useToast` — bottom-center toast; `TxToast` variant
  for signatures.

## 5. Integration layer (`apps/main`)

**Provider stack** (root):
```
<ThemeProvider>
  <WalletProvider>                    {/* our wallet-standard layer → TransactionSigner */}
    <LaplaceProvider cluster={cluster} rpcUrl={rpcUrl} signer={signer}>
      <IndexerProvider baseUrl={VITE_INDEXER_URL}>
        <ToastProvider>
          <RouterProvider router={router} />
```

**Wallet connect (the gap `@laplace/wallet` leaves to the app):**
- Built on `@solana/react` + `@wallet-standard/react` — auto-discovers
  Phantom/Solflare/Backpack via `useWallets`.
- A connect modal (wallet list) + the design's `.wallet-btn`
  (disconnected → "Connect wallet"; connected → dot + truncated address + SOL
  balance pill). Produces a kit `TransactionSigner` passed into `LaplaceProvider`.
- Devnet airdrop via `makeAirdrop`; persists last-selected wallet for auto-reconnect.

**Discovery — indexer-first with SDK fallback:**
- `lib/indexerClient.ts` — typed fetch wrapper for `GET /intents` (status, maker,
  receiver, criterionProgram, limit, cursorSlot), `GET /intents/:pda`,
  `GET /stats`, `GET /validity-configs`, `GET /health`. Returns `IntentRow` /
  `IntentDetail` / `Stats` / `ValidityConfigRow`.
- Hooks (`lib/hooks.ts`): `useIntentList({ role, status })`, `useIntentDetail(pda)`,
  `useStats()`, `useValidityConfigs()`. When `VITE_INDEXER_URL` is unset or
  `/health` fails, hooks **fall back to `@laplace/sdk`** `useIntents({role})` /
  `fetchIntent` / `fetchIntents` (getProgramAccounts + memcmp) so the Console works
  without a running indexer. Role→owner mapping uses the connected signer.
- Polling/refetch on an interval keyed to the slot clock; manual invalidate after
  a successful write.

**Writes** via the `Laplace` client (`useClient()`):
`createIntent`, `fulfillIntent`, `refundExpiredIntent`, `closeIntent`,
`createValidityConfig`. Errors → `mapLaplaceError(err, { program })` → plain text
in a `TxToast`. Success → toast with explorer link + cache invalidation.

**Slots are truth:** `useSlot()` from the SDK context (backed by `createSlotClock`,
~2s poll) drives all countdowns and `actionFor`/`effectiveStatus`.

## 6. Console feature spec (`/app/*`)

`ConsoleLayout`: sticky appbar (brand + `DEVNET` sub-pill, in-app tabs
Console/Create/Manual, cluster badge, theme toggle, wallet button). **No ambient
background** (cursor ring still applies). View transitions reuse the `.view`/
`viewin` animation feel via route transitions.

- **Dashboard `/app`** — `app-head` (h1 "Console" + subtitle) → `StatStrip`
  (4 metrics from `/stats`: created / fulfilled / refunded / escrowed-active) →
  Toolbar (role segmented control: All · Made by me · To me · Refundable by me;
  status chips: All · Active · Expiring soon · Fulfilled · Refunded · Closed) →
  `IntentCard` grid (3-col) or empty state ("Create your first intent" → create).
  Live countdowns; re-derive on slot tick.
- **Detail `/app/intent/:pda`** and public **`/app/i/:pda`** — header panel
  (amount + criterion chip + status badge + program/intent id), Parties panel
  (maker / receiver / refund_recipient with "YOU" highlight), Timeline panel
  (created → expiry → terminal, from indexer event timeline, with tx links),
  Action panel (`RoleActionButton`-driven: Fulfill with irreversible-reveal warning
  for hashlock / upload-proof for validity; Refund when `slot > expiry`; Close for
  maker after settle), Share panel (`intentShareLink(pda, cluster)` — **never**
  embeds a secret). Public `/app/i/:pda` resolves cluster from query and renders
  read + role-aware action.
- **Create wizard `/app/create`** — 3 steps, `create-wrap` (max 720px), steps-bar:
  1. Escrow & parties — asset toggle SOL/SPL (SPL: mint selector w/ devnet
     stablecoin presets + custom mint, reads decimals/symbol, validates ATA
     balance), amount (human → base units via `toBaseUnits`), receiver (validated),
     refund recipient (defaults to maker), expiry (duration → `expirySlot =
     currentSlot + minutesToSlots(n)`; show resolved slot + approx time).
  2. Criterion recipe — three cards:
     - **Hashlock** (Official): generate-secret mode (client-side 32-byte secret →
       `Condition.hashlock({secret})`, forced "save your secret" copy/download gate
       before sign) or paste-hash mode (`Condition.hashlock({hash})`).
     - **Validity · SP1** (Official): pick an existing `ValidityConfig` (from
       `/validity-configs` or registry) → `Condition.validity({configHash})`; note
       that fulfillment needs an off-app Groth16 proof + suffix.
     - **Custom** (Unverified): `Condition.custom({programId, criterionDataHash})`;
       typed-program-ID acknowledgment gate (must retype the program ID to proceed;
       Flagged tiers hard-blocked) + registry quick-pick (`getCriteria`) +
       "open the full registry" link.
  3. Review & sign — full summary (derived intent PDA via `intentPda`), one
     `createIntent` tx, `TxToast`, redirect to detail.
- **Manual ops `/app/manual`** — per-instruction console mapping 1:1 to the
  programs, using **`@laplace/sdk/raw`** (Codama instruction builders): editable
  accounts/args/remaining-accounts with explicit `criterion_account_count`;
  serialized instruction + simulation result before send. Escape hatch for
  `initialize`, `create_intent`, `fulfill_with_criterion`, `refund_expired_intent`,
  `close_intent`, `create_validity`, `verify_criterion`.
- **Validity config `/app/validity/new`** — inputs `guest_elf_hash`,
  `sp1_vkey_hash`, `fixed_public_inputs` → `createValidityConfig` (PDA via
  `validityConfigPda`); offer to add to the local reuse list on success.

## 7. Marketing surfaces

Shared `SiteLayout`: sticky blurred nav (brand mark + wordmark; center links
Docs/Lab/Registry; right theme toggle + accent "Launch console"); `AmbientBackground`;
`CursorRing`; 4-col footer + foot-bottom ("© 2026 laplace protocol" / "devnet ·
SOL + SPL"). All sections wrapped in `Reveal`. `scroll-behavior: smooth` +
`scroll-margin-top` for hash anchors.

- **Landing `/`** — Hero (eyebrow + h1 "Escrow that releases only on proof,
  refunds on expiry." + sub + CTAs + animated lifecycle SVG line diagram) →
  Guarantees (3-col: Non-custodial / Atomic / Refund-guaranteed) → How it works
  (3 steps) → Pluggable criteria (Hashlock + Validity cards + future list) → The
  app family (Console live · Bridge/Disclosure roadmap) → For developers (SDK
  `create-intent.ts` code block) → **Live protocol stats** (from `/stats`) → CTA →
  Footer. Exactly two "Solana" mentions (hero sub + closing CTA), per the design.
- **Docs `/docs`** — sticky left rail + IntersectionObserver scroll-spy; sections
  Overview / Intent lifecycle (state-machine SVG + deftable) / Criterion interface
  (constants + request struct) / Hashlock / Validity·SP1 / Future criteria / SDK
  quickstart (`npm i` install strip + code) / Program IDs (from `@laplace/registry`
  `PROGRAM_IDS`). Rail hidden < 900px.
- **Lab `/lab`** — page-head + architecture SVG (Protocol → shared SDK/registry/
  design-system → Console/Bridge/Disclosure/Future) → Products (3 panels) → Future
  verticals (6 cards) → "How a product is born" (3 steps) → CTA.
- **Registry `/registry`** — page-head ("Permissionless protocol. Legible trust.")
  → Trust model split (Automatic·cryptographic vs Human·judgment) → Five trust
  tiers legend → **interactive catalog** (Criteria / Validity-guests tabs + tier
  filter pills + accordion cards) sourced from `@laplace/registry`
  (`getCriteria`, `guests`, `tierOf`) → submission pipeline → CTA. Catalog is a
  React component with `tab` + `tierFilter` state (replaces `registry.js`).

## 8. Shared behaviors (parity checklist)

Theme toggle (persist `laplace-theme`, swap moon/sun icon, pre-paint apply) ·
scroll reveal · copy buttons · custom cursor ring · ambient flow-field background
(marketing only) · smooth anchor scroll · nav underline hover · toast system ·
responsive breakpoints (900px) matching the prototype's media queries.

## 9. Content approach

Faithful-but-fresh. Keep the design's docs-grounded technical copy and the two
deliberate "Solana" mentions. Replace prototype **mock data** with real data where
it exists: program IDs, criteria catalog, trust tiers, validity configs (from
`@laplace/registry`/indexer); live stats (from `/stats`). Illustrative registry
entries beyond the two official criteria remain clearly labeled until real data
lands. No `window.__lpbg` / `window.__registryReady` debug hooks in production.

## 10. Environment & config

`apps/main/.env`: `VITE_CLUSTER` (default `devnet`), `VITE_RPC_URL` (optional
override; else registry RPC), `VITE_INDEXER_URL` (optional; absent → SDK
getProgramAccounts fallback). Cluster banner is a persistent Devnet indicator with
a wrong-cluster guard on the connected wallet.

## 11. Build / dev / testing

- `vite` dev + build; turbo wires `dev`/`build`/`lint`/`typecheck`/`test`.
- Vitest + Testing Library: `@laplace/ui` primitives (badge/countdown/action
  button/theme), the indexer client + fallback hooks, and the create-wizard state
  machine (asset → base units, expiry → slot, hashlock secret gate, custom-ack
  gate). Slot/clock and RPC mocked.
- Dev note: running the indexer locally (`laplace-indexer` ingest +
  `laplace-indexer-api`) against a cluster, or omit `VITE_INDEXER_URL` to use the
  SDK fallback.

## 12. Out of scope

SP1 proof generation (caller-supplied), program/guest deployment, the Bridge &
Disclosure apps, an on-chain registry program, and hosting the indexer service
itself.

## 13. Risks & open items

- **Devnet deployment is an open action item** (`docs/README.md`): the three
  programs may be localnet-only today. The app is built against the SDK and is
  correct regardless of which cluster hosts the programs; live devnet writes simply
  require the deploy to land. Registry currently uses placeholder/launch program
  IDs shared across clusters.
- **SPL flows** require ATA validation and the 4 settlement remaining-accounts —
  handled inside the SDK; the UI validates mint/decimals/ATA before enabling.
- **Validity fulfillment** needs an off-app proof; the UI accepts a pasted/uploaded
  proof + suffix and packages it via `validityFulfillment`.
- Re-authored CSS must be visually re-verified in a real browser (the prototype's
  capture tooling froze reveal/icon/canvas states).

## 14. Acceptance criteria

1. All five routes render pixel-faithfully to the prototype in light **and** dark,
   with no theme FOUC, ambient background on marketing pages only, and the cursor
   ring site-wide.
2. Wallet connect (Phantom/Solflare/Backpack) yields a working `TransactionSigner`;
   the wallet button reflects connected state + balance.
3. Dashboard lists real intents (indexer or SDK fallback) with role/status filters,
   live slot-driven countdowns, and correct role-aware actions.
4. Create wizard produces a valid `createIntent` transaction for SOL + SPL with
   hashlock (generate/paste) and validity (config) recipes, honoring the
   save-your-secret and custom-ack gates.
5. Detail view supports fulfill/refund/close per role+slot, shows the event
   timeline, and shares a secret-free link.
6. Manual ops can build, simulate, and send each program instruction via
   `@laplace/sdk/raw`.
7. `turbo run typecheck && turbo run test` pass for `@laplace/ui` and `apps/main`.
