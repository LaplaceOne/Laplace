# Laplace Website — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `@laplace-one/ui` design-system package and the `apps/main` Vite SPA shell — tokens, theming (no-FOUC), shared atoms, ambient background, cursor ring, site/console layouts, and a router with placeholder routes — so every later page composes from a faithful, tested foundation.

**Architecture:** A new source-consumed `@laplace-one/ui` package (Vite/Vitest resolve its `.tsx`/`.module.css` directly — no tsup build) holds the re-authored AnyUI tokens and all shared primitives. `apps/main` is a Vite + React 19 + React Router SPA that imports `@laplace-one/ui` and the existing built packages (`@laplace-one/sdk`, `@laplace-one/wallet`, `@laplace-one/registry`). This phase ships a runnable, themed shell with marketing + console layouts and placeholder pages.

**Tech Stack:** Vite 7, React 19, React Router 7, TypeScript 5.7 (`moduleResolution: bundler`, `strict`, `verbatimModuleSyntax`), Vitest 3 + jsdom + @testing-library/react, CSS Modules, `@iconify/react`.

**Design source of truth (read these — vendored, durable):**
`docs/design-reference/laplace-prototype/project/styles/anyui-tokens.css` (tokens),
`…/styles/laplace.css` (shared marketing CSS), `…/styles/app.css` (console CSS),
`…/styles/laplace.js` (theme toggle, reveal, copy, cursor), `…/styles/bg.js` (ambient
background), `…/index.html` `…/docs.html` `…/lab.html` `…/registry.html` (markup),
`…/app.js` (console logic), `…/chats/chat1.md` (design intent). **Re-author** these —
do not copy verbatim — but preserve token values, measurements, and class semantics
exactly for pixel fidelity.

**Conventions to match (from existing packages):**
- Package: `"type": "module"`, scripts `build`/`typecheck`/`test`/`lint`, tsconfig
  `extends "@laplace-one/config/tsconfig.lib.json"`.
- React test packages depend on `@testing-library/react`, `jsdom`, `vitest`, `react`.
- Intra-package imports in `@laplace-one/ui` source use explicit `.js` extensions (matches
  `@laplace-one/wallet`). `apps/main` imports are extensionless (Vite resolves).
- `@laplace-one/sdk` entrypoints: `@laplace-one/sdk`, `@laplace-one/sdk/react`, `@laplace-one/sdk/raw`.
- `LaplaceProvider` (`@laplace-one/wallet`) signature: `{ cluster, rpcUrl?, signer?, children }`.

---

## File structure (created in this phase)

```
app/
  package.json                         MODIFY: workspaces add "apps/*"
  packages/ui/                         NEW @laplace-one/ui (source-consumed)
    package.json                       exports map → src (no dist build)
    tsconfig.json
    vitest.config.ts                   react plugin + jsdom + setup
    src/
      index.ts                         barrel
      test/setup.ts                    @testing-library/jest-dom
      styles/tokens.css                re-authored anyui-tokens.css
      styles/base.css                  globals (scrollbar, type, .wrap, .gradient-text)
      lib/cn.ts                        className join helper
      theme/ThemeProvider.tsx          data-theme + localStorage 'laplace-theme'
      theme/ThemeProvider.test.tsx
      theme/themeBootstrap.ts          string of the pre-paint inline script
      components/Icon.tsx              @iconify/react wrapper
      components/Button.tsx + .module.css
      components/ArrowLink.tsx + .module.css
      components/CopyButton.tsx + .module.css + .test.tsx
      components/CodeBlock.tsx + .module.css
      components/Reveal.tsx + .test.tsx
      components/useInView.ts
      components/AmbientBackground.tsx  port of bg.js
      components/CursorRing.tsx         port of laplace.js cursor
      components/ThemeToggle.tsx
  apps/main/                           NEW Vite SPA
    package.json
    index.html                         pre-paint theme script
    vite.config.ts
    vitest.config.ts
    tsconfig.json
    tsconfig.node.json
    src/
      main.tsx                         createRoot + providers + RouterProvider
      App.tsx                          <Outlet/> + global chrome
      App.test.tsx
      router.tsx                       route table (placeholder pages)
      env.ts                           VITE_* config
      vite-env.d.ts
      test/setup.ts
      layouts/SiteLayout.tsx + .module.css
      layouts/ConsoleLayout.tsx + .module.css
      components/Nav.tsx + .module.css
      components/Footer.tsx + .module.css
      components/BrandMark.tsx          inline SVG logo
      routes/                          placeholder page modules (Landing/Docs/Lab/Registry/console views)
docs/design-reference/laplace-prototype/   (already vendored)
```

---

## Task 1: Scaffold workspace, `@laplace-one/ui`, and `apps/main`

**Files:**
- Modify: `app/package.json`
- Create: `app/packages/ui/package.json`, `app/packages/ui/tsconfig.json`, `app/packages/ui/vitest.config.ts`, `app/packages/ui/src/index.ts`, `app/packages/ui/src/test/setup.ts`, `app/packages/ui/src/lib/cn.ts`
- Create: `app/apps/main/package.json`, `app/apps/main/tsconfig.json`, `app/apps/main/tsconfig.node.json`, `app/apps/main/vite.config.ts`, `app/apps/main/vitest.config.ts`, `app/apps/main/index.html`, `app/apps/main/src/main.tsx`, `app/apps/main/src/App.tsx`, `app/apps/main/src/App.test.tsx`, `app/apps/main/src/vite-env.d.ts`, `app/apps/main/src/test/setup.ts`

- [ ] **Step 1: Add `apps/*` to workspaces**

Edit `app/package.json` — change the `workspaces` line to:

```json
  "workspaces": ["packages/*", "apps/*"],
```

- [ ] **Step 2: Create `@laplace-one/ui` package.json (source-consumed, no build)**

`app/packages/ui/package.json`:

```json
{
  "name": "@laplace-one/ui",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./styles/tokens.css": "./src/styles/tokens.css",
    "./styles/base.css": "./src/styles/base.css"
  },
  "scripts": {
    "build": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@iconify/react": "^6.0.0",
    "@laplace-one/sdk": "*",
    "@laplace-one/registry": "*"
  },
  "peerDependencies": { "react": ">=18", "react-dom": ">=18" },
  "devDependencies": {
    "@laplace-one/config": "*",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@testing-library/dom": "^10.0.0",
    "@vitejs/plugin-react": "^5.2.0",
    "jsdom": "^25.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "typescript": "^5.7.3",
    "vitest": "^3.0.0"
  }
}
```

> Note: `build` is `tsc --noEmit` because `@laplace-one/ui` is consumed from source by
> Vite/Vitest; it does not emit a `dist`. This keeps CSS Modules working without a
> bundler step and satisfies turbo's `build`/`^build` graph.

- [ ] **Step 3: Create `@laplace-one/ui` tsconfig.json**

`app/packages/ui/tsconfig.json`:

```json
{
  "extends": "@laplace-one/config/tsconfig.lib.json",
  "compilerOptions": {
    "rootDir": "src",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals", "@testing-library/jest-dom"],
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `@laplace-one/ui` vitest config + test setup + cn helper**

`app/packages/ui/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { globals: true, environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] },
});
```

`app/packages/ui/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

`app/packages/ui/src/lib/cn.ts`:

```ts
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
```

`app/packages/ui/src/index.ts` (seed; expanded by later tasks):

```ts
export { cn } from './lib/cn.js';
```

- [ ] **Step 5: Create `apps/main` package.json**

`app/apps/main/package.json`:

```json
{
  "name": "@laplace-one/main",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@laplace-one/sdk": "*",
    "@laplace-one/wallet": "*",
    "@laplace-one/registry": "*",
    "@laplace-one/ui": "*",
    "@iconify/react": "^6.0.0",
    "@solana/kit": "^6.0.0",
    "@solana/react": "^6.0.0",
    "@wallet-standard/react": "^1.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0"
  },
  "devDependencies": {
    "@laplace-one/config": "*",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@testing-library/dom": "^10.0.0",
    "@vitejs/plugin-react": "^5.2.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.7.3",
    "vite": "^7.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 6: Create `apps/main` tsconfigs**

`app/apps/main/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"],
    "noEmit": true,
    "allowImportingTsExtensions": false
  },
  "include": ["src"]
}
```

`app/apps/main/tsconfig.node.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true, "types": ["node"] },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 7: Create Vite + Vitest config**

`app/apps/main/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
```

`app/apps/main/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { globals: true, environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] },
});
```

`app/apps/main/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

`app/apps/main/src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 8: Create the HTML host with pre-paint theme script**

`app/apps/main/index.html`:

```html
<!doctype html>
<html lang="en" data-theme="light">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Laplace — intent-based atomic settlement</title>
    <script>
      // Pre-paint theme bootstrap (no FOUC). Mirrors design-reference laplace.js.
      try {
        var t = localStorage.getItem('laplace-theme') || 'light';
        document.documentElement.setAttribute('data-theme', t);
      } catch (e) {}
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 9: Create a minimal App + entry + failing smoke test**

`app/apps/main/src/App.tsx`:

```tsx
export function App() {
  return <div data-testid="app-root">Laplace</div>;
}
```

`app/apps/main/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`app/apps/main/src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { App } from './App';

test('App renders the root', () => {
  render(<App />);
  expect(screen.getByTestId('app-root')).toBeInTheDocument();
});
```

- [ ] **Step 10: Install dependencies**

Run from `app/`:

```bash
npm install
```

Expected: installs `vite`, `@vitejs/plugin-react`, `react-router-dom`, `@iconify/react`,
`@solana/react`, `@wallet-standard/react`, `@solana/kit`, `@testing-library/jest-dom`
across the new workspaces; exits 0.

- [ ] **Step 11: Build existing packages (so `apps/main` can resolve their `dist`)**

Run from `app/`:

```bash
npm run build -- --filter=@laplace-one/registry --filter=@laplace-one/sdk --filter=@laplace-one/wallet
```

Expected: turbo builds the three packages to `dist/`; exits 0. (If a package is already
built and cached, turbo reports it cached — still exit 0.)

- [ ] **Step 12: Run the smoke test**

Run from `app/`:

```bash
npm run test -- --filter=@laplace-one/main
```

Expected: `App renders the root` PASSES.

- [ ] **Step 13: Verify the app builds and dev-serves**

Run from `app/apps/main`:

```bash
npx vite build
```

Expected: build succeeds, emits `dist/`. (Optional manual: `npx vite` then open
http://localhost:5173 to see "Laplace".)

- [ ] **Step 14: Commit**

```bash
git add app/package.json app/packages/ui app/apps/main
git commit -m "feat(website): scaffold @laplace-one/ui package and apps/main Vite SPA"
```

---

## Task 2: Re-author design tokens and base globals into `@laplace-one/ui`

**Files:**
- Create: `app/packages/ui/src/styles/tokens.css`
- Create: `app/packages/ui/src/styles/base.css`
- Reference: `docs/design-reference/laplace-prototype/project/styles/anyui-tokens.css`, `…/laplace.css` (lines 1–31: globals, scrollbar, `.wrap`, `.mono`, `.label`, `hr.rule`)

- [ ] **Step 1: Author `tokens.css`**

Re-author `anyui-tokens.css` into `app/packages/ui/src/styles/tokens.css`, preserving
**every** value exactly. It must include, under `:root`:
- The Google Fonts `@import` for Nunito (weights 400–800).
- Brand: `--primary: rgba(15,111,239,.9)`, `--primary-solid: rgb(15,111,239)`,
  `--secondary: rgba(17,205,239,.9)`, `--gradient-brand` (42deg primary→secondary).
- The full surface ramp (`--bg #f8f8fa` … `--bg-bright #ffffff`), text
  (`--text #202426`, `--text-secondary #909293`), semantic
  (`--success/--warn/--danger/--info`), border ramp, the entire `--primary-*` alpha
  ladder, the `--secondary-*` tints, the inky-blue shadow ladder (`--shadow #001220`
  + alphas), `--elev-1..7`, `--focus-ring`, fonts (`--font-normal` Nunito stack,
  `--font-mono` JetBrains Mono stack), the type scale (`--fs-*`, `--lh-*`, `--fw-*`,
  `--tracking-*`), radii (`--radius-xs..pill`), spacing (`--space-1..16`), component
  heights, `--header-height`, `--anim-*`, `--easing-*`.
- The semantic element rules from the same file: `html, body` base, `h1..h6`, `p`,
  `small/.caption`, `code/kbd/pre/samp`, `a`/`a:hover`, `::selection`, and the
  `.a-gradient-text/.gradient-text` utility.
- The complete `[data-theme="dark"]` block AND the
  `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` block, values
  exactly as in the reference.

Verbatim-port the values; this is a typography/color contract, not creative work.

- [ ] **Step 2: Author `base.css`**

Port the globals from `laplace.css` lines 1–31 into
`app/packages/ui/src/styles/base.css`: `*{box-sizing:border-box}`, `html,body` reset +
`scroll-behavior:smooth`, `html{background:var(--bg-bright)}` /
`[data-theme="dark"] html{background:var(--bg)}`, `body` (transparent bg, token font,
`--tracking-normal`, `overflow-x:hidden`, antialiased), the custom scrollbar block
(`scrollbar-width/-color`, `::-webkit-scrollbar*` with primary-tinted thumb), `.wrap`
(`max-width:1140px; margin:0 auto; padding:0 36px`), `a{color:inherit}`, `.mono`,
`.label` (mono, 11.5px, `.18em` tracking, uppercase, `--text-secondary`), and
`hr.rule`.

- [ ] **Step 3: Smoke-verify the CSS loads (no test framework for CSS — typecheck only)**

Add the imports to `apps/main/src/main.tsx` (top, before App import):

```tsx
import '@laplace-one/ui/styles/tokens.css';
import '@laplace-one/ui/styles/base.css';
```

Run from `app/apps/main`:

```bash
npx vite build
```

Expected: build succeeds with the CSS bundled (no "failed to resolve import" errors).

- [ ] **Step 4: Commit**

```bash
git add app/packages/ui/src/styles app/apps/main/src/main.tsx
git commit -m "feat(ui): re-author AnyUI tokens and base globals"
```

---

## Task 3: ThemeProvider + useTheme + ThemeToggle (TDD)

**Files:**
- Create: `app/packages/ui/src/theme/ThemeProvider.tsx`, `…/theme/ThemeProvider.test.tsx`, `…/theme/themeBootstrap.ts`, `…/components/ThemeToggle.tsx`
- Modify: `app/packages/ui/src/index.ts`
- Reference: `…/laplace-prototype/project/styles/laplace.js` (theme toggle: key `laplace-theme`, icons `eva:moon-outline`/`eva:sun-outline`)

- [ ] **Step 1: Write the failing test**

`app/packages/ui/src/theme/ThemeProvider.test.tsx`:

```tsx
import { act, render, renderHook, screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeProvider.js';

function wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

test('defaults to light and reflects on <html data-theme>', () => {
  const { result } = renderHook(() => useTheme(), { wrapper });
  expect(result.current.theme).toBe('light');
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
});

test('toggle flips theme, persists to localStorage, and updates <html>', () => {
  const { result } = renderHook(() => useTheme(), { wrapper });
  act(() => result.current.toggle());
  expect(result.current.theme).toBe('dark');
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  expect(localStorage.getItem('laplace-theme')).toBe('dark');
});

test('reads persisted theme on mount', () => {
  localStorage.setItem('laplace-theme', 'dark');
  const { result } = renderHook(() => useTheme(), { wrapper });
  expect(result.current.theme).toBe('dark');
});
```

- [ ] **Step 2: Run it — expect FAIL**

```bash
cd app && npm run test -- --filter=@laplace-one/ui
```

Expected: FAIL ("Cannot find module './ThemeProvider.js'").

- [ ] **Step 3: Implement ThemeProvider**

`app/packages/ui/src/theme/ThemeProvider.tsx`:

```tsx
import * as React from 'react';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'laplace-theme';

interface ThemeCtx { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void; }
const Ctx = React.createContext<ThemeCtx | null>(null);

function readInitial(): Theme {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
  }
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {}
  return 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(readInitial);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
  }, [theme]);

  const value = React.useMemo<ThemeCtx>(() => ({
    theme,
    setTheme: setThemeState,
    toggle: () => setThemeState((t) => (t === 'light' ? 'dark' : 'light')),
  }), [theme]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}
```

> Note: the test sets `data-theme=dark` via localStorage only (not the attribute), so
> `readInitial` falls through to the localStorage branch. In production the pre-paint
> inline script sets the attribute first, which `readInitial` then honors.

- [ ] **Step 4: Add the bootstrap string export**

`app/packages/ui/src/theme/themeBootstrap.ts`:

```ts
// The exact inline <head> script apps embed before the bundle to avoid theme FOUC.
export const THEME_BOOTSTRAP = `try{var t=localStorage.getItem('laplace-theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}`;
```

- [ ] **Step 5: Implement ThemeToggle**

`app/packages/ui/src/components/ThemeToggle.tsx`:

```tsx
import { Icon } from './Icon.js';
import { useTheme } from '../theme/ThemeProvider.js';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      className={className ?? 'theme-toggle'}
      aria-label="Toggle theme"
      onClick={toggle}
    >
      <Icon icon={theme === 'dark' ? 'eva:sun-outline' : 'eva:moon-outline'} />
    </button>
  );
}
```

> `Icon` is created in Task 4; this import resolves once Task 4 lands. Implement Task 4
> before re-running ui tests if `ThemeToggle` is imported by the barrel.

- [ ] **Step 6: Export from barrel**

Update `app/packages/ui/src/index.ts`:

```ts
export { cn } from './lib/cn.js';
export { ThemeProvider, useTheme, type Theme } from './theme/ThemeProvider.js';
export { THEME_BOOTSTRAP } from './theme/themeBootstrap.js';
export { ThemeToggle } from './components/ThemeToggle.js';
```

- [ ] **Step 7: Run tests — expect PASS** (after Task 4's `Icon` exists; if executing in order, defer barrel `ThemeToggle` export until Task 4, or stub `Icon` first)

```bash
cd app && npm run test -- --filter=@laplace-one/ui
```

Expected: the three ThemeProvider tests PASS.

- [ ] **Step 8: Commit**

```bash
git add app/packages/ui/src
git commit -m "feat(ui): ThemeProvider, useTheme, theme bootstrap, ThemeToggle"
```

---

## Task 4: Atoms — Icon, Button, ArrowLink, CopyButton, CodeBlock

**Files:**
- Create: `app/packages/ui/src/components/Icon.tsx`
- Create: `…/components/Button.tsx` + `Button.module.css`
- Create: `…/components/ArrowLink.tsx` + `ArrowLink.module.css`
- Create: `…/components/CopyButton.tsx` + `CopyButton.module.css` + `CopyButton.test.tsx`
- Create: `…/components/CodeBlock.tsx` + `CodeBlock.module.css`
- Modify: `app/packages/ui/src/index.ts`
- Reference: `…/laplace.css` (`.btn*` lines 51–66, `.arrow-link`, `.code*` lines 149–161, `.copy-btn`, `.install`)

- [ ] **Step 1: Icon wrapper**

`app/packages/ui/src/components/Icon.tsx`:

```tsx
import { Icon as Iconify, type IconProps } from '@iconify/react';

export function Icon(props: IconProps) {
  return <Iconify {...props} />;
}
```

- [ ] **Step 2: Button (port `.btn` styles)**

`app/packages/ui/src/components/Button.tsx`:

```tsx
import * as React from 'react';
import { cn } from '../lib/cn.js';
import styles from './Button.module.css';

type Variant = 'default' | 'accent' | 'ghost';
type Size = 'default' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  as?: 'button' | 'a';
  href?: string;
}

export function Button({ variant = 'default', size = 'default', as = 'button', className, children, href, ...rest }: ButtonProps) {
  const cls = cn(styles.btn, styles[variant], size === 'lg' && styles.lg, className);
  if (as === 'a') return <a href={href} className={cls}>{children}</a>;
  return <button className={cls} {...rest}>{children}</button>;
}
```

`Button.module.css`: port `.btn`, `.btn:hover`, `[data-theme="dark"] .btn:hover`,
`.btn iconify-icon` (→ `.btn svg`), `.btn--accent`/`:hover`, `.btn--ghost`/`:hover`,
`.btn--lg` from `laplace.css` lines 52–62, with local class names `btn`, `accent`,
`ghost`, `lg` (use `:global([data-theme="dark"])` for the dark-hover rule).

- [ ] **Step 3: ArrowLink (port `.arrow-link`)**

`app/packages/ui/src/components/ArrowLink.tsx`:

```tsx
import { Icon } from './Icon.js';
import styles from './ArrowLink.module.css';

export function ArrowLink({ href, children, icon = 'eva:arrow-forward-outline', target }: {
  href: string; children: React.ReactNode; icon?: string; target?: string;
}) {
  return (
    <a href={href} className={styles.arrowLink} target={target} rel={target === '_blank' ? 'noopener' : undefined}>
      {children}
      <Icon icon={icon} />
    </a>
  );
}
```

`ArrowLink.module.css`: port `.arrow-link` + `.arrow-link iconify-icon` (→ `svg`) +
`:hover svg{transform:translateX(4px)}` from `laplace.css` lines 63–65.

- [ ] **Step 4: CopyButton — write the failing test first**

`app/packages/ui/src/components/CopyButton.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CopyButton } from './CopyButton.js';

test('copies value to clipboard and shows confirmation', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });

  render(<CopyButton value="npm i @laplace-one/sdk" label="copy" />);
  fireEvent.click(screen.getByRole('button'));

  expect(writeText).toHaveBeenCalledWith('npm i @laplace-one/sdk');
  await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent(/copied/i));
});
```

- [ ] **Step 5: Run it — expect FAIL**

```bash
cd app && npm run test -- --filter=@laplace-one/ui
```

Expected: FAIL ("Cannot find module './CopyButton.js'").

- [ ] **Step 6: Implement CopyButton**

`app/packages/ui/src/components/CopyButton.tsx`:

```tsx
import * as React from 'react';
import { Icon } from './Icon.js';
import { cn } from '../lib/cn.js';
import styles from './CopyButton.module.css';

export function CopyButton({ value, label = 'copy', className }: {
  value: string; label?: string; className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  async function onClick() {
    try { await navigator.clipboard.writeText(value); } catch {}
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button type="button" className={cn(styles.copyBtn, className)} onClick={onClick}>
      <Icon icon={copied ? 'eva:checkmark-outline' : 'eva:copy-outline'} />
      {copied ? 'copied' : label}
    </button>
  );
}
```

`CopyButton.module.css`: port `.copy-btn` + `:hover` from `laplace.css` lines 167–168.

- [ ] **Step 7: CodeBlock (port `.code*`)**

`app/packages/ui/src/components/CodeBlock.tsx`:

```tsx
import { cn } from '../lib/cn.js';
import styles from './CodeBlock.module.css';

export function CodeBlock({ filename, children, className }: {
  filename?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn(styles.code, className)}>
      <div className={styles.bar}>
        {filename && <span className="label">{filename}</span>}
        <div className={styles.dotrow}><i /><i /><i /></div>
      </div>
      <pre className={styles.body}>{children}</pre>
    </div>
  );
}
```

`CodeBlock.module.css`: port `.code`, `[data-theme="dark"] .code`, `.code__bar`,
`.code__bar .dotrow`/`i`, `pre.code__body` and the `.c/.k/.s/.n` syntax spans from
`laplace.css` lines 150–161 (local names `code`, `bar`, `dotrow`, `body`; expose
`c`/`k`/`s`/`n` via `:global`).

- [ ] **Step 8: Export atoms from barrel**

Append to `app/packages/ui/src/index.ts`:

```ts
export { Icon } from './components/Icon.js';
export { Button, type ButtonProps } from './components/Button.js';
export { ArrowLink } from './components/ArrowLink.js';
export { CopyButton } from './components/CopyButton.js';
export { CodeBlock } from './components/CodeBlock.js';
```

- [ ] **Step 9: Run tests — expect PASS**

```bash
cd app && npm run test -- --filter=@laplace-one/ui
```

Expected: CopyButton + ThemeProvider tests PASS.

- [ ] **Step 10: Commit**

```bash
git add app/packages/ui/src
git commit -m "feat(ui): Icon, Button, ArrowLink, CopyButton, CodeBlock atoms"
```

---

## Task 5: Reveal + useInView (TDD)

**Files:**
- Create: `app/packages/ui/src/components/useInView.ts`, `…/components/Reveal.tsx`, `…/components/Reveal.test.tsx`, `…/components/Reveal.module.css`
- Modify: `app/packages/ui/src/index.ts`
- Reference: `…/laplace.css` `.reveal`/`.reveal.in` (lines 230–232) + `…/laplace.js` initReveal (IntersectionObserver, threshold 0.12, reduced-motion shortcut)

- [ ] **Step 1: Write the failing test**

`app/packages/ui/src/components/Reveal.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react';
import { Reveal } from './Reveal.js';

let observeCb: ((entries: Array<{ isIntersecting: boolean; target: Element }>) => void) | null = null;

beforeEach(() => {
  observeCb = null;
  vi.stubGlobal('IntersectionObserver', class {
    constructor(cb: any) { observeCb = cb; }
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  });
});

test('reveals content when it intersects', () => {
  render(<Reveal><p>hello</p></Reveal>);
  const el = screen.getByText('hello').parentElement!;
  expect(el.className).not.toMatch(/\bin\b/);
  act(() => observeCb!([{ isIntersecting: true, target: el }]));
  expect(el.className).toMatch(/in/);
});
```

- [ ] **Step 2: Run it — expect FAIL**

```bash
cd app && npm run test -- --filter=@laplace-one/ui
```

Expected: FAIL ("Cannot find module './Reveal.js'").

- [ ] **Step 3: Implement useInView + Reveal**

`app/packages/ui/src/components/useInView.ts`:

```ts
import * as React from 'react';

export function useInView<T extends HTMLElement>(threshold = 0.12) {
  const ref = React.useRef<T>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { setInView(true); io.unobserve(e.target); }
      }
    }, { threshold });
    io.observe(el);
    const fallback = setTimeout(() => setInView(true), 1400);
    return () => { io.disconnect(); clearTimeout(fallback); };
  }, [threshold]);

  return { ref, inView };
}
```

`app/packages/ui/src/components/Reveal.tsx`:

```tsx
import * as React from 'react';
import { cn } from '../lib/cn.js';
import { useInView } from './useInView.js';
import styles from './Reveal.module.css';

export function Reveal({ children, as: As = 'div', className }: {
  children: React.ReactNode; as?: React.ElementType; className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <As ref={ref} className={cn(styles.reveal, inView && styles.in, className)}>
      {children}
    </As>
  );
}
```

`Reveal.module.css`: port `.reveal` + `.reveal.in` (local names `reveal`, `in`) from
`laplace.css` lines 230–232, plus the reduced-motion override.

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd app && npm run test -- --filter=@laplace-one/ui
```

Expected: Reveal test PASSES.

- [ ] **Step 5: Export + commit**

Append to barrel:

```ts
export { Reveal } from './components/Reveal.js';
export { useInView } from './components/useInView.js';
```

```bash
git add app/packages/ui/src
git commit -m "feat(ui): Reveal + useInView scroll animation"
```

---

## Task 6: AmbientBackground (port of bg.js)

**Files:**
- Create: `app/packages/ui/src/components/AmbientBackground.tsx`, `…/components/AmbientBackground.module.css`, `…/components/AmbientBackground.test.tsx`
- Modify: `app/packages/ui/src/index.ts`
- Reference: `…/laplace-prototype/project/styles/bg.js` (full algorithm)

- [ ] **Step 1: Write a mount/cleanup smoke test (canvas APIs mocked)**

`app/packages/ui/src/components/AmbientBackground.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { AmbientBackground } from './AmbientBackground.js';

beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  // reduced-motion=true short-circuits the rAF loop to a single static frame.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    stroke: vi.fn(), save: vi.fn(), restore: vi.fn(), setTransform: vi.fn(),
    scale: vi.fn(), createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillRect: vi.fn(), arc: vi.fn(), fill: vi.fn(),
  })) as any;
});

test('mounts a canvas and unmounts cleanly', () => {
  const { container, unmount } = render(<AmbientBackground />);
  expect(container.querySelector('canvas')).toBeTruthy();
  unmount();
});
```

- [ ] **Step 2: Run it — expect FAIL**

```bash
cd app && npm run test -- --filter=@laplace-one/ui
```

Expected: FAIL ("Cannot find module './AmbientBackground.js'").

- [ ] **Step 3: Implement AmbientBackground**

Port `bg.js` into a React component. Read `docs/design-reference/laplace-prototype/project/styles/bg.js`
and reproduce its algorithm inside a `useEffect` that owns a single `<canvas>` ref:
- Fixed full-viewport canvas, `position:fixed; inset:0; z-index:-2; pointer-events:none`.
- Grid of hairline segments (spacing 38px) whose angle comes from a layered sin/cos
  flow-field advanced by `requestAnimationFrame`.
- Magnetic pointer: radius 230px, gaussian falloff, bends nearby segments to point
  radially at the cursor (no spin, no opacity/length change); strength/position eased
  per frame.
- Reads `--primary-solid` from `getComputedStyle(document.documentElement)`; a
  `MutationObserver` on `<html data-theme>` re-reads it.
- Pauses on `document.hidden` (`visibilitychange`); resize debounced 150ms.
- `prefers-reduced-motion: reduce` → render one static frame, no rAF, no pointer
  listeners.
- The two drifting brand glows are CSS (`AmbientBackground.module.css`, keyframes
  `lpDrift1`/`lpDrift2`), not canvas.
- **Do not** expose any `window.__lpbg` debug hook.
- The effect cleanup cancels rAF, removes all listeners, and disconnects the observer.

Line opacity: ~0.15 light / ~0.22 dark (as in the reference).

`AmbientBackground.module.css`: the canvas positioning + the two blurred glow elements
with `lpDrift1`/`lpDrift2` keyframes (port from the reference's glow CSS).

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd app && npm run test -- --filter=@laplace-one/ui
```

Expected: AmbientBackground smoke test PASSES.

- [ ] **Step 5: Export + commit**

```ts
export { AmbientBackground } from './components/AmbientBackground.js';
```

```bash
git add app/packages/ui/src
git commit -m "feat(ui): AmbientBackground flow-field (port of bg.js)"
```

---

## Task 7: CursorRing (port of laplace.js cursor)

**Files:**
- Create: `app/packages/ui/src/components/CursorRing.tsx`, `…/components/CursorRing.module.css`, `…/components/CursorRing.test.tsx`
- Modify: `app/packages/ui/src/index.ts`
- Reference: `…/laplace.js` `initCursor` (ring+dot, rAF lerp 0.18, `.hot`/`.tap`, fine-pointer only)

- [ ] **Step 1: Write a reduced-motion/no-fine-pointer smoke test**

`app/packages/ui/src/components/CursorRing.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { CursorRing } from './CursorRing.js';

test('renders nothing on coarse pointers', () => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('pointer: coarse'), media: q,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  const { container } = render(<CursorRing />);
  expect(container.querySelector('[data-cursor-ring]')).toBeNull();
});
```

- [ ] **Step 2: Run it — expect FAIL**, then implement.

```bash
cd app && npm run test -- --filter=@laplace-one/ui
```

Expected: FAIL ("Cannot find module './CursorRing.js'").

- [ ] **Step 3: Implement CursorRing**

Port `initCursor` from `laplace.js`: render `[data-cursor-ring]` + dot **only** when
`matchMedia('(pointer: fine)').matches`. Dot tracks pointer instantly; ring eases via
rAF lerp (0.18). Add `.hot` when hovering interactive selectors
(`a, button, input, select, textarea, .theme-toggle, [data-copy], [role="button"]`),
`.tap` on pointerdown; hide on `mouseleave`/`blur`. Respect `prefers-reduced-motion`
(no rAF easing, no size transition). Cleanup removes listeners and cancels rAF.

`CursorRing.module.css`: ring + dot styles (brand-blue ring + small dot, grow/fill on
`.hot`), mirroring the reference's injected cursor CSS.

- [ ] **Step 4: Run tests — expect PASS; export + commit**

```bash
cd app && npm run test -- --filter=@laplace-one/ui
```

```ts
export { CursorRing } from './components/CursorRing.js';
```

```bash
git add app/packages/ui/src
git commit -m "feat(ui): CursorRing accent cursor (port of laplace.js)"
```

---

## Task 8: Marketing chrome in `apps/main` — BrandMark, Nav, Footer, SiteLayout, ConsoleLayout

**Files:**
- Create: `app/apps/main/src/components/BrandMark.tsx`
- Create: `…/components/Nav.tsx` + `Nav.module.css`, `…/components/Footer.tsx` + `Footer.module.css`
- Create: `…/layouts/SiteLayout.tsx` + `SiteLayout.module.css`, `…/layouts/ConsoleLayout.tsx` + `ConsoleLayout.module.css`
- Create: `…/layouts/SiteLayout.test.tsx`
- Reference: `…/index.html` nav/footer markup, `…/laplace.css` `nav`/`.nav-*`/`footer`/`.foot-*`, `…/app.css` `.appbar`/`.app-tabs`

- [ ] **Step 1: BrandMark (inline SVG logo)**

`app/apps/main/src/components/BrandMark.tsx` — reproduce the inline brand `mark` SVG
from `index.html` (the integral-S glyph with two accent dots, `class="mark"`,
`viewBox` and paths exactly as in the reference), as a React component accepting
`className`/`size`.

- [ ] **Step 2: Nav (uses React Router `NavLink`, ThemeToggle, Button)**

`app/apps/main/src/components/Nav.tsx`:

```tsx
import { Link, NavLink } from 'react-router-dom';
import { ThemeToggle, Button } from '@laplace-one/ui';
import { BrandMark } from './BrandMark';
import styles from './Nav.module.css';

const links = [
  { to: '/docs', label: 'Docs' },
  { to: '/lab', label: 'Lab' },
  { to: '/registry', label: 'Registry' },
];

export function Nav() {
  return (
    <nav className={styles.nav}>
      <div className="wrap">
        <div className={styles.inner}>
          <Link to="/" className={styles.brand}><BrandMark className={styles.mark} /> Laplace</Link>
          <div className={styles.links}>
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? styles.active : undefined)}>
                {l.label}
              </NavLink>
            ))}
          </div>
          <div className={styles.right}>
            <ThemeToggle />
            <Button as="a" href="/app" variant="accent">Launch console</Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
```

`Nav.module.css`: port `nav`, `[data-theme="dark"] nav`, `.nav-inner`, `.brand`,
`.brand .mark`, `.nav-links`, `.nav-links a` + `::after` underline + `:hover` +
`[aria-current="page"]`, `.nav-right`, `.theme-toggle` from `laplace.css` lines 34–49
(local names; the active NavLink maps to the `aria-current` underline). Height 72px.

- [ ] **Step 3: Footer**

`app/apps/main/src/components/Footer.tsx` — 4-column `foot-grid` (brand + tagline
column; Docs / Build / Products link columns) + `foot-bottom`
("© 2026 laplace protocol" | "devnet · SOL + SPL"), markup per `index.html` footer.
`Footer.module.css` ports `footer`, `.foot-grid`, `.foot-grid h4/a`, `.foot-bottom`
(`laplace.css` lines 222–228).

- [ ] **Step 4: SiteLayout + ConsoleLayout**

`app/apps/main/src/layouts/SiteLayout.tsx`:

```tsx
import { Outlet } from 'react-router-dom';
import { AmbientBackground, CursorRing } from '@laplace-one/ui';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';

export function SiteLayout() {
  return (
    <>
      <AmbientBackground />
      <CursorRing />
      <Nav />
      <main><Outlet /></main>
      <Footer />
    </>
  );
}
```

`app/apps/main/src/layouts/ConsoleLayout.tsx` — the console appbar (sticky 64px:
brand + `DEVNET` sub-pill, in-app tabs Console/Create/Manual via `NavLink` to
`/app`,`/app/create`,`/app/manual`, cluster badge placeholder, `ThemeToggle`, and a
wallet-button **placeholder** `<button className="wallet-btn">Connect wallet</button>`
to be wired in Phase 2) + `CursorRing` (NO `AmbientBackground`) + `<Outlet/>`.
`ConsoleLayout.module.css` ports `.appbar`/`.appbar-inner`/`.brand .sub`/`.app-tabs`/
`.app-tab`/`.appbar-right`/`.cluster-badge`/`.wallet-btn` from `app.css` lines 6–31.

- [ ] **Step 5: Write the layout render test**

`app/apps/main/src/layouts/SiteLayout.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { SiteLayout } from './SiteLayout';
import { ThemeProvider } from '@laplace-one/ui';

test('SiteLayout renders nav links and footer', () => {
  const router = createMemoryRouter(
    [{ path: '/', element: <SiteLayout />, children: [{ index: true, element: <p>home</p> }] }],
    { initialEntries: ['/'] },
  );
  render(<ThemeProvider><RouterProvider router={router} /></ThemeProvider>);
  expect(screen.getByRole('link', { name: /docs/i })).toBeInTheDocument();
  expect(screen.getByText(/laplace protocol/i)).toBeInTheDocument();
});
```

- [ ] **Step 6: Run test — expect PASS**

```bash
cd app && npm run test -- --filter=@laplace-one/main
```

Expected: layout test PASSES (canvas + cursor degrade gracefully under jsdom; if
`getContext` is null the AmbientBackground effect should no-op — guard with
`if (!ctx) return;`).

- [ ] **Step 7: Commit**

```bash
git add app/apps/main/src
git commit -m "feat(main): BrandMark, Nav, Footer, SiteLayout, ConsoleLayout"
```

---

## Task 9: Router + placeholder routes + providers wiring

**Files:**
- Create: `app/apps/main/src/env.ts`, `app/apps/main/src/router.tsx`
- Create placeholder route modules: `app/apps/main/src/routes/Landing.tsx`, `Docs.tsx`, `Lab.tsx`, `Registry.tsx`, `NotFound.tsx`, and console views `routes/console/Dashboard.tsx`, `Create.tsx`, `IntentDetail.tsx`, `PublicIntent.tsx`, `Manual.tsx`, `ValidityNew.tsx`
- Modify: `app/apps/main/src/App.tsx`, `app/apps/main/src/main.tsx`, `app/apps/main/src/App.test.tsx`

- [ ] **Step 1: env config**

`app/apps/main/src/env.ts`:

```ts
import type { Cluster } from '@laplace-one/registry';

export const env = {
  cluster: (import.meta.env.VITE_CLUSTER ?? 'devnet') as Cluster,
  rpcUrl: import.meta.env.VITE_RPC_URL as string | undefined,
  indexerUrl: import.meta.env.VITE_INDEXER_URL as string | undefined,
};
```

- [ ] **Step 2: Placeholder route modules**

Each placeholder renders a labelled section so routing is verifiable, e.g.
`app/apps/main/src/routes/Landing.tsx`:

```tsx
export default function Landing() {
  return <section className="wrap"><h1>Landing</h1></section>;
}
```

Create the analogous default-export stubs for `Docs`, `Lab`, `Registry`, `NotFound`
(heading "Not found"), and console views `Dashboard` ("Console"), `Create`,
`IntentDetail`, `PublicIntent`, `Manual`, `ValidityNew`. These are replaced by real
pages in Phases 3–4; the headings let Task 9's route test assert navigation.

- [ ] **Step 3: Router table**

`app/apps/main/src/router.tsx`:

```tsx
import { createBrowserRouter } from 'react-router-dom';
import { SiteLayout } from './layouts/SiteLayout';
import { ConsoleLayout } from './layouts/ConsoleLayout';
import Landing from './routes/Landing';
import Docs from './routes/Docs';
import Lab from './routes/Lab';
import Registry from './routes/Registry';
import NotFound from './routes/NotFound';
import Dashboard from './routes/console/Dashboard';
import Create from './routes/console/Create';
import IntentDetail from './routes/console/IntentDetail';
import PublicIntent from './routes/console/PublicIntent';
import Manual from './routes/console/Manual';
import ValidityNew from './routes/console/ValidityNew';

export const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/docs', element: <Docs /> },
      { path: '/lab', element: <Lab /> },
      { path: '/registry', element: <Registry /> },
    ],
  },
  {
    path: '/app',
    element: <ConsoleLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'create', element: <Create /> },
      { path: 'intent/:pda', element: <IntentDetail /> },
      { path: 'i/:pda', element: <PublicIntent /> },
      { path: 'manual', element: <Manual /> },
      { path: 'validity/new', element: <ValidityNew /> },
    ],
  },
  { path: '*', element: <NotFound /> },
]);
```

- [ ] **Step 4: App wraps providers; main mounts router**

`app/apps/main/src/App.tsx`:

```tsx
import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from '@laplace-one/ui';
import { router } from './router';

export function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}
```

> Phase 2 inserts `WalletProvider` + `LaplaceProvider` + `IndexerProvider` +
> `ToastProvider` between `ThemeProvider` and `RouterProvider`.

`app/apps/main/src/main.tsx` (unchanged from Task 2 except keep CSS imports + App):

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@laplace-one/ui/styles/tokens.css';
import '@laplace-one/ui/styles/base.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
```

- [ ] **Step 5: Replace the smoke test with a routing test**

`app/apps/main/src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider } from '@laplace-one/ui';
import { SiteLayout } from './layouts/SiteLayout';
import Landing from './routes/Landing';
import Docs from './routes/Docs';

test('renders the docs route under the site layout', () => {
  const router = createMemoryRouter(
    [{ element: <SiteLayout />, children: [
      { path: '/', element: <Landing /> },
      { path: '/docs', element: <Docs /> },
    ] }],
    { initialEntries: ['/docs'] },
  );
  render(<ThemeProvider><RouterProvider router={router} /></ThemeProvider>);
  expect(screen.getByRole('heading', { name: /docs/i })).toBeInTheDocument();
});
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
cd app && npm run test -- --filter=@laplace-one/main
```

Expected: routing test PASSES.

- [ ] **Step 7: Full typecheck + test + build gate**

```bash
cd app && npm run typecheck && npm run test && (cd apps/main && npx vite build)
```

Expected: all green — `@laplace-one/ui` + `@laplace-one/main` typecheck, all tests pass, the
SPA builds.

- [ ] **Step 8: Commit**

```bash
git add app/apps/main/src
git commit -m "feat(main): router, placeholder routes, provider wiring"
```

---

## Phase 1 self-review

- **Spec coverage (Phase 1 portion):** monorepo placement (§3) ✓ Task 1; `@laplace-one/ui`
  foundation + atoms + primitives + ambient bg + cursor (§4) ✓ Tasks 2–7; ThemeProvider
  no-FOUC (§4) ✓ Task 3; SiteLayout/ConsoleLayout + Nav/Footer (§7 chrome) ✓ Task 8;
  routing for all five surfaces + share route (§4 routing) ✓ Task 9. Deferred to later
  phases (intentional): integration layer §5, console feature wiring §6, marketing page
  bodies §7 — these are Phases 2–4 below.
- **Placeholder scan:** route modules are intentionally minimal stubs (replaced in
  Phases 3–4) — not plan placeholders; every code step contains complete code, and CSS
  steps cite the exact reference file + lines + token values. No "TBD"/"add error
  handling"/"similar to" steps.
- **Type consistency:** `Theme`, `useTheme().toggle`, `ButtonProps.variant/size/as`,
  `Reveal as`, `env.cluster/rpcUrl/indexerUrl`, and the `@laplace-one/ui` barrel exports are
  used consistently across tasks. The lifecycle primitives (`IntentCard`,
  `IntentStatusBadge`, `ExpiryCountdown`, `RoleActionButton`, `AssetAmount`, `Toast`) are
  **deferred to Phase 2** (they need SDK types `effectiveStatus`/`actionFor` + the slot
  context) and are listed there, not in Phase 1 — no dangling references in Phase 1.

---

## Roadmap — subsequent phase plans (written when reached)

Each is its own plan doc, produces working/testable software, and starts from the
Phase-1 foundation.

- **Phase 2 — Integration layer** (`…-02-integration.md`): `WalletProvider` + connect
  modal + wallet button (wallet-standard via `@solana/react`/`@wallet-standard/react`
  → `TransactionSigner`); wire `LaplaceProvider`; `indexerClient` + `useIntentList`/
  `useIntentDetail`/`useStats`/`useValidityConfigs` with SDK `getProgramAccounts`
  fallback; `ToastProvider`/`TxToast` + `mapLaplaceError`; the shared lifecycle
  primitives in `@laplace-one/ui` (`IntentStatusBadge`, `ExpiryCountdown`, `AssetAmount`,
  `RoleActionButton`, `IntentCard`) driven by `effectiveStatus`/`actionFor`/`useSlot`.
- **Phase 3 — Marketing surfaces** (`…-03-marketing.md`): Landing, Docs (scroll-spy
  rail), Lab, Registry (interactive catalog from `@laplace-one/registry`) — full section
  ports with `Reveal`, live stats from `/stats`, program IDs from `PROGRAM_IDS`.
- **Phase 4 — Console** (`…-04-console.md`): Dashboard (filters + grid + stats),
  Detail + public share, Create wizard (SOL/SPL, hashlock/validity/custom recipes,
  secret + ack gates) via `createIntent`, fulfill/refund/close, Manual ops via
  `@laplace-one/sdk/raw`, Validity config creation.
