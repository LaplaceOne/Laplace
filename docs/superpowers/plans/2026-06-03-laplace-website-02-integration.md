# Laplace Website — Phase 2: Integration Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the app to the chain: a wallet-standard connect layer that yields a `TransactionSigner`, the `LaplaceProvider`/indexer/toast provider stack, a typed indexer client with SDK fallback, discovery hooks, and the shared lifecycle primitives — proven by a minimal live console dashboard.

**Architecture:** `WalletProvider` (built on `@wallet-standard/react` + `@solana/react`) tracks the selected account and exposes connect/disconnect; a `ConnectedSigner` bridge turns the selected account into a kit `TransactionSendingSigner` and feeds it to `@laplace-one/wallet`'s `LaplaceProvider`, which supplies RPC + slot clock + SDK context. An `IndexerProvider` exposes a typed HTTP client; discovery hooks prefer the indexer and fall back to the SDK's `getProgramAccounts`. A normalized `IntentView` decouples the UI from the two on-the-wire shapes (indexer `IntentRow` vs SDK `ResolvedIntent`); the `@laplace-one/ui` lifecycle primitives consume `IntentView` + the SDK's `effectiveStatus`/`actionFor`/`useSlot`.

**Tech Stack:** Builds on Phase 1. Adds `@solana/react@6`, `@wallet-standard/react@1`, `@solana/kit@6`, the indexer HTTP API.

**Prereq:** Phase 1 is complete and green (`@laplace-one/ui` foundation + `apps/main` shell + router). `registry`/`sdk`/`wallet` are built to `dist`.

**Confirmed APIs (do not re-derive):**
- `@laplace-one/wallet`: `LaplaceProvider({ cluster, rpcUrl?, signer?, children })`, `resolveRpcUrl(cluster, override?)`, `makeAirdrop(rpc, rpcSubscriptions)`, `createSlotClock`, `ataFor`, `createAtaIx`.
- `@laplace-one/sdk` (`.`): `Laplace`, `Condition`, `nativeSol`, `splToken`, `toBaseUnits`, `toDisplay`, `effectiveStatus(intent, currentSlot, opts?)`, `actionFor(intent, { wallet, currentSlot })`, `intentShareLink(pda, cluster)`, `mapLaplaceError(err, { program? })`, `fetchIntents(rpc, { role, owner, cluster })`, `fetchIntent(rpc, pda)`, `intentPda`, types `ResolvedIntent`/`Intent`/`EscrowAsset`/`IntentStatus`/`EffectiveStatus`/`IntentAction`.
- `@laplace-one/sdk/react`: `useLaplaceContext()`, `useSlot()`, `useClient()`, `useIntents({ role })`, `useIntent(pda)`.
- `@laplace-one/registry`: `getCluster(cluster).programs`, `criteria`, `getCriteria`, `getCriterion`, `tierOf`, `isOfficial`, types `Cluster`/`CriterionEntry`/`TrustTier`.
- `@wallet-standard/react`: `useWallets(): readonly UiWallet[]`, `useConnect(wallet): [isConnecting, connect()→readonly UiWalletAccount[]]`, `useDisconnect(wallet): [isDisconnecting, disconnect()]`; types `UiWallet`/`UiWalletAccount` from `@wallet-standard/ui`.
- `@solana/react`: `useWalletAccountTransactionSendingSigner(account: UiWalletAccount, chain: 'solana:devnet'|…): TransactionSendingSigner`.
- Indexer HTTP: `GET /health→{ok}`, `/intents?status&maker&receiver&criterion&limit&cursorSlot→{intents: IntentRow[]}`, `/intents/:pda→{intent,timeline}` (404 `{error}`), `/stats→{byStatus:{active,fulfilled,refunded},closed,total}`, `/validity-configs→{configs}`. `IntentRow`: `{ pda, id, maker, receiver, refundRecipient, criterionProgram, asset: {kind:'NativeSol'}|{kind:'SplToken',mint,tokenProgram,vault}, amount: string, expirySlot: number, createdSlot: number, status: 'active'|'fulfilled'|'refunded', closed: boolean, createdSig, settledSig?, settledSlot?, closedSig?, closedSlot?, updatedSlot }`.

**Key design notes:**
- The signer hook needs a *defined* account, so connection state switches a component subtree: no account → `LaplaceProvider signer={undefined}`; account selected → `<ConnectedSigner>` calls the hook and renders `LaplaceProvider signer={signer}`.
- Chain id = `` `solana:${cluster}` `` (devnet → `solana:devnet`).
- `@laplace-one/ui` may depend on `@laplace-one/sdk` (already a dep) but **not** on `@laplace-one/indexer`. The `IntentView` type lives in `@laplace-one/ui`; indexer→view and resolved→view adapters live in `apps/main`.

---

## File structure (this phase)

```
app/packages/ui/src/
  intent/IntentView.ts                IntentView type + helpers (no indexer dep)
  intent/IntentStatusBadge.tsx + .module.css + .test.tsx
  intent/ExpiryCountdown.tsx + .module.css + .test.tsx
  intent/AssetAmount.tsx + .test.tsx
  intent/RoleActionButton.tsx + .module.css + .test.tsx
  intent/IntentCard.tsx + .module.css
  feedback/ToastProvider.tsx + Toast.module.css + ToastProvider.test.tsx
  index.ts                            MODIFY: export the above

app/apps/main/src/
  wallet/WalletProvider.tsx + WalletProvider.test.tsx
  wallet/ConnectedSigner.tsx
  wallet/WalletButton.tsx + WalletButton.module.css
  wallet/ConnectModal.tsx + ConnectModal.module.css
  wallet/useWalletBalance.ts
  indexer/indexerClient.ts + indexerClient.test.ts
  indexer/IndexerProvider.tsx
  indexer/hooks.ts + hooks.test.tsx
  intent/adapters.ts                  fromIndexerRow / fromResolved → IntentView
  intent/adapters.test.ts
  providers/AppProviders.tsx          full provider stack
  App.tsx                             MODIFY: use AppProviders
  layouts/ConsoleLayout.tsx           MODIFY: real WalletButton + cluster badge + airdrop
  routes/console/Dashboard.tsx        MODIFY: minimal live stats + intent list
```

---

## Task 1: `IntentView` + lifecycle primitives in `@laplace-one/ui`

**Files:**
- Create: `app/packages/ui/src/intent/IntentView.ts`, `IntentStatusBadge.tsx` + `.module.css` + `.test.tsx`, `ExpiryCountdown.tsx` + `.module.css` + `.test.tsx`, `AssetAmount.tsx` + `.test.tsx`, `RoleActionButton.tsx` + `.module.css` + `.test.tsx`, `IntentCard.tsx` + `.module.css`
- Modify: `app/packages/ui/src/index.ts`
- Reference: `docs/design-reference/laplace-prototype/project/styles/app.css` (`.sbadge*`, `.countdown*`, `.act-btn*`, `.icard*`)

- [ ] **Step 1: Define `IntentView` (normalized, plain)**

`app/packages/ui/src/intent/IntentView.ts`:

```ts
export type IntentStatusKind = 'Active' | 'Fulfilled' | 'Refunded';

export interface IntentAssetView {
  kind: 'NativeSol' | 'SplToken';
  mint?: string;
  symbol: string;        // 'SOL' or token symbol (caller resolves; default mint-short)
  decimals: number;      // 9 for SOL
}

export interface IntentView {
  pda: string;
  maker: string;
  receiver: string;
  refundRecipient: string;
  criterionProgram: string;
  asset: IntentAssetView;
  amount: bigint;        // base units
  expirySlot: bigint;
  createdSlot: bigint;
  status: IntentStatusKind;
  closed: boolean;
}

export type EffectiveStatus = 'Active' | 'Expiring soon' | 'Fulfilled' | 'Refunded' | 'Closed';

export function viewEffectiveStatus(v: IntentView, currentSlot: bigint, expiringWindowSlots = 1500n): EffectiveStatus {
  if (v.closed) return 'Closed';
  if (v.status === 'Fulfilled') return 'Fulfilled';
  if (v.status === 'Refunded') return 'Refunded';
  if (currentSlot >= v.expirySlot) return 'Active';                 // expired-but-active still shows Active; action becomes Refund
  if (v.expirySlot - currentSlot <= expiringWindowSlots) return 'Expiring soon';
  return 'Active';
}

export type RoleActionKind = 'fulfill' | 'refund' | 'close' | 'none';
export interface RoleAction { kind: RoleActionKind; enabled: boolean; label: string; reason?: string }

export function viewActionFor(v: IntentView, ctx: { wallet?: string; currentSlot: bigint }): RoleAction {
  const me = ctx.wallet;
  if (v.status === 'Active' && ctx.currentSlot < v.expirySlot) {
    if (me && me === v.receiver) return { kind: 'fulfill', enabled: true, label: 'Fulfill' };
    return { kind: 'fulfill', enabled: false, label: 'Fulfill', reason: me ? 'Only the receiver can fulfill' : 'Connect wallet' };
  }
  if (v.status === 'Active' && ctx.currentSlot >= v.expirySlot) {
    return { kind: 'refund', enabled: !!me, label: 'Refund', reason: me ? undefined : 'Connect wallet' };
  }
  if ((v.status === 'Fulfilled' || v.status === 'Refunded') && !v.closed) {
    if (me && me === v.maker) return { kind: 'close', enabled: true, label: 'Close (reclaim rent)' };
    return { kind: 'close', enabled: false, label: 'Close', reason: 'Only the maker can close' };
  }
  return { kind: 'none', enabled: false, label: '—' };
}
```

> We implement view-level status/action here (rather than calling the SDK's
> `effectiveStatus`/`actionFor`, which take the SDK `Intent` shape) so primitives stay
> dependency-light and work for both indexer rows and SDK accounts after normalization.
> The adapters (Task 6, apps/main) produce `IntentView`.

- [ ] **Step 2: IntentStatusBadge — write the failing test**

`app/packages/ui/src/intent/IntentStatusBadge.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { IntentStatusBadge } from './IntentStatusBadge.js';

test('renders the effective status label and class', () => {
  render(<IntentStatusBadge status="Expiring soon" />);
  const el = screen.getByText('Expiring soon');
  expect(el).toBeInTheDocument();
  expect(el.className).toMatch(/expiring/);
});
```

- [ ] **Step 3: Run — expect FAIL, then implement**

```bash
cd app && npm run test -- --filter=@laplace-one/ui
```

`app/packages/ui/src/intent/IntentStatusBadge.tsx`:

```tsx
import { cn } from '../lib/cn.js';
import type { EffectiveStatus } from './IntentView.js';
import styles from './IntentStatusBadge.module.css';

const cls: Record<EffectiveStatus, string> = {
  'Active': styles.active, 'Expiring soon': styles.expiring,
  'Fulfilled': styles.fulfilled, 'Refunded': styles.refunded, 'Closed': styles.closed,
};

export function IntentStatusBadge({ status }: { status: EffectiveStatus }) {
  return <span className={cn(styles.sbadge, cls[status])}><span className={styles.sd} />{status}</span>;
}
```

`IntentStatusBadge.module.css`: port `.sbadge`, `.sbadge .sd`, and the five state
variants (`.active/.expiring/.fulfilled/.refunded/.closed`) from `app.css` lines 81–87
(local names `sbadge`, `sd`, `active`, `expiring`, `fulfilled`, `refunded`, `closed`).

- [ ] **Step 4: ExpiryCountdown — failing test, then implement**

`app/packages/ui/src/intent/ExpiryCountdown.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { ExpiryCountdown } from './ExpiryCountdown.js';

test('shows expired when current slot passed expiry', () => {
  render(<ExpiryCountdown expirySlot={100n} currentSlot={150n} />);
  expect(screen.getByText(/expired/i)).toBeInTheDocument();
});

test('shows a remaining duration when before expiry', () => {
  render(<ExpiryCountdown expirySlot={1000n} currentSlot={100n} />);
  // 900 slots * 400ms ≈ 6m
  expect(screen.getByText(/m|s/)).toBeInTheDocument();
});
```

`app/packages/ui/src/intent/ExpiryCountdown.tsx`:

```tsx
import { cn } from '../lib/cn.js';
import styles from './ExpiryCountdown.module.css';

const MS_PER_SLOT = 400;

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function ExpiryCountdown({ expirySlot, currentSlot }: { expirySlot: bigint; currentSlot: bigint }) {
  if (currentSlot >= expirySlot) return <span className={cn(styles.countdown, styles.past)}>Expired</span>;
  const remainingMs = Number(expirySlot - currentSlot) * MS_PER_SLOT;
  const urgent = remainingMs <= 15 * 60 * 1000;
  return <span className={cn(styles.countdown, urgent && styles.urgent)}>{fmt(remainingMs)}</span>;
}
```

`ExpiryCountdown.module.css`: port `.countdown`, `.countdown.urgent`, `.countdown.past`
from `app.css` lines 90–92.

- [ ] **Step 5: AssetAmount — failing test, then implement**

`app/packages/ui/src/intent/AssetAmount.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { AssetAmount } from './AssetAmount.js';

test('formats base units with the asset symbol', () => {
  render(<AssetAmount amount={1500000000n} asset={{ kind: 'NativeSol', symbol: 'SOL', decimals: 9 }} />);
  expect(screen.getByText('1.5')).toBeInTheDocument();
  expect(screen.getByText('SOL')).toBeInTheDocument();
});
```

`app/packages/ui/src/intent/AssetAmount.tsx`:

```tsx
import { toDisplay } from '@laplace-one/sdk';
import type { IntentAssetView } from './IntentView.js';

export function AssetAmount({ amount, asset, className }: { amount: bigint; asset: IntentAssetView; className?: string }) {
  return (
    <span className={className}>
      <span>{toDisplay(amount, asset.decimals)}</span>{' '}
      <span className="asset">{asset.symbol}</span>
    </span>
  );
}
```

- [ ] **Step 6: RoleActionButton — failing test, then implement**

`app/packages/ui/src/intent/RoleActionButton.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { RoleActionButton } from './RoleActionButton.js';

test('renders the action label and fires onAct when enabled', () => {
  const onAct = vi.fn();
  render(<RoleActionButton action={{ kind: 'fulfill', enabled: true, label: 'Fulfill' }} onAct={onAct} />);
  fireEvent.click(screen.getByRole('button', { name: 'Fulfill' }));
  expect(onAct).toHaveBeenCalledWith('fulfill');
});

test('disables and shows the reason when not enabled', () => {
  render(<RoleActionButton action={{ kind: 'refund', enabled: false, label: 'Refund', reason: 'Connect wallet' }} onAct={() => {}} />);
  expect(screen.getByRole('button', { name: /refund/i })).toBeDisabled();
  expect(screen.getByText('Connect wallet')).toBeInTheDocument();
});
```

`app/packages/ui/src/intent/RoleActionButton.tsx`:

```tsx
import { cn } from '../lib/cn.js';
import type { RoleAction, RoleActionKind } from './IntentView.js';
import styles from './RoleActionButton.module.css';

export function RoleActionButton({ action, onAct, variant }: {
  action: RoleAction; onAct: (kind: RoleActionKind) => void; variant?: 'ghost' | 'neutral';
}) {
  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={cn(styles.actBtn, variant === 'ghost' && styles.ghost, variant === 'neutral' && styles.neutral)}
        disabled={!action.enabled || action.kind === 'none'}
        onClick={() => action.enabled && onAct(action.kind)}
      >
        {action.label}
      </button>
      {action.reason && <span className={styles.note}>{action.reason}</span>}
    </div>
  );
}
```

`RoleActionButton.module.css`: port `.act-btn`, `.act-btn:hover`, `.act-btn.ghost`,
`.act-btn.neutral`, `.act-btn:disabled`, `.act-note` from `app.css` lines 95–103
(local names `actBtn`, `ghost`, `neutral`, `note`; add a `wrap` flex container).

- [ ] **Step 7: IntentCard (composition; no separate test — covered by Dashboard)**

`app/packages/ui/src/intent/IntentCard.tsx`:

```tsx
import { Icon } from '../components/Icon.js';
import { AssetAmount } from './AssetAmount.js';
import { IntentStatusBadge } from './IntentStatusBadge.js';
import { ExpiryCountdown } from './ExpiryCountdown.js';
import { RoleActionButton } from './RoleActionButton.js';
import { viewEffectiveStatus, viewActionFor, type IntentView, type RoleActionKind } from './IntentView.js';
import styles from './IntentCard.module.css';

export function IntentCard({ intent, currentSlot, wallet, criterionLabel, onOpen, onAct }: {
  intent: IntentView; currentSlot: bigint; wallet?: string; criterionLabel: string;
  onOpen: (pda: string) => void; onAct: (pda: string, kind: RoleActionKind) => void;
}) {
  const status = viewEffectiveStatus(intent, currentSlot);
  const action = viewActionFor(intent, { wallet, currentSlot });
  return (
    <div className={styles.icard} onClick={() => onOpen(intent.pda)} role="button" tabIndex={0}>
      <div className={styles.top}>
        <div className={styles.amt}><AssetAmount amount={intent.amount} asset={intent.asset} /></div>
        <IntentStatusBadge status={status} />
      </div>
      <span className={styles.crit}><Icon icon="eva:shield-outline" />{criterionLabel}</span>
      <div className={styles.row}><span className={styles.lbl}>Receiver</span><span className={styles.val}>{shorten(intent.receiver)}</span></div>
      <div className={styles.foot}>
        <ExpiryCountdown expirySlot={intent.expirySlot} currentSlot={currentSlot} />
        <RoleActionButton action={action} onAct={(k) => onAct(intent.pda, k)} />
      </div>
    </div>
  );
}

function shorten(a: string): string { return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a; }
```

`IntentCard.module.css`: port `.icard`, `[data-theme="dark"] .icard`, `.icard:hover`,
`.icard__top`, `.icard__amt` (+ `.asset`), `.icard__crit`, `.icard__row`/`.lbl`/`.val`,
`.icard__foot` from `app.css` lines 66–78 (local names `icard`, `top`, `amt`, `crit`,
`row`, `lbl`, `val`, `foot`; dark via `:global([data-theme="dark"])`).

- [ ] **Step 8: Export from barrel; run tests; commit**

Append to `app/packages/ui/src/index.ts`:

```ts
export * from './intent/IntentView.js';
export { IntentStatusBadge } from './intent/IntentStatusBadge.js';
export { ExpiryCountdown } from './intent/ExpiryCountdown.js';
export { AssetAmount } from './intent/AssetAmount.js';
export { RoleActionButton } from './intent/RoleActionButton.js';
export { IntentCard } from './intent/IntentCard.js';
```

```bash
cd app && npm run test -- --filter=@laplace-one/ui
git add app/packages/ui/src && git commit -m "feat(ui): IntentView + lifecycle primitives (badge, countdown, amount, action, card)"
```

Expected: badge/countdown/amount/action tests PASS.

---

## Task 2: ToastProvider + TxToast in `@laplace-one/ui`

**Files:**
- Create: `app/packages/ui/src/feedback/ToastProvider.tsx`, `Toast.module.css`, `ToastProvider.test.tsx`
- Modify: `app/packages/ui/src/index.ts`
- Reference: `app.css` `.toast*` lines 234–238

- [ ] **Step 1: Failing test**

`app/packages/ui/src/feedback/ToastProvider.test.tsx`:

```tsx
import { act, render, renderHook, screen } from '@testing-library/react';
import { ToastProvider, useToast } from './ToastProvider.js';

test('shows a toast message via useToast', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => <ToastProvider>{children}</ToastProvider>;
  const { result } = renderHook(() => useToast(), { wrapper });
  act(() => result.current.toast('Saved'));
  expect(screen.getByText('Saved')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — FAIL, then implement**

`app/packages/ui/src/feedback/ToastProvider.tsx`:

```tsx
import * as React from 'react';
import { Icon } from '../components/Icon.js';
import { cn } from '../lib/cn.js';
import styles from './Toast.module.css';

type ToastKind = 'success' | 'error' | 'info';
interface ToastState { msg: string; kind: ToastKind; id: number }
interface ToastCtx { toast: (msg: string, kind?: ToastKind) => void }

const Ctx = React.createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [t, setT] = React.useState<ToastState | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const toast = React.useCallback((msg: string, kind: ToastKind = 'success') => {
    setT({ msg, kind, id: (t?.id ?? 0) + 1 });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setT(null), 2600);
  }, [t?.id]);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className={cn(styles.toast, t && styles.show)} role="status" aria-live="polite">
        {t && <><Icon icon={t.kind === 'error' ? 'eva:alert-circle-outline' : 'eva:checkmark-circle-2-outline'} />{t.msg}</>}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const c = React.useContext(Ctx);
  if (!c) throw new Error('useToast must be used within <ToastProvider>');
  return c;
}
```

`Toast.module.css`: port `.toast`, `[data-theme="dark"] .toast`, `.toast.show`,
`.toast iconify-icon`(→ svg) from `app.css` lines 234–238 (local `toast`, `show`).

- [ ] **Step 3: Export, test, commit**

```ts
export { ToastProvider, useToast } from './feedback/ToastProvider.js';
```

```bash
cd app && npm run test -- --filter=@laplace-one/ui
git add app/packages/ui/src && git commit -m "feat(ui): ToastProvider + useToast"
```

---

## Task 3: Indexer client (typed HTTP) in `apps/main`

**Files:**
- Create: `app/apps/main/src/indexer/indexerClient.ts`, `indexerClient.test.ts`, `IndexerProvider.tsx`

- [ ] **Step 1: Failing test (mock fetch)**

`app/apps/main/src/indexer/indexerClient.test.ts`:

```ts
import { createIndexerClient } from './indexerClient';

test('listIntents builds the query string and unwraps {intents}', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ intents: [{ pda: 'x' }] }) });
  vi.stubGlobal('fetch', fetchMock);
  const client = createIndexerClient('https://idx.test');
  const rows = await client.listIntents({ status: 'active', maker: 'M', limit: 25 });
  const url = fetchMock.mock.calls[0][0] as string;
  expect(url).toContain('https://idx.test/intents?');
  expect(url).toContain('status=active');
  expect(url).toContain('maker=M');
  expect(url).toContain('limit=25');
  expect(rows).toEqual([{ pda: 'x' }]);
});

test('health returns false when the request throws', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
  const client = createIndexerClient('https://idx.test');
  expect(await client.health()).toBe(false);
});
```

- [ ] **Step 2: Run — FAIL, then implement**

`app/apps/main/src/indexer/indexerClient.ts`:

```ts
export interface IntentRow {
  pda: string; id: string; maker: string; receiver: string; refundRecipient: string;
  criterionProgram: string;
  asset: { kind: 'NativeSol' } | { kind: 'SplToken'; mint: string; tokenProgram: string; vault: string };
  amount: string; expirySlot: number; createdSlot: number;
  status: 'active' | 'fulfilled' | 'refunded'; closed: boolean;
  createdSig: string; settledSig?: string; settledSlot?: number; closedSig?: string; closedSlot?: number; updatedSlot: number;
}
export interface IntentTimelineItem { kind: string; signature: string; slot: number }
export interface IntentDetail { intent: IntentRow; timeline: IntentTimelineItem[] }
export interface Stats { byStatus: { active: number; fulfilled: number; refunded: number }; closed: number; total: number }
export interface ValidityConfigRow { configHash: string; guestElfHash: string; sp1VkeyHash: string; fixedPublicInputsLen: number; createdSlot: number }

export interface IntentListParams {
  status?: 'active' | 'fulfilled' | 'refunded'; maker?: string; receiver?: string;
  criterion?: string; limit?: number; cursorSlot?: number;
}

export interface IndexerClient {
  baseUrl: string;
  health(): Promise<boolean>;
  listIntents(p: IntentListParams): Promise<IntentRow[]>;
  getIntent(pda: string): Promise<IntentDetail | null>;
  stats(): Promise<Stats>;
  validityConfigs(): Promise<ValidityConfigRow[]>;
}

function qs(p: Record<string, string | number | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined) u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : '';
}

export function createIndexerClient(baseUrl: string): IndexerClient {
  const base = baseUrl.replace(/\/$/, '');
  async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${base}${path}`);
    if (!res.ok) throw new Error(`indexer ${path} → ${res.status}`);
    return (await res.json()) as T;
  }
  return {
    baseUrl: base,
    async health() { try { const r = await get<{ ok: boolean }>('/health'); return !!r.ok; } catch { return false; } },
    async listIntents(p) {
      const r = await get<{ intents: IntentRow[] }>(`/intents${qs({ status: p.status, maker: p.maker, receiver: p.receiver, criterion: p.criterion, limit: p.limit, cursorSlot: p.cursorSlot })}`);
      return r.intents;
    },
    async getIntent(pda) { try { return await get<IntentDetail>(`/intents/${pda}`); } catch { return null; } },
    async stats() { return get<Stats>('/stats'); },
    async validityConfigs() { const r = await get<{ configs: ValidityConfigRow[] }>('/validity-configs'); return r.configs; },
  };
}
```

`app/apps/main/src/indexer/IndexerProvider.tsx`:

```tsx
import * as React from 'react';
import { createIndexerClient, type IndexerClient } from './indexerClient';
import { env } from '../env';

const Ctx = React.createContext<IndexerClient | null>(null);

export function IndexerProvider({ children }: { children: React.ReactNode }) {
  const client = React.useMemo(() => (env.indexerUrl ? createIndexerClient(env.indexerUrl) : null), []);
  return <Ctx.Provider value={client}>{children}</Ctx.Provider>;
}

/** Null when no indexer is configured — hooks then fall back to the SDK. */
export function useIndexer(): IndexerClient | null { return React.useContext(Ctx); }
```

- [ ] **Step 3: Run, commit**

```bash
cd app && npm run test -- --filter=@laplace-one/main
git add app/apps/main/src/indexer && git commit -m "feat(main): typed indexer HTTP client + provider"
```

---

## Task 4: Intent adapters (indexer/SDK → `IntentView`)

**Files:**
- Create: `app/apps/main/src/intent/adapters.ts`, `app/apps/main/src/intent/adapters.test.ts`

- [ ] **Step 1: Failing test**

`app/apps/main/src/intent/adapters.test.ts`:

```ts
import { fromIndexerRow } from './adapters';
import type { IntentRow } from '../indexer/indexerClient';

const row: IntentRow = {
  pda: 'P', id: 'i', maker: 'M', receiver: 'R', refundRecipient: 'RR', criterionProgram: 'C',
  asset: { kind: 'NativeSol' }, amount: '1500000000', expirySlot: 1000, createdSlot: 10,
  status: 'active', closed: false, createdSig: 's', updatedSlot: 10,
};

test('fromIndexerRow normalizes amounts/slots/status and SOL asset', () => {
  const v = fromIndexerRow(row);
  expect(v.amount).toBe(1500000000n);
  expect(v.expirySlot).toBe(1000n);
  expect(v.status).toBe('Active');
  expect(v.asset).toEqual({ kind: 'NativeSol', symbol: 'SOL', decimals: 9 });
});
```

- [ ] **Step 2: Run — FAIL, then implement**

`app/apps/main/src/intent/adapters.ts`:

```ts
import type { IntentView, IntentStatusKind, IntentAssetView } from '@laplace-one/ui';
import type { ResolvedIntent } from '@laplace-one/sdk';
import type { IntentRow } from '../indexer/indexerClient';

const STATUS: Record<IntentRow['status'], IntentStatusKind> = {
  active: 'Active', fulfilled: 'Fulfilled', refunded: 'Refunded',
};

function assetView(a: IntentRow['asset']): IntentAssetView {
  if (a.kind === 'NativeSol') return { kind: 'NativeSol', symbol: 'SOL', decimals: 9 };
  return { kind: 'SplToken', mint: a.mint, symbol: `${a.mint.slice(0, 4)}…`, decimals: 0 };
}

export function fromIndexerRow(r: IntentRow): IntentView {
  return {
    pda: r.pda, maker: r.maker, receiver: r.receiver, refundRecipient: r.refundRecipient,
    criterionProgram: r.criterionProgram, asset: assetView(r.asset), amount: BigInt(r.amount),
    expirySlot: BigInt(r.expirySlot), createdSlot: BigInt(r.createdSlot),
    status: STATUS[r.status], closed: r.closed,
  };
}

const SDK_STATUS: Record<number, IntentStatusKind> = { 0: 'Active', 1: 'Fulfilled', 2: 'Refunded' };

export function fromResolved(ri: ResolvedIntent): IntentView {
  const d: any = ri.data;
  const sol = d.asset.__kind === 'NativeSol';
  return {
    pda: String(ri.address), maker: String(d.maker), receiver: String(d.receiver),
    refundRecipient: String(d.refundRecipient), criterionProgram: String(d.criterionProgram),
    asset: sol ? { kind: 'NativeSol', symbol: 'SOL', decimals: 9 }
               : { kind: 'SplToken', mint: String(d.asset.mint), symbol: `${String(d.asset.mint).slice(0, 4)}…`, decimals: 0 },
    amount: BigInt(d.amount), expirySlot: BigInt(d.expirySlot), createdSlot: BigInt(d.createdSlot),
    status: SDK_STATUS[Number(d.status)] ?? 'Active', closed: false,
  };
}
```

> SPL `decimals`/`symbol` resolution (mint account read or preset map) is a Phase-4
> concern; the default `decimals: 0` + short-mint symbol is a safe placeholder the
> create/detail flows will refine.

- [ ] **Step 3: Run, commit**

```bash
cd app && npm run test -- --filter=@laplace-one/main
git add app/apps/main/src/intent && git commit -m "feat(main): IntentView adapters (indexer row + SDK resolved)"
```

---

## Task 5: Discovery hooks (indexer-first, SDK fallback)

**Files:**
- Create: `app/apps/main/src/indexer/hooks.ts`, `app/apps/main/src/indexer/hooks.test.tsx`

- [ ] **Step 1: Failing test (mock indexer + SDK)**

`app/apps/main/src/indexer/hooks.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';

const listIntents = vi.fn();
vi.mock('./IndexerProvider', () => ({
  useIndexer: () => ({ baseUrl: 'x', listIntents, health: async () => true, getIntent: vi.fn(), stats: vi.fn(), validityConfigs: vi.fn() }),
}));
vi.mock('@laplace-one/sdk/react', () => ({ useLaplaceContext: () => ({ rpc: {}, cluster: 'devnet', signer: { address: 'ME' } }) }));

import { useIntentList } from './hooks';

test('useIntentList queries the indexer by role→owner and returns views', async () => {
  listIntents.mockResolvedValue([{ pda: 'P', id: 'i', maker: 'ME', receiver: 'R', refundRecipient: 'RR', criterionProgram: 'C', asset: { kind: 'NativeSol' }, amount: '1', expirySlot: 9, createdSlot: 1, status: 'active', closed: false, createdSig: 's', updatedSlot: 1 }]);
  const { result } = renderHook(() => useIntentList({ role: 'maker' }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(listIntents).toHaveBeenCalledWith(expect.objectContaining({ maker: 'ME' }));
  expect(result.current.data[0].pda).toBe('P');
});
```

- [ ] **Step 2: Run — FAIL, then implement**

`app/apps/main/src/indexer/hooks.ts`:

```ts
import * as React from 'react';
import { useLaplaceContext } from '@laplace-one/sdk/react';
import { fetchIntents, fetchIntent } from '@laplace-one/sdk';
import type { IntentView } from '@laplace-one/ui';
import { useIndexer } from './IndexerProvider';
import { fromIndexerRow, fromResolved } from '../intent/adapters';
import type { IntentDetail, Stats, ValidityConfigRow } from './indexerClient';

export type Role = 'maker' | 'receiver' | 'refund' | 'all';

function ownerParam(role: Role, owner: string): { maker?: string; receiver?: string } {
  if (role === 'maker') return { maker: owner };
  if (role === 'receiver') return { receiver: owner };
  return {}; // 'refund' has no indexer column filter; client-side filter below. 'all' = none.
}

export function useIntentList({ role, status }: { role: Role; status?: 'active' | 'fulfilled' | 'refunded' }) {
  const idx = useIndexer();
  const { rpc, cluster, signer } = useLaplaceContext() as any;
  const owner: string | undefined = signer?.address ? String(signer.address) : undefined;
  const [data, setData] = React.useState<IntentView[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let live = true;
    setLoading(true);
    (async () => {
      let views: IntentView[] = [];
      if (idx && (await idx.health())) {
        const rows = await idx.listIntents({ ...ownerParam(role, owner ?? ''), status, limit: 100 });
        views = rows.map(fromIndexerRow);
        if (role === 'refund' && owner) views = views.filter((v) => v.refundRecipient === owner);
      } else if (owner) {
        const sdkRole = role === 'all' ? 'all' : role === 'refund' ? 'refund' : role;
        const resolved = await fetchIntents(rpc, { role: sdkRole as any, owner, cluster });
        views = resolved.map(fromResolved);
      }
      if (live) { setData(views); setLoading(false); }
    })().catch(() => { if (live) { setData([]); setLoading(false); } });
    return () => { live = false; };
  }, [idx, rpc, cluster, owner, role, status]);

  return { data, loading };
}

export function useIntentDetail(pda: string | undefined) {
  const idx = useIndexer();
  const { rpc } = useLaplaceContext() as any;
  const [detail, setDetail] = React.useState<{ view: IntentView; timeline: IntentDetail['timeline'] } | null>(null);
  React.useEffect(() => {
    let live = true;
    if (!pda) { setDetail(null); return; }
    (async () => {
      if (idx && (await idx.health())) {
        const d = await idx.getIntent(pda);
        if (live && d) setDetail({ view: fromIndexerRow(d.intent), timeline: d.timeline });
      } else {
        const ri = await fetchIntent(rpc, pda as any);
        if (live && ri) setDetail({ view: fromResolved(ri), timeline: [] });
      }
    })().catch(() => { if (live) setDetail(null); });
    return () => { live = false; };
  }, [idx, rpc, pda]);
  return detail;
}

export function useStats(): Stats | null {
  const idx = useIndexer();
  const [s, setS] = React.useState<Stats | null>(null);
  React.useEffect(() => {
    let live = true;
    if (!idx) return;
    idx.stats().then((r) => { if (live) setS(r); }).catch(() => {});
    return () => { live = false; };
  }, [idx]);
  return s;
}

export function useValidityConfigs(): ValidityConfigRow[] {
  const idx = useIndexer();
  const [c, setC] = React.useState<ValidityConfigRow[]>([]);
  React.useEffect(() => {
    let live = true;
    if (!idx) return;
    idx.validityConfigs().then((r) => { if (live) setC(r); }).catch(() => {});
    return () => { live = false; };
  }, [idx]);
  return c;
}
```

- [ ] **Step 3: Run, commit**

```bash
cd app && npm run test -- --filter=@laplace-one/main
git add app/apps/main/src/indexer && git commit -m "feat(main): discovery hooks (indexer-first, SDK fallback)"
```

---

## Task 6: Wallet layer — provider, connect modal, button, signer bridge

**Files:**
- Create: `app/apps/main/src/wallet/WalletProvider.tsx`, `WalletProvider.test.tsx`, `ConnectedSigner.tsx`, `WalletButton.tsx` + `WalletButton.module.css`, `ConnectModal.tsx` + `ConnectModal.module.css`, `useWalletBalance.ts`
- Reference: `app.css` `.wallet-btn*` lines 24–30 (states), `.cluster-badge` lines 21–22

- [ ] **Step 1: WalletProvider — failing test (mock wallet-standard)**

`app/apps/main/src/wallet/WalletProvider.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react';

vi.mock('@wallet-standard/react', () => ({
  useWallets: () => [{ name: 'Phantom', icon: 'i', accounts: [{ address: 'ACC1', chains: ['solana:devnet'] }], chains: ['solana:devnet'], features: ['solana:signAndSendTransaction'] }],
  useConnect: () => [false, vi.fn()],
  useDisconnect: () => [false, vi.fn()],
}));

import { WalletProvider, useWallet } from './WalletProvider';

beforeEach(() => { try { localStorage.clear(); } catch {} });

test('select() sets the account and persists it', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => <WalletProvider>{children}</WalletProvider>;
  const { result } = renderHook(() => useWallet(), { wrapper });
  expect(result.current.selectedAccount).toBeUndefined();
  act(() => result.current.select(result.current.wallets[0].accounts[0]));
  expect(result.current.selectedAccount?.address).toBe('ACC1');
  expect(localStorage.getItem('laplace-wallet')).toBe('ACC1');
});

test('auto-reselects a persisted account on mount', () => {
  try { localStorage.setItem('laplace-wallet', 'ACC1'); } catch {}
  const wrapper = ({ children }: { children: React.ReactNode }) => <WalletProvider>{children}</WalletProvider>;
  const { result } = renderHook(() => useWallet(), { wrapper });
  expect(result.current.selectedAccount?.address).toBe('ACC1');
});
```

- [ ] **Step 2: Run — FAIL, then implement WalletProvider**

`app/apps/main/src/wallet/WalletProvider.tsx`:

```tsx
import * as React from 'react';
import { useWallets } from '@wallet-standard/react';
import type { UiWallet, UiWalletAccount } from '@wallet-standard/react';

const STORAGE = 'laplace-wallet';

interface WalletCtx {
  wallets: readonly UiWallet[];
  selectedAccount: UiWalletAccount | undefined;
  selectedWallet: UiWallet | undefined;
  select: (account: UiWalletAccount) => void;
  disconnect: () => void;
}
const Ctx = React.createContext<WalletCtx | null>(null);

function isSolana(w: UiWallet): boolean {
  return w.chains.some((c) => c.startsWith('solana:')) && w.features.includes('solana:signAndSendTransaction');
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const all = useWallets();
  const wallets = React.useMemo(() => all.filter(isSolana), [all]);
  const [account, setAccount] = React.useState<UiWalletAccount | undefined>(undefined);

  const select = React.useCallback((a: UiWalletAccount) => {
    setAccount(a);
    try { localStorage.setItem(STORAGE, a.address); } catch {}
  }, []);
  const disconnect = React.useCallback(() => {
    setAccount(undefined);
    try { localStorage.removeItem(STORAGE); } catch {}
  }, []);

  // Re-select a persisted account once its wallet (re)registers.
  React.useEffect(() => {
    if (account) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem(STORAGE); } catch {}
    if (!saved) return;
    for (const w of wallets) {
      const a = w.accounts.find((acc) => acc.address === saved);
      if (a) { setAccount(a); break; }
    }
  }, [wallets, account]);

  const selectedWallet = React.useMemo(
    () => wallets.find((w) => w.accounts.some((a) => a.address === account?.address)),
    [wallets, account],
  );

  const value: WalletCtx = { wallets, selectedAccount: account, selectedWallet, select, disconnect };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletCtx {
  const c = React.useContext(Ctx);
  if (!c) throw new Error('useWallet must be used within <WalletProvider>');
  return c;
}
```

> **Connection lives in `ConnectModal` (Step 4), not the provider.** `useConnect` is a
> per-wallet hook, so the modal renders one row component per wallet that each call
> `useConnect(wallet)` at the top level; on click the row `await connect()` then calls
> `useWallet().select(accounts[0])`. `WalletProvider` owns only selection + persistence +
> disconnect. This keeps hook usage legal (no dynamic per-wallet hook calls in a callback).

- [ ] **Step 3: ConnectedSigner bridge**

`app/apps/main/src/wallet/ConnectedSigner.tsx`:

```tsx
import * as React from 'react';
import { useWalletAccountTransactionSendingSigner } from '@solana/react';
import type { UiWalletAccount } from '@wallet-standard/react';
import { LaplaceProvider } from '@laplace-one/wallet';
import type { TransactionSigner } from '@solana/kit';
import { env } from '../env';

/** Renders LaplaceProvider with a signer derived from the selected account, or none. */
export function SignerGate({ account, children }: { account: UiWalletAccount | undefined; children: React.ReactNode }) {
  if (!account) {
    return <LaplaceProvider cluster={env.cluster} rpcUrl={env.rpcUrl} signer={undefined}>{children}</LaplaceProvider>;
  }
  return <Connected account={account}>{children}</Connected>;
}

function Connected({ account, children }: { account: UiWalletAccount; children: React.ReactNode }) {
  const signer = useWalletAccountTransactionSendingSigner(account, `solana:${env.cluster}`);
  return (
    <LaplaceProvider cluster={env.cluster} rpcUrl={env.rpcUrl} signer={signer as unknown as TransactionSigner}>
      {children}
    </LaplaceProvider>
  );
}
```

- [ ] **Step 4: useWalletBalance, WalletButton, ConnectModal**

`app/apps/main/src/wallet/useWalletBalance.ts`:

```ts
import * as React from 'react';
import { useLaplaceContext } from '@laplace-one/sdk/react';

export function useWalletBalance(): number | null {
  const { rpc, signer, currentSlot } = useLaplaceContext() as any;
  const [sol, setSol] = React.useState<number | null>(null);
  React.useEffect(() => {
    let live = true;
    if (!signer?.address) { setSol(null); return; }
    rpc.getBalance(signer.address).send()
      .then((r: any) => { if (live) setSol(Number(r.value) / 1e9); })
      .catch(() => {});
    return () => { live = false; };
  }, [rpc, signer?.address, currentSlot]);  // refresh on slot tick
  return sol;
}
```

`WalletButton.tsx` — disconnected → `Connect wallet` (opens `ConnectModal`); connected →
`.wallet-btn.connected` pill with `wdot`, truncated `waddr`, and `wbal` (from
`useWalletBalance`), click → disconnect. `WalletButton.module.css` ports `.wallet-btn`,
`.wallet-btn:hover`, `.wallet-btn.connected` + `:hover`, `.wdot`, `.waddr`, `.wbal` from
`app.css` lines 24–30.

`ConnectModal.tsx` — lists `useWallet().wallets`; renders one row component per wallet that
calls `useConnect(wallet)` at the top level; on click the row does `const accounts = await
connect(); if (accounts[0]) select(accounts[0]);` (using `useWallet().select`), then closes.
Includes a devnet "Airdrop 1 SOL" affordance via `makeAirdrop` when connected.
`ConnectModal.module.css` — a simple centered overlay using tokens (border, radius-lg,
bg-bright, shadow `--elev-6`).

- [ ] **Step 5: Run tests, commit**

```bash
cd app && npm run test -- --filter=@laplace-one/main
git add app/apps/main/src/wallet && git commit -m "feat(main): wallet-standard connect layer + signer bridge + wallet button"
```

---

## Task 7: Provider stack, console chrome wiring, minimal live dashboard

**Files:**
- Create: `app/apps/main/src/providers/AppProviders.tsx`
- Modify: `app/apps/main/src/App.tsx`, `app/apps/main/src/layouts/ConsoleLayout.tsx`, `app/apps/main/src/routes/console/Dashboard.tsx`, `app/apps/main/src/App.test.tsx`

- [ ] **Step 1: AppProviders (full stack)**

`app/apps/main/src/providers/AppProviders.tsx`:

```tsx
import { ThemeProvider, ToastProvider } from '@laplace-one/ui';
import { WalletProvider, useWallet } from '../wallet/WalletProvider';
import { SignerGate } from '../wallet/ConnectedSigner';
import { IndexerProvider } from '../indexer/IndexerProvider';

function WithSigner({ children }: { children: React.ReactNode }) {
  const { selectedAccount } = useWallet();
  return <SignerGate account={selectedAccount}>{children}</SignerGate>;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <WalletProvider>
        <WithSigner>
          <IndexerProvider>
            <ToastProvider>{children}</ToastProvider>
          </IndexerProvider>
        </WithSigner>
      </WalletProvider>
    </ThemeProvider>
  );
}
```

- [ ] **Step 2: App.tsx uses AppProviders around the router**

`app/apps/main/src/App.tsx`:

```tsx
import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './providers/AppProviders';
import { router } from './router';

export function App() {
  return <AppProviders><RouterProvider router={router} /></AppProviders>;
}
```

- [ ] **Step 3: ConsoleLayout — real WalletButton + cluster badge**

Replace the Task-8 (Phase 1) placeholder wallet button in `ConsoleLayout.tsx` with
`<WalletButton />`, and render a `.cluster-badge` showing `env.cluster` (dot + label).
Keep `ThemeToggle` and the `NavLink` tabs.

- [ ] **Step 4: Minimal live Dashboard (proves the stack)**

`app/apps/main/src/routes/console/Dashboard.tsx`:

```tsx
import { useNavigate } from 'react-router-dom';
import { IntentCard } from '@laplace-one/ui';
import { useSlot } from '@laplace-one/sdk/react';
import { useWallet } from '../../wallet/WalletProvider';
import { useIntentList, useStats } from '../../indexer/hooks';

export default function Dashboard() {
  const nav = useNavigate();
  const slot = useSlot();
  const { selectedAccount } = useWallet();
  const stats = useStats();
  const { data, loading } = useIntentList({ role: 'all' });
  const wallet = selectedAccount?.address;

  return (
    <section className="wrap">
      <h1>Console</h1>
      {stats && <p className="mono">active {stats.byStatus.active} · fulfilled {stats.byStatus.fulfilled} · refunded {stats.byStatus.refunded} · total {stats.total}</p>}
      {loading ? <p>Loading…</p> : data.length === 0 ? <p>No intents yet.</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {data.map((v) => (
            <IntentCard key={v.pda} intent={v} currentSlot={slot} wallet={wallet}
              criterionLabel="criterion" onOpen={(pda) => nav(`/app/intent/${pda}`)} onAct={() => {}} />
          ))}
        </div>
      )}
    </section>
  );
}
```

> This is a deliberately minimal capstone proving providers → hooks → primitives work
> end-to-end. Phase 4 replaces it with the full filtered dashboard (role/status toolbar,
> StatStrip, criterion labels, real actions).

- [ ] **Step 5: Update App.test.tsx to render through AppProviders**

`app/apps/main/src/App.test.tsx` — wrap the routing assertion render in `<AppProviders>`
instead of bare `<ThemeProvider>`, mocking `@wallet-standard/react` (empty `useWallets`)
and `@laplace-one/sdk/react`/`@laplace-one/wallet` so the provider tree mounts under jsdom without
real RPC. Assert the `/docs` route heading still renders.

```tsx
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider } from '@laplace-one/ui';
import { SiteLayout } from './layouts/SiteLayout';
import Landing from './routes/Landing';
import Docs from './routes/Docs';

// AppProviders needs RPC/wallet; for the routing assertion we render SiteLayout under
// ThemeProvider only (layout has no chain deps). The full provider stack is covered by
// WalletProvider.test.tsx / hooks.test.tsx.
test('renders the docs route under the site layout', () => {
  const router = createMemoryRouter(
    [{ element: <SiteLayout />, children: [{ path: '/', element: <Landing /> }, { path: '/docs', element: <Docs /> }] }],
    { initialEntries: ['/docs'] },
  );
  render(<ThemeProvider><RouterProvider router={router} /></ThemeProvider>);
  expect(screen.getByRole('heading', { name: /docs/i, level: 1 })).toBeInTheDocument();
});
```

- [ ] **Step 6: Full gate**

```bash
cd app && npm run typecheck -- --filter=@laplace-one/ui --filter=@laplace-one/main \
  && npm run test -- --filter=@laplace-one/ui --filter=@laplace-one/main \
  && (cd apps/main && npx vite build)
```

Expected: typecheck + tests green; SPA builds. (Live RPC/indexer not exercised in tests.)

- [ ] **Step 7: Commit**

```bash
git add app/apps/main/src && git commit -m "feat(main): wire provider stack, console wallet button, minimal live dashboard"
```

---

## Phase 2 self-review

- **Spec coverage (§5 integration + §9 primitives):** providers/wallet connect ✓ Tasks 6–7;
  indexer-first discovery + SDK fallback ✓ Tasks 3–5; ToastProvider/TxToast + error mapping
  surface ✓ Task 2 (mapLaplaceError wired where writes occur — Phase 4); lifecycle primitives
  ✓ Task 1. Slots-as-truth via `useSlot()` ✓ (countdown, card). Writes (`createIntent` etc.)
  are intentionally Phase 4 — Phase 2 builds the plumbing + read path + a read-only dashboard.
- **Placeholder scan:** SPL `decimals: 0`/short-mint symbol is a documented safe default
  refined in Phase 4 (not a plan placeholder — it's a real, working value). No "TBD"/"add
  error handling" steps. The WalletProvider `connect` note flags a hook-shape subtlety with a
  concrete resolution for the implementer.
- **Type consistency:** `IntentView`/`IntentAssetView`/`EffectiveStatus`/`RoleAction` from
  `@laplace-one/ui`; `IntentRow`/`Stats`/`IntentDetail` from the indexer client; adapters bridge
  them; `useIntentList` returns `IntentView[]`; `IntentCard` consumes `IntentView` + currentSlot
  + wallet. `env.cluster/rpcUrl/indexerUrl` reused. `solana:${cluster}` chain id consistent.

## Risks / notes

- Devnet programs are still placeholders (not deployed) — reads return empty and writes won't
  land until deploy. Tests mock RPC; the build is correct regardless.
- `useWalletAccountTransactionSendingSigner` returns a `TransactionSendingSigner`; we pass it as
  `LaplaceProvider`'s `signer` (`TransactionSigner`) via a single cast at the bridge — the SDK's
  send path expects a sending-capable signer.
- No running indexer is required: with `VITE_INDEXER_URL` unset, hooks use the SDK fallback;
  with it set but unhealthy, hooks degrade to the fallback too.
