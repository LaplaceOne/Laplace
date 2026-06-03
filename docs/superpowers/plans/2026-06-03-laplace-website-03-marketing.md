# Laplace Website — Phase 3: Marketing Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four marketing pages — Landing (`/`), Docs (`/docs`), Lab (`/lab`), Registry (`/registry`) — as faithful React ports of the design prototype, wired to real data (live stats, program IDs, criterion registry), replacing the Phase 1 placeholder routes.

**Architecture:** Each page is a route component composing section sub-components, with co-located CSS Modules that port the relevant `laplace.css` rules. Cross-page chrome (Nav/Footer) and the design system (tokens, `Reveal`, `Button`, `ArrowLink`, `CodeBlock`, `Icon`, `AmbientBackground`, `CursorRing`) already exist from Phases 1–2. New shared marketing atoms (`PageHead`, `SecHead`, `Cta`, `Eyebrow`) live in `apps/main/src/marketing`. Inline SVG diagrams become dedicated components. Interactive logic (docs scroll-spy, registry catalog filtering) is TDD'd.

**Tech Stack:** Builds on Phases 1–2. No new dependencies.

**Prereq:** Phases 1–2 complete and green.

**Design source of truth (port faithfully — preserve structure, copy, and CSS values):**
- Markup + inline SVGs: `docs/design-reference/laplace-prototype/project/index.html`, `docs.html`, `lab.html`, `registry.html`.
- Section CSS: `docs/design-reference/laplace-prototype/project/styles/laplace.css`.
- Catalog data shape + behavior: `…/project/registry.js` (illustrative mock — **replace with real registry data**).
- Design intent: `…/chats/chat1.md` (line-art aesthetic, exactly two "Solana" mentions on Landing, statically-visible diagram strokes, 5 trust tiers).

**Real data wiring (replace prototype mock data):**
- Live stats (Landing §Live stats): `useStats()` from `apps/main/src/indexer/hooks` (null when no indexer → show `—` or fallback copy).
- Program IDs (Docs §Program IDs; Landing dev table): `getCluster(env.cluster).programs` from `@laplace/registry`.
- Criterion catalog (Registry; Docs criteria sections; Landing criteria): `criteria`, `getCriterion`, `tierOf`, `guests` from `@laplace/registry` (today: hashlock + validity, both `official`; `guests` empty). Prototype's extra illustrative entries (TWAP Oracle, etc.) are **omitted**; the catalog reflects real registry contents, with the tier legend + trust model + submission pipeline as static educational content.

**Conventions:** `apps/main` imports extensionless; CSS Modules co-located; wrap reveal-on-scroll blocks in `<Reveal>` from `@laplace/ui`; in-page/section links use react-router `<Link>`; hash anchors use `<a href="#id">` with `scroll-margin-top` on section targets; external links `target="_blank" rel="noopener"`.

---

## File structure (this phase)

```
apps/main/src/
  marketing/
    Eyebrow.tsx + Eyebrow.module.css          tick + label
    PageHead.tsx + PageHead.module.css        sub-page header (eyebrow + h1 + intro)
    SecHead.tsx + SecHead.module.css          label + h2 + sub
    Cta.tsx + Cta.module.css                  cta-line + h2 + p + buttons
  components/diagrams/
    LifecycleDiagram.tsx                      Landing hero SVG (intent lifecycle)
    StateMachineDiagram.tsx                   Docs §lifecycle SVG
    ArchitectureDiagram.tsx                   Lab architecture SVG
  content/
    site.ts                                   footer links, future-criteria list, copy constants
    snippets.ts                               syntax-highlighted code samples (create-intent.ts, npm i)
  routes/
    Landing.tsx + Landing.module.css
    Docs.tsx + Docs.module.css + useScrollSpy.ts + Docs.test.tsx
    Lab.tsx + Lab.module.css
    Registry.tsx + Registry.module.css
    registry/RegistryCatalog.tsx + RegistryCatalog.module.css + RegistryCatalog.test.tsx
```

---

## Task 1: Shared marketing atoms (Eyebrow, PageHead, SecHead, Cta) + site content

**Files:**
- Create: `app/apps/main/src/marketing/Eyebrow.tsx` + `.module.css`, `PageHead.tsx` + `.module.css`, `SecHead.tsx` + `.module.css`, `Cta.tsx` + `.module.css`
- Create: `app/apps/main/src/content/site.ts`, `app/apps/main/src/content/snippets.ts`
- Reference: `laplace.css` `.eyebrow`/`.tick` (lines 70–71), `.page-head*` (78–82), `.sec-head`/`.sec-title`/`.sec-sub` (124–127), `.cta*` (214–219)

- [ ] **Step 1: Eyebrow**

`app/apps/main/src/marketing/Eyebrow.tsx`:

```tsx
import styles from './Eyebrow.module.css';

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className={styles.eyebrow}><span className={styles.tick} />{children}</span>;
}
```

`Eyebrow.module.css`: port `.eyebrow` (inline-flex, gap, margin-bottom) + `.eyebrow .tick`
(22×1px primary bar) from `laplace.css` lines 70–71. Use a `.label`-styled inner span
(mono, uppercase, tracking) — reuse the global `.label` class from `@laplace/ui` base.

- [ ] **Step 2: PageHead, SecHead, Cta**

`PageHead.tsx` — `<header class="page-head">` with `<Eyebrow>`, an `<h1>` (supports an
`<em>` accent via a `title`/`accent` prop or `children`), and an intro `<p>`. Props:
`{ eyebrow: ReactNode; title: ReactNode; children?: ReactNode }`. `PageHead.module.css`
ports `.page-head`, `.page-head .eyebrow`, `.page-head h1`/`h1 em`, `.page-head p`.

`SecHead.tsx` — `<div class="sec-head">` (grid 1fr/1.4fr) with a `.label`, `<h2 class="sec-title">`,
and a `.sec-sub` paragraph. Props `{ label: string; title: ReactNode; sub?: ReactNode }`.
`SecHead.module.css` ports `.sec-head`, `.sec-title`, `.sec-sub` (lines 124–127) + the
900px collapse.

`Cta.tsx` — centered `<section class="cta">` with `.cta-line`, `<h2>` (em accent), `<p>`,
and a `.cta-btns` row of `<Button>`s. Props `{ title; sub; buttons: ReactNode }`.
`Cta.module.css` ports `.cta*` (lines 214–219).

- [ ] **Step 3: Site content + snippets**

`app/apps/main/src/content/site.ts` — export the footer link groups, the "future criteria"
list (`Signature`, `Encrypted disclosure`, `Cross-chain lock proof`, `Multi-criterion`),
the app-family entries (Console live · Bridge roadmap · Disclosure roadmap), and the two
exact "Solana" copy strings (hero sub + closing CTA) from `chat1.md`'s final decisions.

`app/apps/main/src/content/snippets.ts` — export the `create-intent.ts` sample and the
`npm i @laplace/sdk` string used by Landing §developers and Docs §quickstart, as arrays of
`{ text, cls }` tokens (cls ∈ `c|k|s|n`) matching the `CodeBlock` syntax spans, ported from
the reference `index.html`/`docs.html` `<pre class="code__body">` content.

- [ ] **Step 4: Typecheck + commit (no behavior tests for pure atoms)**

```bash
cd app && npm run typecheck -- --filter=@laplace/main
git add app/apps/main/src/marketing app/apps/main/src/content
git commit -m "feat(main): shared marketing atoms (Eyebrow/PageHead/SecHead/Cta) + site content"
```

Expected: typecheck passes.

---

## Task 2: Landing page (`/`)

**Files:**
- Create: `app/apps/main/src/components/diagrams/LifecycleDiagram.tsx`
- Modify: `app/apps/main/src/routes/Landing.tsx`; Create `Landing.module.css`
- Reference: `index.html` (full), `laplace.css` `.hero*`/`.principles`/`.principle*`/`.steps`/`.step*`/`.conds`/`.cond*`/`.build-grid`/`.code*`/`.install*`/`.diagram*` and the inline hero `<svg class="diagram">`

- [ ] **Step 1: LifecycleDiagram**

`LifecycleDiagram.tsx` — port the hero `<svg class="diagram" viewBox="0 0 480 400">` from
`index.html` into a React SVG component, converting attributes to JSX (`stroke-width`→
`strokeWidth`, `class`→`className`, etc.) and preserving every node/path/label. Keep the
strokes **statically visible** (no draw-on animation gating — per `chat1.md` final
decision). The `.diagram` CSS classes (`.box`, `.box-accent`, `.ln`, `.ln-accent`, `.dot`,
`.t-label`, `.t-mono`, `.t-title`, etc.) are ported in `Landing.module.css` from
`laplace.css` lines 94–115 — but apply them globally (these classes are referenced by the
SVG); put the `.diagram*` rules in a plain imported CSS (not a module) at
`app/apps/main/src/components/diagrams/diagram.css`, imported once, so the SVG class
strings match. Respect `prefers-reduced-motion` (pulse-dot animation off).

- [ ] **Step 2: Landing sections**

Rewrite `app/apps/main/src/routes/Landing.tsx` to compose, top-to-bottom (each major block
wrapped in `<Reveal>`):
1. **Hero** (`header.hero`, 2-col): left `<Eyebrow>Intent-based atomic settlement · Solana · Devnet</Eyebrow>`, `<h1>` "Escrow that releases <em>only on proof</em>, refunds on expiry.", the exact hero-sub Solana string from `content/site.ts`, CTA row (`<Button variant="accent" as="a" href="/app">Launch console</Button>` + `<ArrowLink href="/docs">Read the docs</ArrowLink>`); right `<LifecycleDiagram/>`.
2. **Guarantees** (`<SecHead>` + `.principles` 3-col: Non-custodial / Atomic / Refund-guaranteed; each `.principle` = `.pico` icon + h3 + p).
3. **How it works** (`<SecHead>` + `.steps` 3 `.step` rows: 01 Create / 02 Fulfill / 03 Refund or close).
4. **Pluggable criteria** (`<SecHead>` + 2-cell criteria grid for Hashlock + Validity, label "official"; then a `<Reveal>` paragraph naming the future criteria from `content/site.ts`).
5. **The app family** (`<SecHead>` + 3 product cards: Main site & console [Live · devnet → `/app`], Bridge [Roadmap], Disclosure [Roadmap]).
6. **For developers** (`.build-grid` 2-col: left label/title/sub + buttons "SDK quickstart"/GitHub; right `<CodeBlock filename="create-intent.ts">` rendering `snippets.createIntent`).
7. **Live protocol stats** (`<SecHead>` + a 4-col stat strip from `useStats()`: created≈`total`, fulfilled=`byStatus.fulfilled`, refunded=`byStatus.refunded`, active=`byStatus.active`; show `—` when stats null).
8. **CTA** (`<Cta>` with the exact closing Solana string from `content/site.ts`, buttons Launch console + View on GitHub).

`Landing.module.css` ports `.hero`/`.hero-grid`/`.hero-title`/`.hero-sub`/`.hero-cta`,
`section.block`, `.principles`/`.principle*`/`.pico`, `.steps`/`.step*`, the criteria grid
(`.conds`/`.cond*` adapted to 2 cells), the product cards, `.build-grid`, and a stat strip
(reuse `.statline`/`.stat` styling from the reference) — all from `laplace.css` (lines
67–168 region) preserving exact values.

- [ ] **Step 3: Render smoke test**

`app/apps/main/src/routes/Landing.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { IndexerProvider } from '../indexer/IndexerProvider';
import Landing from './Landing';

// useStats reads useIndexer(); with VITE_INDEXER_URL unset it is null → stats render '—'.
test('Landing renders hero and key section headings', () => {
  render(<MemoryRouter><IndexerProvider><Landing /></IndexerProvider></MemoryRouter>);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/escrow that releases/i);
  expect(screen.getByText(/how it works/i)).toBeInTheDocument();
  expect(screen.getByText(/pluggable criteria/i)).toBeInTheDocument();
});
```

> `useStats` only calls the indexer when one is configured; under test it stays null, so no
> network. If `Landing` calls `useSlot()` indirectly, wrap with the SDK context — but the
> Landing sections above use only `useStats`, which needs just `IndexerProvider`.

- [ ] **Step 4: Run, commit**

```bash
cd app && npm run test -- --filter=@laplace/main && (cd apps/main && npx vite build)
git add app/apps/main/src/routes/Landing.tsx app/apps/main/src/routes/Landing.module.css app/apps/main/src/routes/Landing.test.tsx app/apps/main/src/components/diagrams
git commit -m "feat(main): Landing page (hero + lifecycle diagram, guarantees, criteria, app family, SDK, live stats, CTA)"
```

---

## Task 3: Docs page (`/docs`) with sticky scroll-spy rail

**Files:**
- Create: `app/apps/main/src/components/diagrams/StateMachineDiagram.tsx`, `app/apps/main/src/routes/useScrollSpy.ts`, `app/apps/main/src/routes/Docs.test.tsx`
- Modify: `app/apps/main/src/routes/Docs.tsx`; Create `Docs.module.css`
- Reference: `docs.html` (full), `laplace.css` `.deftable`/`.defrow*` (182–186), `.spec*`, `.states`/`.state-chip*` (188–197), `.warn-box`, `.conds`/`.cond*`, `.install*`, `.code*`

- [ ] **Step 1: useScrollSpy — failing test**

`app/apps/main/src/routes/useScrollSpy.ts` tracks which section id is active via
IntersectionObserver. Write the test first:

`Docs.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Docs from './Docs';

test('Docs renders the rail and all major section headings', () => {
  render(<MemoryRouter><Docs /></MemoryRouter>);
  expect(screen.getByRole('link', { name: /intent lifecycle/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /the intent lifecycle/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /program ids/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement useScrollSpy**

`app/apps/main/src/routes/useScrollSpy.ts`:

```ts
import * as React from 'react';

export function useScrollSpy(ids: string[], rootMargin = '-40% 0px -55% 0px'): string {
  const [active, setActive] = React.useState(ids[0] ?? '');
  React.useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
    }, { rootMargin });
    const els = ids.map((id) => document.getElementById(id)).filter((x): x is HTMLElement => !!x);
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [ids.join(','), rootMargin]);
  return active;
}
```

- [ ] **Step 3: StateMachineDiagram + Docs page**

`StateMachineDiagram.tsx` — port the `<svg class="diagram">` state-machine from `docs.html`
§lifecycle (create_intent → Active → Fulfilled → Closed with refund branch) to JSX, using
the shared `diagram.css` classes.

Rewrite `app/apps/main/src/routes/Docs.tsx` as a 2-column `.docs-layout` (`.wrap`): a sticky
`<aside class="docs-rail">` of grouped anchor links (Overview / Intent lifecycle / Criterion
interface; Criteria: Hashlock / Validity·SP1 / Future criteria; Build: SDK quickstart /
Program IDs) with the active link driven by `useScrollSpy([...sectionIds])`; and a
`<main class="docs-content">` with the sections (each `id` + `scroll-margin-top`):
`#overview`, `#lifecycle` (`<StateMachineDiagram/>` + `.deftable` of the 4 instructions),
`#interface` (constants + request struct `<CodeBlock>`s), `#hashlock` (`.deftable` +
`.warn-box`), `#validity` (`.deftable`), `#future` (`.conds` 2×2 from `content/site.ts`),
`#quickstart` (`.install` strip with `<CopyButton value="npm i @laplace/sdk" />` + `<CodeBlock>`),
`#programs` (`.deftable` built from `getCluster(env.cluster).programs` → laplace/hashlock/
validity rows + Launch console / GitHub buttons). Rail hidden < 900px.

`Docs.module.css` ports `.docs-layout` grid (220px/1fr), `.docs-rail` (sticky), `.grp`,
rail link `.active`, `.docs-content`, section `scroll-margin-top: 90px`, `.deftable`/
`.defrow*`, `.warn-box`, `.conds`/`.cond*`, `.install*` from `laplace.css`.

- [ ] **Step 4: Run, commit**

```bash
cd app && npm run test -- --filter=@laplace/main && (cd apps/main && npx vite build)
git add app/apps/main/src/routes/Docs.tsx app/apps/main/src/routes/Docs.module.css app/apps/main/src/routes/useScrollSpy.ts app/apps/main/src/routes/Docs.test.tsx app/apps/main/src/components/diagrams/StateMachineDiagram.tsx
git commit -m "feat(main): Docs page with sticky scroll-spy rail + program IDs from registry"
```

---

## Task 4: Lab page (`/lab`)

**Files:**
- Create: `app/apps/main/src/components/diagrams/ArchitectureDiagram.tsx`, `app/apps/main/src/routes/Lab.test.tsx`
- Modify: `app/apps/main/src/routes/Lab.tsx`; Create `Lab.module.css`
- Reference: `lab.html` (full), `laplace.css` (shared section styles) + the inline `.arch` SVG and `.product-panel`/`.verticals`/`.vert` styles in `lab.html`'s `<style>`/classes

- [ ] **Step 1: ArchitectureDiagram**

`ArchitectureDiagram.tsx` — port the `<svg class="arch" viewBox="0 0 800 320">` from `lab.html`
(Protocol → Shared SDK/registry/design-system → Console[live·devnet]/Bridge/Disclosure/
Future[dashed]) to JSX, using `diagram.css` classes (and any `.arch`-specific classes ported
into `Lab.module.css` or `diagram.css`).

- [ ] **Step 2: Lab sections**

Rewrite `app/apps/main/src/routes/Lab.tsx`: `<PageHead eyebrow="Laplace Lab · the app family"
title={<>One protocol. <br/>A family of <em>products.</em></>}>…</PageHead>`, then (each in
`<Reveal>`): **Architecture** (`<SecHead>` + `<ArchitectureDiagram/>`), **Products** (`<SecHead>`
+ 3 numbered `.product-panel` rows: Main site & Console [live·devnet], Bridge [hashlock],
Disclosure [validity·sp1] — each two-column meta/detail with status badge, criterion chip,
audience, "what it adds", flow strip, trust notes), **Future verticals** (`<SecHead>` + 3-col
`.verticals` grid of 6 `.vert` cards), **How a product is born** (`<SecHead>` + `.steps` 3
rows: Author / Register / Give it a face), **CTA** (`<Cta>` Launch console + Read the docs).
Port the page-specific `.arch`/`.product-panel`/`.verticals`/`.vert` CSS from `lab.html` +
shared section CSS from `laplace.css` into `Lab.module.css`.

- [ ] **Step 3: Smoke test, run, commit**

`Lab.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Lab from './Lab';

test('Lab renders the product family and verticals', () => {
  render(<MemoryRouter><Lab /></MemoryRouter>);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/one protocol/i);
  expect(screen.getByText(/future verticals/i)).toBeInTheDocument();
});
```

```bash
cd app && npm run test -- --filter=@laplace/main && (cd apps/main && npx vite build)
git add app/apps/main/src/routes/Lab.tsx app/apps/main/src/routes/Lab.module.css app/apps/main/src/routes/Lab.test.tsx app/apps/main/src/components/diagrams/ArchitectureDiagram.tsx
git commit -m "feat(main): Lab page (architecture, products, future verticals, how a product is born)"
```

---

## Task 5: Registry page (`/registry`) with interactive catalog

**Files:**
- Create: `app/apps/main/src/routes/registry/RegistryCatalog.tsx` + `RegistryCatalog.module.css` + `RegistryCatalog.test.tsx`, `app/apps/main/src/routes/Registry.test.tsx`
- Modify: `app/apps/main/src/routes/Registry.tsx`; Create `Registry.module.css`
- Reference: `registry.html` (full), `registry.js` (catalog behavior — illustrative data, **use real registry instead**), trust-tier/`.tier*`/`.trustsplit`/`.tierlegend`/`.reg-tabs`/`.tfilter`/`.rcard*`/`.pipeline`/`.pstep` CSS in `registry.html`'s `<style>`

- [ ] **Step 1: RegistryCatalog — failing test (real registry data + filtering)**

`RegistryCatalog.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { RegistryCatalog } from './RegistryCatalog';

test('shows criteria cards and filters by tier', () => {
  render(<RegistryCatalog />);
  // Both official criteria appear under the default Criteria tab / All tiers.
  expect(screen.getByText(/hashlock/i)).toBeInTheDocument();
  // /validity/i also matches the "Validity guests" tab button, so use getAllByText.
  expect(screen.getAllByText(/validity/i).length).toBeGreaterThan(0);
  // Switch to the Validity guests tab → empty state (registry guests are empty today).
  fireEvent.click(screen.getByRole('button', { name: /validity guests/i }));
  expect(screen.getByText(/none yet/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement RegistryCatalog (state: tab + tierFilter, real data)**

`RegistryCatalog.tsx`:

```tsx
import * as React from 'react';
import { criteria, guests, type TrustTier } from '@laplace/registry';
import { Icon } from '@laplace/ui';
import { env } from '../../env';
import styles from './RegistryCatalog.module.css';

type Tab = 'criteria' | 'guests';
const TIERS: Array<TrustTier | 'all'> = ['all', 'official', 'audited', 'community', 'unverified'];

export function RegistryCatalog() {
  const [tab, setTab] = React.useState<Tab>('criteria');
  const [tier, setTier] = React.useState<TrustTier | 'all'>('all');

  const items = tab === 'criteria' ? criteria : guests;
  const filtered = items.filter((it) => tier === 'all' || it.tier === tier);

  return (
    <section id="catalog-sec" className={styles.catalogSec}>
      <div className={styles.tabs}>
        <button className={tab === 'criteria' ? styles.active : undefined} onClick={() => { setTab('criteria'); setTier('all'); }}>Criteria</button>
        <button className={tab === 'guests' ? styles.active : undefined} onClick={() => { setTab('guests'); setTier('all'); }}>Validity guests</button>
      </div>
      <div className={styles.toolbar}>
        <span className={styles.hint}>{tab === 'criteria'
          ? 'Deployed Solana programs that plug into the verify_criterion interface.'
          : 'SP1 guest programs whose proofs the validity criterion verifies.'}</span>
        <div className={styles.filters}>
          {TIERS.map((t) => (
            <button key={t} className={tier === t ? styles.active : undefined} onClick={() => setTier(t)}>{t === 'all' ? 'All tiers' : t}</button>
          ))}
        </div>
      </div>
      <div className={styles.catalog}>
        {filtered.length === 0 ? (
          <div className={styles.empty}><Icon icon="eva:cube-outline" /><p>None yet — this catalog tracks real on-chain entries.</p></div>
        ) : filtered.map((it: any) => <CatalogCard key={it.key} item={it} cluster={env.cluster} />)}
      </div>
    </section>
  );
}

function CatalogCard({ item, cluster }: { item: any; cluster: string }) {
  const [open, setOpen] = React.useState(false);
  const pid = item.programId?.[cluster];
  return (
    <div className={styles.rcard} data-open={open}>
      <button className={styles.rcardHead} onClick={() => setOpen((o) => !o)}>
        <span className={styles.rname}>{item.name ?? item.key}</span>
        <span className={`${styles.tier} ${styles[item.tier] ?? ''}`}><span className={styles.tdot} />{item.tier}</span>
        {pid && <span className={styles.rpid}>{pid.slice(0, 4)}…{pid.slice(-4)}</span>}
        <Icon icon="eva:chevron-down-outline" className={styles.chev} />
      </button>
      {open && (
        <div className={styles.rcardBody}>
          <p>{item.desc ?? item.statement ?? '—'}</p>
          {item.commitment && <div className={styles.kv}><span>Commitment</span><code>{item.commitment}</code></div>}
          {item.fulfillmentKind && <div className={styles.kv}><span>Fulfillment</span><code>{item.fulfillmentKind}</code></div>}
          {pid && <div className={styles.kv}><span>Program ID ({cluster})</span><code>{pid}</code></div>}
          {item.docsUrl && <a href={item.docsUrl} target="_blank" rel="noopener">Docs →</a>}
        </div>
      )}
    </div>
  );
}
```

`RegistryCatalog.module.css` ports `.reg-tabs`/buttons, `.reg-toolbar`/`#tabHint`,
`.tfilters`/`.tfilter`, `.rcatalog`, `.rcard`/`.rcard__head`/`.rcard__body`, `.tier` + the
five tier color variants, `.empty` from `registry.html`'s styles (and shared bits from
`laplace.css`).

- [ ] **Step 3: Registry page composition**

Rewrite `app/apps/main/src/routes/Registry.tsx`: `<PageHead eyebrow="Community Registry"
title={<>Permissionless protocol. <em>Legible</em> trust.</>}>…</PageHead>`, then (in `<Reveal>`):
**Trust model** (`<SecHead>` + `.trustsplit` 2-col: Automatic·cryptographic [green lock] /
Human·judgment [amber eye]), **Trust tiers** (`<SecHead>` + `.tierlegend` 5 cards: Official/
Audited/Community/Unverified/Flagged), **Catalog** (`<RegistryCatalog/>`), **Submission**
(`<SecHead>` + `.pipeline` 4 `.pstep` cards + "Submit a PR" GitHub button + interface
arrow-link + roadmap note), **CTA** (`<Cta>`). Port `.trustsplit`/`.half*`/`.tierlegend`/
`.tl`/`.tier*`/`.pipeline`/`.pstep*` CSS into `Registry.module.css`.

`Registry.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Registry from './Registry';

test('Registry renders trust model, tiers, and catalog', () => {
  render(<MemoryRouter><Registry /></MemoryRouter>);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/permissionless protocol/i);
  // "tiers" appears in the label, the title, and a filter chip → use getAllByText.
  expect(screen.getAllByText(/tiers/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/hashlock/i)).toBeInTheDocument();
});
```

- [ ] **Step 4: Run, full gate, commit**

```bash
cd app && npm run typecheck -- --filter=@laplace/ui --filter=@laplace/main \
  && npm run test -- --filter=@laplace/ui --filter=@laplace/main \
  && (cd apps/main && npx vite build)
git add app/apps/main/src/routes/Registry.tsx app/apps/main/src/routes/Registry.module.css app/apps/main/src/routes/Registry.test.tsx app/apps/main/src/routes/registry
git commit -m "feat(main): Registry page (trust model, tiers, real-data catalog, submission pipeline)"
```

Expected: typecheck + all tests green; SPA builds.

---

## Phase 3 self-review

- **Spec coverage (§7 marketing):** Landing ✓ Task 2; Docs + scroll-spy + program IDs ✓
  Task 3; Lab ✓ Task 4; Registry + interactive catalog ✓ Task 5; shared `PageHead`/`SecHead`/
  `Cta`/`Eyebrow` ✓ Task 1. Live stats (Landing) via `useStats` ✓; criteria/program IDs from
  the real registry ✓; the two exact "Solana" mentions sourced from `content/site.ts` ✓.
- **Placeholder scan:** route stubs from Phase 1 are fully replaced. Catalog reflects real
  registry data (2 official criteria, empty guests) with an honest empty state — not a
  placeholder. CSS/markup/SVG "port from reference" steps cite exact files; no "TBD"/"add
  styling" steps.
- **Type consistency:** `Eyebrow`/`PageHead`/`SecHead`/`Cta` props; `useScrollSpy(ids)→string`;
  `RegistryCatalog` tab/tier state; `getCluster(env.cluster).programs`; `criteria`/`guests`/
  `TrustTier` from `@laplace/registry`; `useStats()` from the Phase-2 hooks. The shared
  `diagram.css` class names match the SVG class strings across all three diagram components.

## Notes / risks
- The `.diagram*` classes are applied to inline SVGs, so they live in a plain (non-module)
  `diagram.css` imported once — module-scoped names would not match the SVG's literal class
  strings. Keep that file global; everything else is CSS Modules.
- Real registry catalog is intentionally sparse (hashlock + validity). The trust-model,
  tier legend, and submission pipeline are static educational content (faithful to the
  prototype) framing that real data.
- Stats show `—` when no indexer is configured; this is expected on a fresh devnet.
