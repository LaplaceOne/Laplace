# @laplace/main

The Laplace main site + protocol console — a Vite + React 19 SPA on the AnyUI design system,
wired to `@laplace/sdk`, `@laplace/wallet`, `@laplace/registry`, and the indexer. Targets
**devnet** (programs are live there).

## Run locally

From `app/`:

```bash
npm install                 # first time
npm run build               # build workspace deps (sdk/wallet/registry/indexer dist)
npm run dev -w @laplace/main # Vite on http://localhost:5173
```

`@laplace/ui` is consumed from source (hot-reloads). Editing `@laplace/sdk`/`wallet`/`registry`/
`indexer` requires rebuilding that package (`npm run build -w @laplace/sdk`) since the app reads
their `dist`, then restart `vite` (it pre-bundles workspace deps).

## Environment (`apps/main/.env`, all optional)

See `.env.example`. Defaults target devnet with the public RPC.

| Var | Default | Notes |
| --- | --- | --- |
| `VITE_CLUSTER` | `devnet` | `localnet` \| `devnet` \| `mainnet-beta` |
| `VITE_RPC_URL` | registry RPC | Override with a dedicated provider (Helius/Alchemy) for reliable reads + websockets |
| `VITE_INDEXER_URL` | _(unset)_ | Indexer read API; unset → SDK `getProgramAccounts` fallback |

## Indexer (for dashboard discovery + stats)

Without an indexer the console falls back to client-side `getProgramAccounts` on the public RPC
(throttled). To run one locally against devnet (single process, embedded pglite — no Postgres):

```bash
npm run build -w @laplace/indexer
cd packages/indexer
LAPLACE_CLUSTER=devnet DATABASE_URL=file:./devnet-index.db API_PORT=8787 \
  node dist/bin/laplace-indexer-dev   # or: node dist/bin/dev.js
```

Then set `VITE_INDEXER_URL=http://localhost:8787` and restart the site. For production, run the
split `laplace-indexer` (ingest) + `laplace-indexer-api` (serve) bins against a shared
`DATABASE_URL=postgres://…`.

## Wallets & funding (devnet)

- Use **Phantom, Solflare, or Backpack** — they honor the dApp's `solana:devnet` request.
  **MetaMask** is mainnet-only and will revert during simulation (the console shows a warning).
- Creating an intent needs devnet SOL (rent + escrow + fee). Use the **Airdrop 1 SOL** button in
  the connect modal, or [faucet.solana.com](https://faucet.solana.com) (the public RPC faucet is
  rate-limited).

## Deploy (static SPA)

`npm run build -w @laplace/main` emits `apps/main/dist`. Client-side routing needs an SPA fallback
(all paths → `index.html`):

- **Netlify / Cloudflare Pages:** `public/_redirects` (already included) handles it.
- **Vercel:** `vercel.json` (included) rewrites to `/index.html`.

Set the project root to `app/`, build command `npm run build` (turbo builds deps + the SPA),
output directory `apps/main/dist`, and the `VITE_*` env vars above.

## Scripts

- `scripts/devnet-lifecycle.mjs` — end-to-end smoke: create → fulfill → close a hashlock/SOL
  intent on devnet (also populates the indexer). See the script header for usage.
