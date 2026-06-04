# Laplace Website — Phase 4: Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full protocol console — corrected wallet signer, full filtered Dashboard, Intent Detail + public share with live fulfill/refund/close, the 3-step Create wizard, Manual per-instruction ops, and Validity config creation — wired to `@laplace-one/sdk` + wallet + indexer.

**Architecture:** Console views live under `routes/console/`, rendered in the existing `ConsoleLayout`. Reads come from the Phase-2 discovery hooks (`IntentView`); writes go through `useClient()` (the `Laplace` SDK client) using the connected `TransactionSigner` and a `ResolvedIntent` fetched via the SDK's `useIntent`. Errors map through `mapLaplaceError` into a `TxToast`. Slots drive all deadlines via `useSlot()`.

**Tech Stack:** Builds on Phases 1–3. No new deps (uses `@solana/kit` `address` for input validation, already a dep).

**Prereq:** Phases 1–3 complete and green.

**Confirmed SDK surface (do not re-derive):**
- `useClient(): Laplace`, `useSlot(): bigint`, `useLaplaceContext(): { rpc, cluster, currentSlot, signer? }`, `useIntent(pda): ResolvedIntent | null` (from `@laplace-one/sdk/react`).
- `client.createIntent({ maker: TransactionSigner, receiver: Address, refundRecipient?: Address, asset: EscrowAssetInput, amount: bigint, expirySlot: bigint, criterion: CriterionSpec, id? }) → { signature, intentPda, id, secret }`.
- `client.fulfillIntent(ri: ResolvedIntent, { secret } | { proof, publicInputsSuffix } | FulfillmentParts, { fulfiller }) → { signature }`.
- `client.refundExpiredIntent(ri, { cranker }) → { signature }`; `client.closeIntent(ri, { maker }) → { signature }`.
- `client.createValidityConfig({ guestElfHash, sp1VkeyHash, fixedPublicInputs }, { payer }) → { signature, configPda, configHash }`.
- `Condition.hashlock({ secret? } | { hash })`, `Condition.validity({ configHash } | {...})`, `Condition.custom({ programId, criterionDataHash } | { programId, bind })`.
- `nativeSol()`, `splToken({ mint, tokenProgram? })`, `toBaseUnits(human, decimals)`, `toDisplay(base, decimals)`, `minutesToSlots(min)`, `intentShareLink(pda, cluster)`, `mapLaplaceError(err, { program? })`, `criteria`/`getCriterion`/`tierOf` (registry).
- `@laplace-one/sdk/raw`: `laplaceProgram`, `hashlockProgram`, `validityProgram` namespaces with builders `getInitializeInstruction`, `getCreateIntentInstruction`, `getFulfillWithCriterionInstruction`, `getRefundExpiredIntentInstruction`, `getCloseIntentInstruction`, `getCreateValidityInstruction`, `getVerifyCriterionInstruction`.
- Console CSS reference: `docs/design-reference/laplace-prototype/project/styles/app.css` (all `.statstrip`/`.toolbar`/`.segmented`/`.chips`/`.intent-grid`/`.detail-grid`/`.panel`/`.party`/`.timeline`/`.action-panel`/`.create-*`/`.recipe`/`.submode`/`.secret-box`/`.review-*`/`.manual-grid`/`.instr-*`/`.serialized` styles). Markup/flows: `…/app.js`. Feature spec: `docs/main-site-spec.md` §3–§8.

---

## File structure (this phase)

```
apps/main/src/
  wallet/ConnectedSigner.tsx              MODIFY: useWalletAccountTransactionSigner (signing, not sending)
  wallet/WalletProvider.tsx               MODIFY: require 'solana:signTransaction' feature
  intent/criterionLabel.ts + .test.ts     resolve criterion program → { name, tier }
  routes/console/
    useIntentActions.ts                   fulfill/refund/close handlers (SDK + toast + errors)
    Dashboard.tsx (rewrite) + Dashboard.module.css
    IntentDetail.tsx (rewrite) + IntentDetail.module.css
    PublicIntent.tsx (rewrite)
    Create.tsx (rewrite) + Create.module.css
    createState.ts + createState.test.ts
    Manual.tsx (rewrite) + Manual.module.css + manualInstructions.ts
    ValidityNew.tsx (rewrite) + ValidityNew.module.css
```

---

## Task 1: Fix the wallet signer + criterion-label helper

**Files:**
- Modify: `app/apps/main/src/wallet/ConnectedSigner.tsx`, `app/apps/main/src/wallet/WalletProvider.tsx`
- Create: `app/apps/main/src/intent/criterionLabel.ts`, `app/apps/main/src/intent/criterionLabel.test.ts`

- [ ] **Step 1: Switch to the signing signer**

The SDK client signs locally (`signTransactionMessageWithSigners`) then sends via RPC, so the
wallet must provide a **signing** signer, not a sending one. In `ConnectedSigner.tsx`:

```tsx
import { useWalletAccountTransactionSigner } from '@solana/react';
```

and in `Connected`:

```tsx
function Connected({ account, children }: { account: UiWalletAccount; children: React.ReactNode }) {
  const signer = useWalletAccountTransactionSigner(account, `solana:${env.cluster}`);
  return (
    <LaplaceProvider cluster={env.cluster} rpcUrl={env.rpcUrl} signer={signer as unknown as TransactionSigner}>
      {children}
    </LaplaceProvider>
  );
}
```

- [ ] **Step 2: Require the signing feature in the wallet filter**

In `WalletProvider.tsx`, change `isSolana` to require the feature we actually use:

```tsx
function isSolana(w: UiWallet): boolean {
  return w.chains.some((c) => c.startsWith('solana:')) && w.features.includes('solana:signTransaction');
}
```

- [ ] **Step 3: criterionLabel — failing test**

`app/apps/main/src/intent/criterionLabel.test.ts`:

```ts
import { criterionLabel } from './criterionLabel';
import { getCluster } from '@laplace-one/registry';

test('labels the hashlock program by its registry name + tier', () => {
  const hashlock = getCluster('devnet').programs.hashlock;
  const { name, tier } = criterionLabel(hashlock, 'devnet');
  expect(name).toMatch(/hashlock/i);
  expect(tier).toBe('official');
});

test('falls back to a short address for unknown programs', () => {
  const { name, tier } = criterionLabel('UnknownProGram1111111111111111111111111111', 'devnet');
  expect(name).toMatch(/Unkn/);
  expect(tier).toBe('unknown');
});
```

- [ ] **Step 4: Implement criterionLabel**

`app/apps/main/src/intent/criterionLabel.ts`:

```ts
import { criteria, type Cluster, type TrustTier } from '@laplace-one/registry';

export function criterionLabel(programId: string, cluster: Cluster): { name: string; tier: TrustTier | 'unknown' } {
  const entry = criteria.find((c) => c.programId?.[cluster] === programId);
  if (entry) return { name: entry.name, tier: entry.tier };
  return { name: `${programId.slice(0, 4)}…${programId.slice(-4)}`, tier: 'unknown' };
}
```

- [ ] **Step 5: Run, commit**

```bash
cd app && npm run test -- --filter=@laplace-one/main
git add app/apps/main/src/wallet app/apps/main/src/intent
git commit -m "fix(main): use signing wallet signer for SDK; add criterionLabel helper"
```

---

## Task 2: Full Dashboard

**Files:**
- Modify: `app/apps/main/src/routes/console/Dashboard.tsx`; Create `Dashboard.module.css`
- Reference: `app.css` `.app-head`/`.statstrip`/`.stat*`/`.toolbar`/`.segmented`/`.chips`/`.chip*`/`.intent-grid`/`.empty*`; `app.js` dashboard render

- [ ] **Step 1: Rewrite Dashboard**

Replace the Phase-2 minimal dashboard with the full surface:

```tsx
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { IntentCard, viewEffectiveStatus, type EffectiveStatus } from '@laplace-one/ui';
import { useSlot } from '@laplace-one/sdk/react';
import { useWallet } from '../../wallet/WalletProvider';
import { useIntentList, useStats } from '../../indexer/hooks';
import { criterionLabel } from '../../intent/criterionLabel';
import { env } from '../../env';
import styles from './Dashboard.module.css';

type Role = 'all' | 'maker' | 'receiver' | 'refund';
const ROLES: Array<{ k: Role; label: string }> = [
  { k: 'all', label: 'All' }, { k: 'maker', label: 'Made by me' },
  { k: 'receiver', label: 'To me' }, { k: 'refund', label: 'Refundable by me' },
];
const CHIPS: Array<EffectiveStatus | 'All'> = ['All', 'Active', 'Expiring soon', 'Fulfilled', 'Refunded', 'Closed'];

export default function Dashboard() {
  const nav = useNavigate();
  const slot = useSlot();
  const { selectedAccount } = useWallet();
  const wallet = selectedAccount?.address;
  const [role, setRole] = React.useState<Role>('all');
  const [chip, setChip] = React.useState<EffectiveStatus | 'All'>('All');
  const stats = useStats();
  const { data, loading } = useIntentList({ role });

  const shown = data.filter((v) => chip === 'All' || viewEffectiveStatus(v, slot) === chip);

  return (
    <div className="wrap">
      <div className={styles.head}>
        <div><h1>Console</h1><p>Your intents across the protocol on {env.cluster}.</p></div>
      </div>

      <div className={styles.statstrip}>
        <Stat k="Intents" v={stats ? String(stats.total) : '—'} />
        <Stat k="Active" v={stats ? String(stats.byStatus.active) : '—'} />
        <Stat k="Fulfilled" v={stats ? String(stats.byStatus.fulfilled) : '—'} />
        <Stat k="Refunded" v={stats ? String(stats.byStatus.refunded) : '—'} />
      </div>

      <div className={styles.toolbar}>
        <div className={styles.segmented}>
          {ROLES.map((r) => (
            <button key={r.k} className={role === r.k ? styles.active : undefined} onClick={() => setRole(r.k)}>{r.label}</button>
          ))}
        </div>
        <div className={styles.chips}>
          {CHIPS.map((c) => (
            <button key={c} className={`${styles.chip} ${chip === c ? styles.chipActive : ''}`} onClick={() => setChip(c)}>{c}</button>
          ))}
        </div>
      </div>

      {loading ? <p>Loading…</p> : shown.length === 0 ? (
        <div className={styles.empty}>
          <h3>No intents here yet</h3>
          <p>Create your first intent to get started.</p>
          <button className="btn btn--accent" onClick={() => nav('/app/create')}>Create intent</button>
        </div>
      ) : (
        <div className={styles.grid}>
          {shown.map((v) => (
            <IntentCard key={v.pda} intent={v} currentSlot={slot} wallet={wallet}
              criterionLabel={criterionLabel(v.criterionProgram, env.cluster).name}
              onOpen={(pda) => nav(`/app/intent/${pda}`)}
              onAct={(pda) => nav(`/app/intent/${pda}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return <div className={styles.stat}><div className={styles.k}>{k}</div><div className={styles.v}>{v}</div></div>;
}
```

`Dashboard.module.css` ports `.app-head`, `.statstrip`/`.stat`/`.k`/`.v`, `.toolbar`,
`.segmented`+buttons, `.chips`/`.chip`(+active), `.intent-grid`, `.empty*` from `app.css`.

- [ ] **Step 2: Update the smoke test + run**

`app/apps/main/src/routes/console/Dashboard.test.tsx` — render `Dashboard` inside
`<MemoryRouter>` with the wallet + sdk-react + indexer mocked (empty list, null stats) and
assert the role tabs render ("Made by me", "To me") and the empty-state CTA shows. Mock
`@laplace-one/sdk/react` `useSlot` → `0n` and `../../wallet/WalletProvider` `useWallet` →
`{ selectedAccount: undefined }`, and `../../indexer/hooks` `useIntentList`→`{data:[],loading:false}`,
`useStats`→`null`.

```bash
cd app && npm run test -- --filter=@laplace-one/main && (cd apps/main && npx vite build)
git add app/apps/main/src/routes/console/Dashboard.tsx app/apps/main/src/routes/console/Dashboard.module.css app/apps/main/src/routes/console/Dashboard.test.tsx
git commit -m "feat(main): full console dashboard (stats, role/status filters, intent grid)"
```

---

## Task 3: Intent Detail + public share + actions

**Files:**
- Create: `app/apps/main/src/routes/console/useIntentActions.ts`
- Modify: `app/apps/main/src/routes/console/IntentDetail.tsx`, `PublicIntent.tsx`; Create `IntentDetail.module.css`
- Reference: `app.css` `.detail-grid`/`.panel`/`.detail-amt`/`.party*`/`.timeline`/`.tl-item*`/`.action-panel`/`.warn-box`/`.field*`/`.share-row`; `app.js` renderDetail/doAction; `main-site-spec.md` §5

- [ ] **Step 1: useIntentActions (SDK writes)**

`app/apps/main/src/routes/console/useIntentActions.ts`:

```ts
import * as React from 'react';
import { useClient, useIntent } from '@laplace-one/sdk/react';
import { mapLaplaceError } from '@laplace-one/sdk';
import { useToast } from '@laplace-one/ui';
import type { Address } from '@solana/kit';

export function useIntentActions(pda: string | undefined) {
  const client = useClient();
  const ri = useIntent(pda as Address | undefined);
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  async function run(fn: () => Promise<{ signature: string }>, ok: string) {
    if (!ri) { toast('Intent not loaded', 'error'); return; }
    setBusy(true);
    try { const { signature } = await fn(); toast(`${ok} · ${signature.slice(0, 8)}…`); }
    catch (e) { toast(mapLaplaceError(e).message, 'error'); }
    finally { setBusy(false); }
  }

  return {
    ri, busy,
    fulfillHashlock: (secret: Uint8Array, fulfiller: any) => run(() => client.fulfillIntent(ri!, { secret }, { fulfiller }), 'Fulfilled'),
    fulfillValidity: (proof: Uint8Array, publicInputsSuffix: Uint8Array, fulfiller: any) => run(() => client.fulfillIntent(ri!, { proof, publicInputsSuffix }, { fulfiller }), 'Fulfilled'),
    refund: (cranker: any) => run(() => client.refundExpiredIntent(ri!, { cranker }), 'Refunded'),
    close: (maker: any) => run(() => client.closeIntent(ri!, { maker }), 'Closed'),
  };
}
```

- [ ] **Step 2: IntentDetail page**

Rewrite `IntentDetail.tsx`: read `useParams().pda`; `useIntentDetail(pda)` for `{ view, timeline }`;
`useSlot()`; `useLaplaceContext().signer`; `useIntentActions(pda)`. Layout (`.detail-grid`):
- Back link → `/app`.
- LEFT: header `.panel` (`.detail-amt` `<AssetAmount>` + criterion chip via `criterionLabel` +
  `<IntentStatusBadge status={viewEffectiveStatus(view, slot)}>` + mono program/intent id);
  Parties `.panel` (maker / receiver / refund_recipient rows; add a "YOU" chip when the address
  equals `signer.address`); Timeline `.panel` (`.timeline` from `timeline[]`: created → settled →
  closed with `.tl-item.done`, each linking to the explorer tx — `https://explorer.solana.com/tx/{sig}?cluster={cluster}`).
- RIGHT: Action `.panel` driven by `viewActionFor(view, { wallet: signer?.address, currentSlot: slot })`:
  - **fulfill** (hashlock): a `.warn-box` irreversible-reveal warning + a preimage `<textarea>`
    (hex or base58 → bytes) → `fulfillHashlock(secretBytes, signer)`.
  - **fulfill** (validity): proof + suffix file/hex inputs → `fulfillValidity(...)`.
  - **refund**: button → `refund(signer)`.
  - **close**: button → `close(signer)`.
  - disabled state shows the `reason`. Gate all on a connected signer.
  Share `.panel`: `.share-row` with `intentShareLink(pda, cluster)` (read-only input) + a
  `<CopyButton>`. **Never** render the secret in the share link.

Use the criterion program to decide hashlock vs validity fulfill UI: compare
`view.criterionProgram` to `getCluster(cluster).programs.hashlock`/`.validity`.

`IntentDetail.module.css` ports `.detail-grid`/`.panel`/`.detail-amt`/`.detail-top`/`.party*`/
`.timeline`/`.tl-item*`/`.action-panel`/`.warn-box`/`.field*`/`.share-row`/`.back-link` from `app.css`.

- [ ] **Step 3: PublicIntent (read/share view)**

Rewrite `PublicIntent.tsx`: resolve cluster from `?cluster=` query (fallback `env.cluster`),
render the same Detail body in a standalone read context (no console chrome assumptions), with
the role-aware action still available when a wallet is connected. Reuse the Detail body by
extracting the inner markup into a shared `IntentDetailView` component if convenient, or
duplicate the read-only header/parties/timeline. Keep it secret-free.

- [ ] **Step 4: Smoke test, run, commit**

`IntentDetail.test.tsx` — mock `useIntentDetail`→`{view, timeline}`, `useSlot`→`0n`,
`useIntentActions`→stub, `useLaplaceContext`→`{signer:{address:'ME'}, cluster:'devnet'}`; render
in a `MemoryRouter` at `/app/intent/PDA`; assert the amount, a party row, and the share input
render.

```bash
cd app && npm run test -- --filter=@laplace-one/main && (cd apps/main && npx vite build)
git add app/apps/main/src/routes/console/IntentDetail.tsx app/apps/main/src/routes/console/IntentDetail.module.css app/apps/main/src/routes/console/PublicIntent.tsx app/apps/main/src/routes/console/useIntentActions.ts app/apps/main/src/routes/console/IntentDetail.test.tsx
git commit -m "feat(main): intent detail + public share with fulfill/refund/close actions"
```

---

## Task 4: Create wizard

**Files:**
- Create: `app/apps/main/src/routes/console/createState.ts`, `createState.test.ts`
- Modify: `app/apps/main/src/routes/console/Create.tsx`; Create `Create.module.css`
- Reference: `app.css` `.create-wrap`/`.steps-bar`/`.stepdot*`/`.stepline*`/`.seg-asset`/`.recipe*`/`.submode*`/`.secret-box`/`.review-*`/`.create-nav`; `app.js` create flow; `main-site-spec.md` §4

- [ ] **Step 1: createState — failing tests (pure logic)**

`app/apps/main/src/routes/console/createState.test.ts`:

```ts
import { initialCreate, validateStep1, buildCriterion, computeExpirySlot, toBytes32Hex } from './createState';
import { toBaseUnits } from '@laplace-one/sdk';

test('computeExpirySlot adds minutesToSlots to current slot', () => {
  expect(computeExpirySlot(1000n, 10)).toBe(1000n + 1500n); // 10 min * 150 slots/min
});

test('validateStep1 requires a receiver and a positive amount', () => {
  const s = { ...initialCreate, amount: '', receiver: '' };
  expect(validateStep1(s).ok).toBe(false);
  const s2 = { ...initialCreate, amount: '1.5', receiver: 'Recv1111111111111111111111111111111111111111' };
  expect(validateStep1(s2).ok).toBe(true);
});

test('buildCriterion(hashlock, generate) uses the saved secret', () => {
  const secret = new Uint8Array(32).fill(7);
  const spec = buildCriterion({ ...initialCreate, recipe: 'hashlock', hashMode: 'generate', secret });
  expect(spec.key).toBe('hashlock');
});

test('toBaseUnits converts human amounts', () => {
  expect(toBaseUnits('1.5', 9)).toBe(1500000000n);
});
```

- [ ] **Step 2: Implement createState**

`app/apps/main/src/routes/console/createState.ts`:

```ts
import { Condition, minutesToSlots, nativeSol, splToken, type CriterionSpec } from '@laplace-one/sdk';
import { address } from '@solana/kit';

export type Recipe = 'hashlock' | 'validity' | 'custom';
export interface CreateState {
  asset: 'sol' | 'spl';
  mint: string; decimals: number;
  amount: string; receiver: string; refund: string; expiryMinutes: number;
  recipe: Recipe;
  hashMode: 'generate' | 'paste'; secret?: Uint8Array; pastedHash: string;
  configHash: string;
  customPid: string; customHash: string; customAck: string;
}

export const initialCreate: CreateState = {
  asset: 'sol', mint: '', decimals: 9, amount: '', receiver: '', refund: '', expiryMinutes: 60,
  recipe: 'hashlock', hashMode: 'generate', pastedHash: '', configHash: '',
  customPid: '', customHash: '', customAck: '',
};

export function isAddress(s: string): boolean { try { address(s); return true; } catch { return false; } }

export function validateStep1(s: CreateState): { ok: boolean; reason?: string } {
  if (!s.amount || Number(s.amount) <= 0) return { ok: false, reason: 'Enter a positive amount' };
  if (!isAddress(s.receiver)) return { ok: false, reason: 'Enter a valid receiver address' };
  if (s.refund && !isAddress(s.refund)) return { ok: false, reason: 'Refund recipient is not a valid address' };
  if (s.asset === 'spl' && !isAddress(s.mint)) return { ok: false, reason: 'Enter a valid mint address' };
  return { ok: true };
}

export function validateStep2(s: CreateState): { ok: boolean; reason?: string } {
  if (s.recipe === 'hashlock') {
    if (s.hashMode === 'generate') return s.secret ? { ok: true } : { ok: false, reason: 'Generate and save your secret first' };
    return /^[0-9a-fA-F]{64}$/.test(s.pastedHash) ? { ok: true } : { ok: false, reason: 'Paste a 32-byte hex hash' };
  }
  if (s.recipe === 'validity') return /^[0-9a-fA-F]{64}$/.test(s.configHash) ? { ok: true } : { ok: false, reason: 'Select or enter a config hash' };
  // custom: require pid and a matching typed acknowledgment
  if (!isAddress(s.customPid)) return { ok: false, reason: 'Enter the criterion program ID' };
  if (s.customPid !== s.customAck) return { ok: false, reason: 'Re-type the program ID to acknowledge' };
  if (!/^[0-9a-fA-F]{64}$/.test(s.customHash)) return { ok: false, reason: 'Enter the criterion data hash (hex)' };
  return { ok: true };
}

export function computeExpirySlot(currentSlot: bigint, minutes: number): bigint {
  return currentSlot + minutesToSlots(minutes);
}

export function hexToBytes(hex: string): Uint8Array {
  const m = hex.match(/.{1,2}/g) ?? [];
  return Uint8Array.from(m.map((b) => parseInt(b, 16)));
}
export function toBytes32Hex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function buildCriterion(s: CreateState): CriterionSpec {
  if (s.recipe === 'hashlock') {
    return s.hashMode === 'generate'
      ? Condition.hashlock({ secret: s.secret! })
      : Condition.hashlock({ hash: hexToBytes(s.pastedHash) });
  }
  if (s.recipe === 'validity') return Condition.validity({ configHash: hexToBytes(s.configHash) });
  return Condition.custom({ programId: address(s.customPid), criterionDataHash: hexToBytes(s.customHash) });
}

export function buildAsset(s: CreateState) {
  return s.asset === 'sol' ? nativeSol() : splToken({ mint: address(s.mint) });
}
```

- [ ] **Step 3: Create wizard UI**

Rewrite `Create.tsx` as a 3-step wizard (`.create-wrap`, steps-bar) using a `useReducer` or
`useState<CreateState>`:
- **Step 1 — Escrow & parties:** `.seg-asset` SOL/SPL; SPL shows a mint input (+ a small devnet
  preset list defined inline: e.g. `USDC-Dev` with its mint + decimals) and a decimals input;
  amount, receiver, refund (placeholder = maker), expiry minutes (show resolved
  `computeExpirySlot(useSlot(), minutes)` + approx time). "Next" gated by `validateStep1`.
- **Step 2 — Criterion recipe:** three `.recipe` cards (Hashlock `official`, Validity·SP1
  `official`, Custom `unverified`). Hashlock: `.submode` Generate / Paste. Generate →
  `crypto.getRandomValues(new Uint8Array(32))`, show in a `.secret-box` with copy + a "I saved it"
  checkbox that sets `secret` in state (the save-before-sign gate). Paste → 64-hex input. Validity:
  select from `useValidityConfigs()` (or paste a config hash). Custom: program ID + criterion data
  hash + a "re-type program ID" acknowledgment input + the `unverified` warning. "Next" gated by
  `validateStep2`.
- **Step 3 — Review & sign:** `.review-table` summary (asset, amount, parties, expiry slot+time,
  criterion, derived intent recipe); "Create intent" calls
  `client.createIntent({ maker: signer, receiver: address(receiver), refundRecipient: refund ? address(refund) : undefined, asset: buildAsset(s), amount: toBaseUnits(s.amount, s.decimals), expirySlot: computeExpirySlot(slot, s.expiryMinutes), criterion: buildCriterion(s) })`,
  then on success `toast`, and `nav('/app/intent/' + res.intentPda)`. Errors → `mapLaplaceError`.
  Gate the whole flow on a connected `signer` (else show "Connect wallet").

`Create.module.css` ports the create-flow styles from `app.css` (lines 178–222).

- [ ] **Step 4: Run, commit**

```bash
cd app && npm run test -- --filter=@laplace-one/main && (cd apps/main && npx vite build)
git add app/apps/main/src/routes/console/Create.tsx app/apps/main/src/routes/console/Create.module.css app/apps/main/src/routes/console/createState.ts app/apps/main/src/routes/console/createState.test.ts
git commit -m "feat(main): 3-step create-intent wizard (SOL/SPL, hashlock/validity/custom recipes)"
```

---

## Task 5: Manual operations console

**Files:**
- Create: `app/apps/main/src/routes/console/manualInstructions.ts`
- Modify: `app/apps/main/src/routes/console/Manual.tsx`; Create `Manual.module.css`
- Reference: `app.css` `.manual-grid`/`.instr-list`/`.instr-item*`/`.serialized`; `main-site-spec.md` §6

- [ ] **Step 1: Instruction registry**

`manualInstructions.ts` — describe each program instruction as a field schema the generic form
can render. Read each builder's input type from `@laplace-one/sdk/raw` (`laplaceProgram.*`,
`validityProgram.*`, `hashlockProgram.*`) to list its account fields and arg fields. Shape:

```ts
import { laplaceProgram, validityProgram, hashlockProgram } from '@laplace-one/sdk/raw';

export interface Field { name: string; kind: 'address' | 'u64' | 'bytes' | 'u8'; account?: boolean }
export interface ManualInstr { key: string; program: 'laplace' | 'validity' | 'hashlock'; label: string; fields: Field[]; build: (vals: Record<string, string>) => any }
export const MANUAL_INSTRUCTIONS: ManualInstr[] = [ /* initialize, create_intent, fulfill_with_criterion, refund_expired_intent, close_intent, create_validity, verify_criterion (laplace×5 + validity×2 + hashlock×1) */ ];
```

Implement one fully as the canonical pattern (`close_intent` — accounts: intent, maker; no args):

```ts
{
  key: 'close_intent', program: 'laplace', label: 'close_intent',
  fields: [ { name: 'intent', kind: 'address', account: true }, { name: 'maker', kind: 'address', account: true } ],
  build: (v) => laplaceProgram.getCloseIntentInstruction({ intent: v.intent as any, maker: v.maker as any }),
}
```

Then add the remaining instructions following the same pattern, reading each generated builder's
input fields (accounts + args; encode `bytes` hex via `hexToBytes`, `u64` via `BigInt`).

- [ ] **Step 2: Manual UI**

Rewrite `Manual.tsx`: `.manual-grid` (240px + 1fr): left `.instr-list` of `MANUAL_INSTRUCTIONS`
(grouped by program); right a form rendering the selected instruction's `fields`, a `.serialized`
preview of the built instruction (program address + account metas + data hex), and Simulate / Send
buttons. **Simulate**: build a tx message with the instruction + `rpc.simulateTransaction`. **Send**:
append the instruction and send via the connected signer (reuse the SDK client's send path is not
exposed; instead build + `signTransactionMessageWithSigners` + `sendAndConfirm` inline using
`useLaplaceContext().rpc`/`rpcSubscriptions`/`signer`). Show the resulting signature or error
(`mapLaplaceError`) in a toast. Gate on a connected signer.

`Manual.module.css` ports `.manual-grid`/`.instr-list`/`.instr-item*`/`.serialized` from `app.css`.

- [ ] **Step 3: Run, commit**

```bash
cd app && npm run typecheck -- --filter=@laplace-one/main && (cd apps/main && npx vite build)
git add app/apps/main/src/routes/console/Manual.tsx app/apps/main/src/routes/console/Manual.module.css app/apps/main/src/routes/console/manualInstructions.ts
git commit -m "feat(main): manual per-instruction ops console via @laplace-one/sdk/raw"
```

> Manual ops is the power-user escape hatch; correctness of the build/serialize path matters more
> than exhaustive polish. Render all 8 instructions; if a builder's exact input field differs from
> the schema, read the generated type and match it — never leave a field as a guess.

---

## Task 6: Validity config creation + final gate

**Files:**
- Modify: `app/apps/main/src/routes/console/ValidityNew.tsx`; Create `ValidityNew.module.css`
- Reference: `app.css` `.field*`/`.panel`; `main-site-spec.md` §8

- [ ] **Step 1: ValidityNew form**

Rewrite `ValidityNew.tsx`: a `.panel` form with `guest_elf_hash` (hex), `sp1_vkey_hash` (hex, from
`vk.bytes32()`), `fixed_public_inputs` (hex) inputs; on submit call
`client.createValidityConfig({ guestElfHash: hexToBytes(elf), sp1VkeyHash: hexToBytes(vkey), fixedPublicInputs: hexToBytes(fixed) }, { payer: signer })`,
then toast the resulting `configHash` (via `toBytes32Hex(res.configHash)`) and offer to copy it for
reuse in the Create → Validity recipe. Gate on a connected `signer`. Reuse `hexToBytes`/`toBytes32Hex`
from `createState.ts`. `ValidityNew.module.css` ports the `.field*` form styles from `app.css`.

- [ ] **Step 2: Full gate**

```bash
cd app && npm run typecheck && npm run test -- --filter=@laplace-one/ui --filter=@laplace-one/main \
  && (cd apps/main && npx vite build)
```

Expected: all packages typecheck; `@laplace-one/ui` + `@laplace-one/main` tests green; SPA builds. (Live
RPC not exercised in tests.)

- [ ] **Step 3: Commit**

```bash
git add app/apps/main/src/routes/console/ValidityNew.tsx app/apps/main/src/routes/console/ValidityNew.module.css
git commit -m "feat(main): validity config creation (create_validity)"
```

---

## Phase 4 self-review

- **Spec coverage (§6 console):** signer correctness ✓ Task 1; Dashboard (stats + role/status
  filters + grid + empty) ✓ Task 2; Detail + public share + fulfill/refund/close + timeline + warnings
  ✓ Task 3; Create wizard (SOL/SPL, hashlock generate/paste + save-secret gate, validity config,
  custom + ack gate) ✓ Task 4; Manual per-instruction ops via `@laplace-one/sdk/raw` ✓ Task 5; Validity
  config creation ✓ Task 6. Slots-as-truth (`useSlot`), secret-free share links, irreversible-reveal
  warnings, error mapping all present.
- **Placeholder scan:** SPL decimals come from a user input + small preset (real values, not a
  placeholder); validity proof generation stays caller-supplied (documented out-of-scope, the fulfill
  UI accepts a pasted proof). Manual-ops Step 1 requires reading the generated input types rather than
  guessing — the canonical `close_intent` is fully worked and the rest follow it. No "TBD" steps.
- **Type consistency:** `IntentView`/`viewEffectiveStatus`/`viewActionFor` from `@laplace-one/ui`;
  `useIntentList`/`useIntentDetail`/`useStats` from Phase-2 hooks; `useClient`/`useIntent`/`useSlot`/
  `useLaplaceContext` from `@laplace-one/sdk/react`; `Condition`/`nativeSol`/`splToken`/`toBaseUnits`/
  `minutesToSlots`/`intentShareLink`/`mapLaplaceError` from `@laplace-one/sdk`; `criterionLabel` shared.
  `createState` helper names match across `createState.ts`, its tests, and `Create.tsx`.

## Risks / notes
- Live writes require the programs deployed on the selected cluster (devnet deploy is an open action
  item); until then, create/fulfill/refund/close build correctly but fail at send. The UI surfaces the
  mapped error. Localnet works today.
- The signer must support `solana:signTransaction` (Phantom/Solflare/Backpack do); the wallet filter
  enforces this.
- Validity fulfillment needs an off-app Groth16 proof + suffix; the UI accepts them but does not
  generate them.
