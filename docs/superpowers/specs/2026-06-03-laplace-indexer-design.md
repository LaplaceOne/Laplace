# Laplace Indexer (Design A) — Design

Date: 2026-06-03
Status: Approved (design); pending spec review → implementation plan
Scope: new `app/packages/indexer` (`@laplace/indexer`), depends on `@laplace/sdk` + `@laplace/registry`
Depends on: lifecycle events (Design B, branch `feat/lifecycle-events`) — the SDK `parseLaplaceEvents` decoder

## 1. Problem & goal

Laplace's full history is not queryable on-chain: `close_intent` deletes the account, the programs
emit events but store no settlement timestamp, and `getProgramAccounts` is unscalable for a public
view (see `docs/superpowers/specs/2026-06-02-laplace-lifecycle-events-design.md` §1). Design B added a
decodable event stream. **Design A consumes that stream into a queryable store.**

**Goal.** An off-chain indexer that ingests Laplace lifecycle events from the chain, persists them in
an event-sourced store, and serves typed reads — so a future dashboard can show full status + history
without polling the chain or racing account deletion.

**Non-goals.**
- The dashboard UI and the management actions (create/fulfill/refund/close already live in `@laplace/sdk`)
  — a separate later spec (Design C) that consumes this indexer.
- A live WebSocket/Geyser firehose — v1 is poll-only (cursor-based RPC). Realtime is a later add.
- Multi-protocol / generic indexing — scoped to the three Laplace program IDs.

## 2. Decisions (resolved with the user)

1. **Language: TypeScript, reusing `@laplace/sdk`.** Zero duplication of the wire format — `parseLaplaceEvents`,
   the generated account decoders, PDA helpers, and `@laplace/registry` cluster config are already written
   and tested. One language across indexer + SDK + future dashboard. (Rust/Go would re-implement or copy
   the event/account layouts; rejected — throughput isn't the constraint for a settlement protocol.)
2. **Ingestion: cursor-based RPC polling** (`getSignaturesForAddress` + `getTransaction`). Vendor-neutral,
   self-healing (handles gaps/restarts), no extra infra, runs against any RPC including devnet. (Managed
   webhooks / `logsSubscribe` rejected for v1: lock-in / drops; can be layered on later.)
3. **Database: Postgres + Drizzle**, with the same Drizzle schema running on SQLite for dev/test/CI.
4. **Read layer: a typed query module + a thin read-only HTTP/JSON API** (Hono), so a public dashboard
   never touches the DB directly. The query module is reusable by both the API and a future Next.js app.
5. **Store shape: event-sourced** — an append-only `events` table is the source of truth; `intents` and
   `validity_configs` are materialized projections folded from it and fully rebuildable.
6. **Live integration test targets devnet** (the programs are deployed there), gated behind `LAPLACE_DEVNET=1`.
7. **Commitment: `finalized`** for ingestion (reorg-safe).

## 3. Architecture & data flow

```
Solana RPC ── poll getSignaturesForAddress(laplace, validity) ──▶ ingest loop
   │  getTransaction(sig).meta.logMessages   (skip meta.err != null)
   ▼
@laplace/sdk parseLaplaceEvents(logs) ──▶ append to `events` (idempotent on signature+index)
   │
   ▼ fold (ordered by slot, signature, event_index)
materialized `intents` + `validity_configs` projections
   │
   ▼
typed query module ──▶ thin read HTTP/JSON API ──▶ (future dashboard)
```

Poll **laplace + validity** program IDs. Hashlock emits nothing; a hashlock fulfill surfaces as a laplace
transaction (laplace emits `IntentFulfilled`). A fulfill that CPIs validity appears under both cursors →
**dedupe by signature per tick**; the `events` primary key is the backstop. Each unique transaction is
parsed once with `parseLaplaceEvents`, which extracts all recognized event kinds from its logs.

## 4. Package layout — `app/packages/indexer`

One responsibility per file:
- `src/config.ts` — env config: `LAPLACE_CLUSTER` (default `devnet`), `LAPLACE_RPC_URL`, `DATABASE_URL`
  (`postgres://…` or `file:…` for SQLite), `POLL_INTERVAL_MS`, `START_SLOT`, `COMMITMENT` (default `finalized`).
- `src/db/schema.ts` — Drizzle table definitions (§5).
- `src/db/client.ts` — builds a Drizzle client over Postgres (`postgres` driver) or SQLite
  (`better-sqlite3`) chosen from `DATABASE_URL`; exports the typed `db` handle.
- `src/ingest/rpc.ts` — thin wrappers: paginated `getSignaturesForAddress`, `getTransaction` → logs + meta.
- `src/ingest/decode.ts` — transaction → `LaplaceEvent[]` via SDK `parseLaplaceEvents`, mapped to `events` rows
  (assigns `event_index` = ordinal among recognized events in the tx).
- `src/ingest/poller.ts` — backfill + tail loop, cursor management, per-tick signature dedupe, retry/backoff,
  writes events + folds projections inside a DB transaction.
- `src/project/fold.ts` — applies a list of events to the `intents`/`validity_configs` projections (upserts);
  deterministic and replayable. Also exposes a `reproject()` that rebuilds projections from `events`.
- `src/queries/intents.ts`, `src/queries/stats.ts`, `src/queries/configs.ts` — typed read functions.
- `src/api/server.ts` — Hono read-only HTTP API.
- `src/bin/indexer.ts` — entrypoint: run the poller loop.
- `src/bin/api.ts` — entrypoint: run the API server.
- `src/bin/reproject.ts` — entrypoint: rebuild projections from `events`.
- `test/` — unit + integration tests (§8).

## 5. Data model (Drizzle; Postgres types, SQLite-compatible)

- **`events`** — source of truth, append-only.
  - PK: `(signature, event_index)`.
  - Columns: `signature` (text), `event_index` (int), `slot` (bigint), `block_time` (bigint, nullable),
    `program` (text: `laplace`|`validity`), `kind` (text: `IntentCreated|IntentFulfilled|IntentRefunded|IntentClosed|ValidityConfigCreated`),
    `intent_pda` (text, nullable for config events), `config_pda` (text, nullable), `payload` (json/jsonb).
  - Insert is on-conflict-do-nothing (idempotent).
- **`intents`** — projection, folded from `events`.
  - PK: `pda` (text). Columns: `id` (text/hex), `maker`, `receiver`, `refund_recipient`, `criterion_program`,
    `asset` (json: `{kind:'NativeSol'} | {kind:'SplToken', mint, tokenProgram, vault}`), `amount` (TEXT decimal
    string — token amounts can exceed JS `2^53`), `expiry_slot` (bigint), `created_slot` (bigint), `status`
    (`active|fulfilled|refunded`), `closed` (bool, default false), `created_sig`, `settled_sig` (nullable),
    `settled_slot` (bigint, nullable), `closed_sig` (nullable), `closed_slot` (bigint, nullable), `updated_slot` (bigint).
  - **Rows persist after `IntentClosed`** (account is gone on-chain; the indexer is the only record).
  - Indexes on `maker`, `receiver`, `status`, `created_slot`.
- **`validity_configs`** — projection. PK `config` (text). Columns: `config_hash`, `guest_elf_hash`,
  `sp1_vkey_hash`, `fixed_public_inputs_len` (int), `payer`, `created_sig`, `created_slot`.
- **`sync_state`** — resumable cursor. PK `program` (text). Columns: `last_signature` (nullable),
  `last_slot` (bigint, nullable), `backfilled` (bool).

Storage rule for 64-bit values: `amount` is a **TEXT decimal string** (token amounts can exceed JS `2^53`);
slots and `block_time` use a 64-bit integer column (a slot stays within JS `2^53` for ~10^8 years, so it is
safe as a `number`). The API surfaces `amount` as a string; the query module parses it to `bigint` internally.

## 6. Ingestion (cursor-based polling)

- **Backfill (one-time per program):** page `getSignaturesForAddress(program, {before, limit:1000})` newest→oldest
  down to `START_SLOT` (devnet history is small — programs deployed 2026-06-02). Mark `sync_state.backfilled`.
- **Tail (each tick):** `getSignaturesForAddress(program, {until: last_signature, limit:1000})`, collect across
  both programs, dedupe by signature, sort oldest→newest by `(slot, signature)`, then for each:
  `getTransaction(sig, {maxSupportedTransactionVersion:0, commitment:'finalized'})`; skip if `meta.err`;
  `parseLaplaceEvents(meta.logMessages)`; write event rows + fold projections in one DB transaction; advance
  `sync_state` only after commit.
- **Guarantees:** at-least-once delivery + idempotent writes ⇒ effectively exactly-once. Cursor never skips a
  gap; a crash resumes from `last_signature`. RPC errors → exponential backoff, cursor holds.

## 7. Queries + read API

- **Query module** (typed; reusable by the API and a future Next.js dashboard):
  - `listIntents({status?, maker?, receiver?, asset?, criterionProgram?, limit, cursor})` → page of intents.
  - `getIntent(pda)` → intent + its ordered event timeline (joined from `events`).
  - `stats()` → counts by status, total + settled volume by asset, settled-volume time buckets.
  - `listValidityConfigs({limit, cursor})`.
- **Read API** (Hono, read-only, JSON, paginated): `GET /intents`, `GET /intents/:pda`, `GET /stats`,
  `GET /validity-configs`, `GET /health`. CORS-enabled for the dashboard; no write endpoints.

## 8. Error handling & edge cases

- **Reorgs:** ingest at `finalized` commitment.
- **Idempotency:** `events` PK + projection upserts make restarts/replays safe.
- **Failed txns:** skipped (`meta.err != null`).
- **Log truncation:** some RPC providers cap log volume; `emit!` events live in `meta.logMessages`, so a
  truncating provider could drop an event. Mitigation: document a full/archival RPC requirement; `reproject`
  + a re-scan can recover once logs are available. (Matches the Design B spec's truncation note.)
- **Projection bugs:** `reproject()` rebuilds `intents`/`validity_configs` from the immutable `events` table.

## 9. Testing

- **Unit — `fold`:** given event sequences (create→fulfill→close, create→refund, out-of-order arrival),
  assert the resulting `intents` row, status transitions, `closed` flag, and replay idempotency (folding twice
  = folding once). Pure and fast.
- **Unit — `decode`:** fixture transaction logs → expected `events` rows (reuses SDK `parseLaplaceEvents`).
- **Integration — SQLite in-memory:** a mock RPC returns canned `getSignaturesForAddress`/`getTransaction`;
  run a poll tick; assert `events` + `intents` + `sync_state` rows and cursor advance.
- **Live — gated `LAPLACE_DEVNET=1`:** drive `createIntent`/fulfill/refund/close via `@laplace/sdk` against the
  live devnet programs, run a real poll tick, assert the DB reflects the lifecycle end-to-end.

## 10. Dependencies

`@laplace/sdk`, `@laplace/registry`, `@solana/kit` (already in the monorepo); `drizzle-orm` + `drizzle-kit`;
`postgres` (Postgres driver); `better-sqlite3` (SQLite dev/test); `hono` (read API). Dev: `vitest`, `tsup`,
`typescript`, `@types/node` — matching the existing SDK package conventions.

## 11. File-by-file deliverables

**New package `app/packages/indexer`:** `package.json`, `tsconfig.json`, `drizzle.config.ts`, and the
`src/**` + `test/**` files listed in §4. Wired into the npm workspace (`app/package.json` workspaces already
glob `packages/*`).

**Out of scope (→ Design C):** dashboard UI, charts, management actions UI, auth.
