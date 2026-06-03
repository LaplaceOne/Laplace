# Laplace Indexer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@laplace/indexer` — a TypeScript service that ingests Laplace lifecycle events from the chain (cursor-based RPC polling), stores them event-sourced in Postgres, and serves typed reads via a query module + thin HTTP API.

**Architecture:** Poll `getSignaturesForAddress` for the laplace + validity program IDs → `getTransaction` logs → decode with the SDK's `parseLaplaceEvents` → append to an idempotent `events` table → fold into `intents`/`validity_configs` projections → expose via a typed query module and a Hono read API.

**Tech Stack:** TypeScript (ESM), `@laplace/sdk` + `@laplace/registry`, `@solana/kit`, Drizzle ORM (`pg-core`), Postgres (`postgres.js`) for prod and **pglite** (`@electric-sql/pglite`, in-process Postgres) for dev/test, Hono for the read API, vitest.

**Spec:** `docs/superpowers/specs/2026-06-03-laplace-indexer-design.md`

**Design note (deviation from spec §2.3):** the spec said "same Drizzle schema on Postgres and SQLite," but Drizzle's `pg-core` and `sqlite-core` are distinct builders — one schema can't target both. We use a single `pg-core` schema with **pglite** (real Postgres in WASM) for dev/test and `postgres.js` for prod. Strictly better than SQLite (identical SQL semantics in tests), still zero-ops locally.

**Conventions (match existing packages):** ESM, `type: module`; tsconfig extends `@laplace/config/tsconfig.lib.json`; tsup via `@laplace/config/tsup`; vitest `include: ['test/**/*.test.ts']`; `tsconfig.base.json` has `strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax` (so use `import type` for types). Run npm from `app/`: `npm --prefix /Users/hash_548/Documents/GitHub/Laplace/app ...`. If an installed package's export name differs from this plan, read `node_modules/<pkg>` and adjust the import (do not invent).

**Branch:** `feat/indexer` (already created off `feat/lifecycle-events`, which carries the SDK `parseLaplaceEvents` this depends on).

---

### Task 1: Scaffold the `@laplace/indexer` package

**Files:**
- Create: `app/packages/indexer/package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`
- Create: `app/packages/indexer/src/config.ts`
- Create: `app/packages/indexer/test/config.test.ts`

- [ ] **Step 1: Create `package.json`**
```json
{
  "name": "@laplace/indexer",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", "require": "./dist/index.cjs" } },
  "files": ["dist", "drizzle"],
  "bin": {
    "laplace-indexer": "./dist/bin/indexer.js",
    "laplace-indexer-api": "./dist/bin/api.js",
    "laplace-reproject": "./dist/bin/reproject.js"
  },
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "tsc --noEmit",
    "db:generate": "drizzle-kit generate"
  },
  "dependencies": {
    "@laplace/registry": "*",
    "@laplace/sdk": "*",
    "@solana/kit": "^6.0.0",
    "drizzle-orm": "^0.36.0",
    "postgres": "^3.4.0",
    "@electric-sql/pglite": "^0.2.0",
    "hono": "^4.6.0"
  },
  "devDependencies": {
    "@laplace/config": "*",
    "drizzle-kit": "^0.28.0",
    "tsup": "^8.0.0",
    "typescript": "^5.7.3",
    "vitest": "^3.0.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**
```json
{ "extends": "@laplace/config/tsconfig.lib.json", "compilerOptions": { "rootDir": "src", "outDir": "dist", "types": ["node"] }, "include": ["src"] }
```

- [ ] **Step 3: Create `tsup.config.ts`**
```ts
import { defineConfig } from 'tsup';
import { baseConfig } from '@laplace/config/tsup';
export default defineConfig({
  ...baseConfig,
  entry: ['src/index.ts', 'src/bin/indexer.ts', 'src/bin/api.ts', 'src/bin/reproject.ts'],
});
```

- [ ] **Step 4: Create `vitest.config.ts`**
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } });
```

- [ ] **Step 5: Write the failing config test**

Create `app/packages/indexer/test/config.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('defaults to devnet + finalized + in-memory db', () => {
    const c = loadConfig({});
    expect(c.cluster).toBe('devnet');
    expect(c.commitment).toBe('finalized');
    expect(c.databaseUrl).toBe('memory://');
    expect(c.rpcUrl).toBe('https://api.devnet.solana.com');
    expect(c.pollIntervalMs).toBe(5000);
    expect(c.startSlot).toBeNull();
  });
  it('reads overrides from env', () => {
    const c = loadConfig({ LAPLACE_CLUSTER: 'devnet', DATABASE_URL: 'postgres://x', START_SLOT: '100', POLL_INTERVAL_MS: '1000' });
    expect(c.databaseUrl).toBe('postgres://x');
    expect(c.startSlot).toBe(100n);
    expect(c.pollIntervalMs).toBe(1000);
  });
});
```

- [ ] **Step 6: Run it — expect RED**

Run: `npm --prefix /Users/hash_548/Documents/GitHub/Laplace/app install` then
`npm --prefix /Users/hash_548/Documents/GitHub/Laplace/app run -s test -w @laplace/indexer -- config`
Expected: FAIL — cannot resolve `../src/config.js`.

- [ ] **Step 7: Implement `src/config.ts`**
```ts
import { getCluster, type Cluster } from '@laplace/registry';

export interface IndexerConfig {
  cluster: Cluster;
  rpcUrl: string;
  databaseUrl: string;
  pollIntervalMs: number;
  startSlot: bigint | null;
  commitment: 'processed' | 'confirmed' | 'finalized';
  apiPort: number;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): IndexerConfig {
  const cluster = (env.LAPLACE_CLUSTER ?? 'devnet') as Cluster;
  return {
    cluster,
    rpcUrl: env.LAPLACE_RPC_URL ?? getCluster(cluster).rpcUrl,
    databaseUrl: env.DATABASE_URL ?? 'memory://',
    pollIntervalMs: Number(env.POLL_INTERVAL_MS ?? '5000'),
    startSlot: env.START_SLOT ? BigInt(env.START_SLOT) : null,
    commitment: (env.COMMITMENT ?? 'finalized') as IndexerConfig['commitment'],
    apiPort: Number(env.API_PORT ?? '8787'),
  };
}
```

- [ ] **Step 8: Run it — expect GREEN**

Run: `npm --prefix /Users/hash_548/Documents/GitHub/Laplace/app run -s test -w @laplace/indexer -- config`
Expected: PASS (2 tests).

- [ ] **Step 9: Commit**
```bash
git add app/packages/indexer/package.json app/packages/indexer/tsconfig.json app/packages/indexer/tsup.config.ts app/packages/indexer/vitest.config.ts app/packages/indexer/src/config.ts app/packages/indexer/test/config.test.ts app/package-lock.json
git commit -m "feat(indexer): scaffold @laplace/indexer package + config"
```

---

### Task 2: DB schema, client, and migrations (pg-core; pglite dev/test, postgres.js prod)

**Files:**
- Create: `app/packages/indexer/src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`
- Create: `app/packages/indexer/test/db.test.ts`
- Generated: `app/packages/indexer/drizzle/**` (via drizzle-kit)

- [ ] **Step 1: Create `src/db/schema.ts`**
```ts
import { pgTable, text, integer, bigint, boolean, jsonb, primaryKey, index } from 'drizzle-orm/pg-core';

export const events = pgTable('events', {
  signature: text('signature').notNull(),
  eventIndex: integer('event_index').notNull(),
  slot: bigint('slot', { mode: 'number' }).notNull(),
  blockTime: bigint('block_time', { mode: 'number' }),
  program: text('program').notNull(),            // 'laplace' | 'validity'
  kind: text('kind').notNull(),                  // IntentCreated | ... | ValidityConfigCreated
  intentPda: text('intent_pda'),
  configPda: text('config_pda'),
  payload: jsonb('payload').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.signature, t.eventIndex] }),
  bySlot: index('events_slot_idx').on(t.slot),
  byIntent: index('events_intent_idx').on(t.intentPda),
}));

export const intents = pgTable('intents', {
  pda: text('pda').primaryKey(),
  id: text('id').notNull(),
  maker: text('maker').notNull(),
  receiver: text('receiver').notNull(),
  refundRecipient: text('refund_recipient').notNull(),
  criterionProgram: text('criterion_program').notNull(),
  asset: jsonb('asset').notNull(),               // {kind:'NativeSol'} | {kind:'SplToken',mint,tokenProgram,vault}
  amount: text('amount').notNull(),              // decimal string (u64 can exceed 2^53)
  expirySlot: bigint('expiry_slot', { mode: 'number' }).notNull(),
  createdSlot: bigint('created_slot', { mode: 'number' }).notNull(),
  status: text('status').notNull(),              // active | fulfilled | refunded
  closed: boolean('closed').notNull().default(false),
  createdSig: text('created_sig').notNull(),
  settledSig: text('settled_sig'),
  settledSlot: bigint('settled_slot', { mode: 'number' }),
  closedSig: text('closed_sig'),
  closedSlot: bigint('closed_slot', { mode: 'number' }),
  updatedSlot: bigint('updated_slot', { mode: 'number' }).notNull(),
}, (t) => ({
  byMaker: index('intents_maker_idx').on(t.maker),
  byReceiver: index('intents_receiver_idx').on(t.receiver),
  byStatus: index('intents_status_idx').on(t.status),
}));

export const validityConfigs = pgTable('validity_configs', {
  config: text('config').primaryKey(),
  configHash: text('config_hash').notNull(),
  guestElfHash: text('guest_elf_hash').notNull(),
  sp1VkeyHash: text('sp1_vkey_hash').notNull(),
  fixedPublicInputsLen: integer('fixed_public_inputs_len').notNull(),
  payer: text('payer').notNull(),
  createdSig: text('created_sig').notNull(),
  createdSlot: bigint('created_slot', { mode: 'number' }).notNull(),
});

export const syncState = pgTable('sync_state', {
  program: text('program').primaryKey(),
  lastSignature: text('last_signature'),
  lastSlot: bigint('last_slot', { mode: 'number' }),
  backfilled: boolean('backfilled').notNull().default(false),
});

export type EventRow = typeof events.$inferInsert;
export type IntentRow = typeof intents.$inferSelect;
```

- [ ] **Step 2: Create `src/db/client.ts`**
```ts
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePg } from 'drizzle-orm/postgres-js/migrator';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import postgres from 'postgres';
import { PGlite } from '@electric-sql/pglite';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = fileURLToPath(new URL('../../drizzle', import.meta.url));

function isPostgres(url: string): boolean {
  return url.startsWith('postgres://') || url.startsWith('postgresql://');
}

/** Build a Drizzle db. `postgres://…` → postgres.js; `memory://` → in-memory pglite; `file:PATH` → pglite on disk. */
export async function makeDb(databaseUrl: string): Promise<{ db: Db; migrate: () => Promise<void>; close: () => Promise<void> }> {
  if (isPostgres(databaseUrl)) {
    const client = postgres(databaseUrl, { max: 4 });
    const db = drizzlePg(client, { schema }) as unknown as Db;
    return { db, migrate: () => migratePg(db as never, { migrationsFolder: MIGRATIONS }), close: async () => { await client.end(); } };
  }
  const dataDir = databaseUrl === 'memory://' || databaseUrl === '' ? undefined : databaseUrl.replace(/^file:/, '');
  const client = new PGlite(dataDir);
  const db = drizzlePglite(client, { schema }) as unknown as Db;
  return { db, migrate: () => migratePglite(db as never, { migrationsFolder: MIGRATIONS }), close: async () => { await client.close(); } };
}
```

- [ ] **Step 3: Create `drizzle.config.ts`**
```ts
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
});
```

- [ ] **Step 4: Generate the SQL migrations**

Run: `npm --prefix /Users/hash_548/Documents/GitHub/Laplace/app run -s db:generate -w @laplace/indexer`
Expected: creates `app/packages/indexer/drizzle/0000_*.sql` + `drizzle/meta/**`.

- [ ] **Step 5: Write the failing db round-trip test**

Create `app/packages/indexer/test/db.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeDb } from '../src/db/client.js';
import { events } from '../src/db/schema.js';

describe('makeDb (pglite)', () => {
  it('migrates an in-memory db and round-trips an event row', async () => {
    const { db, migrate, close } = await makeDb('memory://');
    await migrate();
    await db.insert(events).values({
      signature: 'sig1', eventIndex: 0, slot: 10, blockTime: 1700000000,
      program: 'laplace', kind: 'IntentCreated', intentPda: 'pda1', configPda: null,
      payload: { amount: '5' },
    });
    const rows = await db.select().from(events);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe('IntentCreated');
    await close();
  });
});
```

- [ ] **Step 6: Run it — expect GREEN** (schema+client+migrations all exercised)

Run: `npm --prefix /Users/hash_548/Documents/GitHub/Laplace/app run -s test -w @laplace/indexer -- db`
Expected: PASS. (If it fails on a drizzle/pglite import path, read `node_modules/drizzle-orm/pglite` and `node_modules/@electric-sql/pglite` to correct the import, then re-run.)

- [ ] **Step 7: Commit**
```bash
git add app/packages/indexer/src/db app/packages/indexer/drizzle.config.ts app/packages/indexer/drizzle app/packages/indexer/test/db.test.ts app/package-lock.json
git commit -m "feat(indexer): drizzle pg-core schema + pglite/postgres client + migrations"
```

---

### Task 3: Decode transactions → event rows

**Files:**
- Create: `app/packages/indexer/src/ingest/decode.ts`
- Create: `app/packages/indexer/test/decode.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/packages/indexer/test/decode.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  getAddressEncoder, getStructEncoder, getBytesEncoder, fixEncoderSize,
  getU16Encoder, getU64Encoder,
} from '@solana/kit';
import { getEscrowAssetEncoder } from '@laplace/sdk/raw'; // if not re-exported, import from '@laplace/sdk'
import { EVENT_DISCRIMINATORS } from '@laplace/sdk';
import { decodeTxEvents, type RawTx } from '../src/ingest/decode.js';

const PDA = '11111111111111111111111111111111';
const KEY = 'So11111111111111111111111111111111111111112';

const createdEncoder = getStructEncoder([
  ['intent', getAddressEncoder()], ['id', fixEncoderSize(getBytesEncoder(), 32)],
  ['maker', getAddressEncoder()], ['receiver', getAddressEncoder()],
  ['refundRecipient', getAddressEncoder()], ['criterionProgram', getAddressEncoder()],
  ['criterionDataHash', fixEncoderSize(getBytesEncoder(), 32)], ['criterionInterfaceVersion', getU16Encoder()],
  ['asset', getEscrowAssetEncoder()], ['amount', getU64Encoder()],
  ['expirySlot', getU64Encoder()], ['createdSlot', getU64Encoder()],
]);

function programData(disc: Uint8Array, payload: Uint8Array): string {
  const d = new Uint8Array(disc.length + payload.length);
  d.set(disc, 0); d.set(payload, disc.length);
  return `Program data: ${Buffer.from(d).toString('base64')}`;
}

describe('decodeTxEvents', () => {
  it('maps a successful tx with an IntentCreated log to one event row', () => {
    const payload = createdEncoder.encode({
      intent: PDA, id: new Uint8Array(32).fill(1), maker: KEY, receiver: KEY, refundRecipient: KEY,
      criterionProgram: KEY, criterionDataHash: new Uint8Array(32).fill(2), criterionInterfaceVersion: 2,
      asset: { __kind: 'NativeSol' }, amount: 7n, expirySlot: 99n, createdSlot: 10n,
    });
    const tx: RawTx = {
      signature: 'sigA', slot: 10, blockTime: 1700000000, err: null,
      logMessages: ['Program log: Instruction: CreateIntent', programData(EVENT_DISCRIMINATORS.IntentCreated, new Uint8Array(payload))],
    };
    const rows = decodeTxEvents(tx, 'laplace');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ signature: 'sigA', eventIndex: 0, kind: 'IntentCreated', intentPda: PDA, amount: '7' });
  });

  it('returns no rows for a failed tx', () => {
    const tx: RawTx = { signature: 'bad', slot: 1, blockTime: null, err: { some: 'error' }, logMessages: [] };
    expect(decodeTxEvents(tx, 'laplace')).toHaveLength(0);
  });
});
```
> If `getEscrowAssetEncoder` is not exported from `@laplace/sdk`/`@laplace/sdk/raw`, import it from the generated path the SDK already exposes, or skip the asset round-trip and assert only the scalar fields. Read the SDK's `src/index.ts`/`raw.ts` exports to confirm.

- [ ] **Step 2: Run it — expect RED**

Run: `npm --prefix /Users/hash_548/Documents/GitHub/Laplace/app run -s test -w @laplace/indexer -- decode`
Expected: FAIL — cannot resolve `../src/ingest/decode.js`.

- [ ] **Step 3: Implement `src/ingest/decode.ts`**
```ts
import { parseLaplaceEvents, type LaplaceEvent } from '@laplace/sdk';
import type { EventRow } from '../db/schema.js';

export interface RawTx {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown | null;
  logMessages: string[];
}

function intentPdaOf(e: LaplaceEvent): string | null {
  return 'intent' in e ? (e.intent as string) : null;
}
function configPdaOf(e: LaplaceEvent): string | null {
  return e.kind === 'ValidityConfigCreated' ? (e.config as string) : null;
}

// JSON-safe payload: stringify bigints (amount, slots) so jsonb can store them losslessly.
function toPayload(e: LaplaceEvent): unknown {
  return JSON.parse(JSON.stringify(e, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

/** Decode a confirmed transaction's logs into event rows. Failed txs yield none. */
export function decodeTxEvents(tx: RawTx, program: 'laplace' | 'validity'): EventRow[] {
  if (tx.err != null) return [];
  const events = parseLaplaceEvents(tx.logMessages);
  return events.map((e, i) => ({
    signature: tx.signature,
    eventIndex: i,
    slot: tx.slot,
    blockTime: tx.blockTime,
    program,
    kind: e.kind,
    intentPda: intentPdaOf(e),
    configPda: configPdaOf(e),
    payload: toPayload(e),
  }));
}
```

- [ ] **Step 4: Run it — expect GREEN**

Run: `npm --prefix /Users/hash_548/Documents/GitHub/Laplace/app run -s test -w @laplace/indexer -- decode`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**
```bash
git add app/packages/indexer/src/ingest/decode.ts app/packages/indexer/test/decode.test.ts
git commit -m "feat(indexer): decode transactions to event rows via SDK parseLaplaceEvents"
```

---

### Task 4: Projection fold (events → intents / validity_configs)

**Files:**
- Create: `app/packages/indexer/src/project/fold.ts`
- Create: `app/packages/indexer/test/fold.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/packages/indexer/test/fold.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeDb } from '../src/db/client.js';
import { applyEvents } from '../src/project/fold.js';
import { intents } from '../src/db/schema.js';
import type { EventRow } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

const base = { signature: 's', eventIndex: 0, slot: 1, blockTime: 1, program: 'laplace' as const, configPda: null };
function ev(kind: string, slot: number, sig: string, payload: Record<string, unknown>): EventRow {
  return { ...base, signature: sig, slot, kind, intentPda: 'P', payload } as EventRow;
}

describe('applyEvents', () => {
  it('folds create→fulfill→close into one intent row', async () => {
    const { db, migrate, close } = await makeDb('memory://');
    await migrate();
    await applyEvents(db, [
      ev('IntentCreated', 1, 'c', { intent: 'P', id: 'aa', maker: 'M', receiver: 'R', refundRecipient: 'F', criterionProgram: 'C', criterionDataHash: 'bb', criterionInterfaceVersion: 2, asset: { __kind: 'NativeSol' }, amount: '500', expirySlot: '99', createdSlot: '1' }),
      ev('IntentFulfilled', 2, 'f', { intent: 'P', amount: '500', slot: '2' }),
      ev('IntentClosed', 3, 'x', { intent: 'P', finalStatus: 1, slot: '3' }),
    ]);
    const [row] = await db.select().from(intents).where(eq(intents.pda, 'P'));
    expect(row?.status).toBe('fulfilled');
    expect(row?.closed).toBe(true);
    expect(row?.amount).toBe('500');
    expect(row?.settledSlot).toBe(2);
    await close();
  });

  it('is idempotent (folding twice equals once)', async () => {
    const { db, migrate, close } = await makeDb('memory://');
    await migrate();
    const seq = [
      ev('IntentCreated', 1, 'c', { intent: 'P', id: 'aa', maker: 'M', receiver: 'R', refundRecipient: 'F', criterionProgram: 'C', criterionDataHash: 'bb', criterionInterfaceVersion: 2, asset: { __kind: 'NativeSol' }, amount: '1', expirySlot: '9', createdSlot: '1' }),
      ev('IntentRefunded', 5, 'r', { intent: 'P', amount: '1', slot: '5' }),
    ];
    await applyEvents(db, seq);
    await applyEvents(db, seq);
    const rows = await db.select().from(intents);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('refunded');
    await close();
  });
});
```

- [ ] **Step 2: Run it — expect RED**

Run: `npm --prefix /Users/hash_548/Documents/GitHub/Laplace/app run -s test -w @laplace/indexer -- fold`
Expected: FAIL — cannot resolve `../src/project/fold.js`.

- [ ] **Step 3: Implement `src/project/fold.ts`**
```ts
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { events as eventsTable, intents, validityConfigs, type EventRow } from '../db/schema.js';

type Payload = Record<string, unknown>;
const str = (p: Payload, k: string): string => String(p[k]);
const num = (p: Payload, k: string): number => Number(p[k]);

/** Apply event rows to the projections, ordered by (slot, signature, eventIndex). Idempotent. */
export async function applyEvents(db: Db, rows: EventRow[]): Promise<void> {
  const ordered = [...rows].sort((a, b) => a.slot - b.slot || a.signature.localeCompare(b.signature) || a.eventIndex - b.eventIndex);
  for (const r of ordered) {
    const p = r.payload as Payload;
    switch (r.kind) {
      case 'IntentCreated': {
        await db.insert(intents).values({
          pda: str(p, 'intent'), id: str(p, 'id'), maker: str(p, 'maker'), receiver: str(p, 'receiver'),
          refundRecipient: str(p, 'refundRecipient'), criterionProgram: str(p, 'criterionProgram'),
          asset: p.asset, amount: str(p, 'amount'), expirySlot: num(p, 'expirySlot'), createdSlot: num(p, 'createdSlot'),
          status: 'active', closed: false, createdSig: r.signature, updatedSlot: r.slot,
        }).onConflictDoUpdate({
          target: intents.pda,
          set: { maker: str(p, 'maker'), receiver: str(p, 'receiver'), amount: str(p, 'amount'), updatedSlot: r.slot },
        });
        break;
      }
      case 'IntentFulfilled':
        await db.update(intents).set({ status: 'fulfilled', settledSig: r.signature, settledSlot: r.slot, updatedSlot: r.slot }).where(eq(intents.pda, str(p, 'intent')));
        break;
      case 'IntentRefunded':
        await db.update(intents).set({ status: 'refunded', settledSig: r.signature, settledSlot: r.slot, updatedSlot: r.slot }).where(eq(intents.pda, str(p, 'intent')));
        break;
      case 'IntentClosed':
        await db.update(intents).set({ closed: true, closedSig: r.signature, closedSlot: r.slot, updatedSlot: r.slot }).where(eq(intents.pda, str(p, 'intent')));
        break;
      case 'ValidityConfigCreated':
        await db.insert(validityConfigs).values({
          config: str(p, 'config'), configHash: str(p, 'configHash'), guestElfHash: str(p, 'guestElfHash'),
          sp1VkeyHash: str(p, 'sp1VkeyHash'), fixedPublicInputsLen: num(p, 'fixedPublicInputsLen'),
          payer: str(p, 'payer'), createdSig: r.signature, createdSlot: r.slot,
        }).onConflictDoNothing();
        break;
    }
  }
}

/** Rebuild all projections from the immutable events table. */
export async function reproject(db: Db): Promise<void> {
  await db.delete(intents);
  await db.delete(validityConfigs);
  const all = await db.select().from(eventsTable);
  await applyEvents(db, all as EventRow[]);
}
```

- [ ] **Step 4: Run it — expect GREEN**

Run: `npm --prefix /Users/hash_548/Documents/GitHub/Laplace/app run -s test -w @laplace/indexer -- fold`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**
```bash
git add app/packages/indexer/src/project/fold.ts app/packages/indexer/test/fold.test.ts
git commit -m "feat(indexer): event-fold projection + reproject"
```

---

### Task 5: RPC layer + poller (cursor-based ingest)

**Files:**
- Create: `app/packages/indexer/src/ingest/rpc.ts`, `src/ingest/poller.ts`
- Create: `app/packages/indexer/test/poller.test.ts`

- [ ] **Step 1: Implement `src/ingest/rpc.ts`** (thin, untested directly — covered via the poller's mock)
```ts
import type { RawTx } from './decode.js';

export interface SigInfo { signature: string; slot: number; err: unknown | null }

export interface ChainSource {
  getSignatures(program: string, opts: { until?: string; before?: string; limit: number }): Promise<SigInfo[]>;
  getTx(signature: string): Promise<RawTx | null>;
}

/** A ChainSource backed by a @solana/kit rpc. */
export function rpcSource(rpc: any, commitment: 'processed' | 'confirmed' | 'finalized'): ChainSource {
  return {
    async getSignatures(program, opts) {
      const res = await rpc.getSignaturesForAddress(program, { limit: opts.limit, until: opts.until, before: opts.before, commitment }).send();
      return (res as any[]).map((s) => ({ signature: s.signature, slot: Number(s.slot), err: s.err ?? null }));
    },
    async getTx(signature) {
      const tx = await rpc.getTransaction(signature, { maxSupportedTransactionVersion: 0, encoding: 'json', commitment }).send();
      if (!tx) return null;
      return {
        signature,
        slot: Number(tx.slot),
        blockTime: tx.blockTime == null ? null : Number(tx.blockTime),
        err: tx.meta?.err ?? null,
        logMessages: tx.meta?.logMessages ?? [],
      };
    },
  };
}
```

- [ ] **Step 2: Write the failing poller test (mock ChainSource)**

Create `app/packages/indexer/test/poller.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  getAddressEncoder, getStructEncoder, getBytesEncoder, fixEncoderSize, getU16Encoder, getU64Encoder,
} from '@solana/kit';
import { getEscrowAssetEncoder } from '@laplace/sdk/raw';
import { EVENT_DISCRIMINATORS } from '@laplace/sdk';
import { makeDb } from '../src/db/client.js';
import { runOnce } from '../src/ingest/poller.js';
import type { ChainSource, SigInfo } from '../src/ingest/rpc.js';
import type { RawTx } from '../src/ingest/decode.js';
import { intents, syncState } from '../src/db/schema.js';

const PDA = '11111111111111111111111111111111';
const KEY = 'So11111111111111111111111111111111111111112';
const createdEncoder = getStructEncoder([
  ['intent', getAddressEncoder()], ['id', fixEncoderSize(getBytesEncoder(), 32)], ['maker', getAddressEncoder()],
  ['receiver', getAddressEncoder()], ['refundRecipient', getAddressEncoder()], ['criterionProgram', getAddressEncoder()],
  ['criterionDataHash', fixEncoderSize(getBytesEncoder(), 32)], ['criterionInterfaceVersion', getU16Encoder()],
  ['asset', getEscrowAssetEncoder()], ['amount', getU64Encoder()], ['expirySlot', getU64Encoder()], ['createdSlot', getU64Encoder()],
]);
function pd(disc: Uint8Array, payload: Uint8Array): string {
  const d = new Uint8Array(disc.length + payload.length); d.set(disc); d.set(payload, disc.length);
  return `Program data: ${Buffer.from(d).toString('base64')}`;
}

function mockSource(): ChainSource {
  const payload = createdEncoder.encode({
    intent: PDA, id: new Uint8Array(32).fill(1), maker: KEY, receiver: KEY, refundRecipient: KEY,
    criterionProgram: KEY, criterionDataHash: new Uint8Array(32).fill(2), criterionInterfaceVersion: 2,
    asset: { __kind: 'NativeSol' }, amount: 500n, expirySlot: 99n, createdSlot: 10n,
  });
  const tx: RawTx = { signature: 'sigA', slot: 10, blockTime: 1, err: null, logMessages: [pd(EVENT_DISCRIMINATORS.IntentCreated, new Uint8Array(payload))] };
  return {
    async getSignatures(program): Promise<SigInfo[]> {
      return program === 'laplaceProg' ? [{ signature: 'sigA', slot: 10, err: null }] : [];
    },
    async getTx() { return tx; },
  };
}

describe('runOnce', () => {
  it('ingests new signatures into events + intents and advances the cursor', async () => {
    const { db, migrate, close } = await makeDb('memory://');
    await migrate();
    await runOnce(db, mockSource(), { laplace: 'laplaceProg', validity: 'validityProg' }, 1000);
    const rows = await db.select().from(intents);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('active');
    expect(rows[0]?.amount).toBe('500');
    const sync = await db.select().from(syncState);
    const laplaceCursor = sync.find((s) => s.program === 'laplace');
    expect(laplaceCursor?.lastSignature).toBe('sigA');
    await close();
  });
});
```

- [ ] **Step 3: Run it — expect RED**

Run: `npm --prefix /Users/hash_548/Documents/GitHub/Laplace/app run -s test -w @laplace/indexer -- poller`
Expected: FAIL — cannot resolve `../src/ingest/poller.js`.

- [ ] **Step 4: Implement `src/ingest/poller.ts`**
```ts
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import type { ChainSource } from './rpc.js';
import { decodeTxEvents, type RawTx } from './decode.js';
import { applyEvents } from '../project/fold.js';
import { events as eventsTable, syncState, type EventRow } from '../db/schema.js';

export interface ProgramIds { laplace: string; validity: string }

async function cursor(db: Db, program: string): Promise<string | undefined> {
  const [row] = await db.select().from(syncState).where(eq(syncState.program, program));
  return row?.lastSignature ?? undefined;
}
async function setCursor(db: Db, program: string, signature: string, slot: number): Promise<void> {
  await db.insert(syncState).values({ program, lastSignature: signature, lastSlot: slot, backfilled: true })
    .onConflictDoUpdate({ target: syncState.program, set: { lastSignature: signature, lastSlot: slot } });
}

/** One tail tick: fetch new signatures for both programs, decode, persist events + projections, advance cursors. */
export async function runOnce(db: Db, src: ChainSource, ids: ProgramIds, limit: number): Promise<number> {
  const programs: [keyof ProgramIds, string][] = [['laplace', ids.laplace], ['validity', ids.validity]];
  // collect (program -> newest-first signatures since cursor)
  const perProgram = new Map<keyof ProgramIds, { signature: string; slot: number }[]>();
  for (const [name, addr] of programs) {
    const until = await cursor(db, name);
    const sigs = await src.getSignatures(addr, { until, limit });
    perProgram.set(name, sigs.filter((s) => s.err == null).map((s) => ({ signature: s.signature, slot: s.slot })));
  }
  // dedupe signatures across programs, remember which program first surfaced each (for the cursor)
  const seen = new Set<string>();
  const unique: { program: keyof ProgramIds; signature: string; slot: number }[] = [];
  for (const [name] of programs) {
    for (const s of perProgram.get(name) ?? []) {
      if (seen.has(s.signature)) continue;
      seen.add(s.signature);
      unique.push({ program: name, signature: s.signature, slot: s.slot });
    }
  }
  // process oldest -> newest
  unique.sort((a, b) => a.slot - b.slot || a.signature.localeCompare(b.signature));
  let count = 0;
  for (const u of unique) {
    const tx: RawTx | null = await src.getTx(u.signature);
    if (!tx) continue;
    const rows: EventRow[] = decodeTxEvents(tx, u.program);
    if (rows.length) {
      await db.insert(eventsTable).values(rows).onConflictDoNothing();
      await applyEvents(db, rows);
      count += rows.length;
    }
  }
  // advance each program cursor to its newest signature this tick
  for (const [name] of programs) {
    const list = perProgram.get(name) ?? [];
    const newest = list.reduce<{ signature: string; slot: number } | null>((m, s) => (m && m.slot >= s.slot ? m : s), null);
    if (newest) await setCursor(db, name, newest.signature, newest.slot);
  }
  return count;
}
```
> Cursor semantics: `getSignaturesForAddress` returns newest-first; `until` returns everything *newer than* that signature. The newest item this tick becomes the next cursor. Backfill (paging with `before` down to `START_SLOT`) is added in the bin entrypoint (Task 8) by looping `before` until empty; `runOnce` handles the steady-state tail.

- [ ] **Step 5: Run it — expect GREEN**

Run: `npm --prefix /Users/hash_548/Documents/GitHub/Laplace/app run -s test -w @laplace/indexer -- poller`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add app/packages/indexer/src/ingest/rpc.ts app/packages/indexer/src/ingest/poller.ts app/packages/indexer/test/poller.test.ts
git commit -m "feat(indexer): cursor-based poller + rpc source"
```

---

### Task 6: Typed query module

**Files:**
- Create: `app/packages/indexer/src/queries/intents.ts`, `src/queries/stats.ts`, `src/queries/configs.ts`
- Create: `app/packages/indexer/test/queries.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/packages/indexer/test/queries.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeDb } from '../src/db/client.js';
import { applyEvents } from '../src/project/fold.js';
import { listIntents, getIntent } from '../src/queries/intents.js';
import { stats } from '../src/queries/stats.js';
import type { EventRow } from '../src/db/schema.js';

const base = { eventIndex: 0, blockTime: 1, program: 'laplace' as const, configPda: null };
function ev(kind: string, slot: number, sig: string, intentPda: string, payload: Record<string, unknown>): EventRow {
  return { ...base, signature: sig, slot, kind, intentPda, payload } as EventRow;
}
function created(pda: string, maker: string, amount: string, slot: number): EventRow {
  return ev('IntentCreated', slot, `c${pda}`, pda, { intent: pda, id: 'aa', maker, receiver: 'R', refundRecipient: 'F', criterionProgram: 'C', criterionDataHash: 'bb', criterionInterfaceVersion: 2, asset: { __kind: 'NativeSol' }, amount, expirySlot: '99', createdSlot: String(slot) });
}

describe('queries', () => {
  it('lists/filters intents, returns a timeline, and aggregates stats', async () => {
    const { db, migrate, close } = await makeDb('memory://');
    await migrate();
    await applyEvents(db, [
      created('P1', 'M1', '100', 1),
      created('P2', 'M2', '250', 2),
      ev('IntentFulfilled', 3, 'f', 'P1', { intent: 'P1', amount: '100', slot: '3' }),
    ]);
    // also persist events for the timeline join
    const { events: eventsTable } = await import('../src/db/schema.js');
    await db.insert(eventsTable).values([created('P1', 'M1', '100', 1), ev('IntentFulfilled', 3, 'f', 'P1', { intent: 'P1', amount: '100', slot: '3' })]);

    const all = await listIntents(db, { limit: 10 });
    expect(all.length).toBe(2);
    const byMaker = await listIntents(db, { maker: 'M2', limit: 10 });
    expect(byMaker.map((i) => i.pda)).toEqual(['P2']);

    const one = await getIntent(db, 'P1');
    expect(one?.intent.status).toBe('fulfilled');
    expect(one?.timeline.length).toBe(2);

    const s = await stats(db);
    expect(s.byStatus.active).toBe(1);
    expect(s.byStatus.fulfilled).toBe(1);
    await close();
  });
});
```

- [ ] **Step 2: Run it — expect RED**

Run: `npm --prefix /Users/hash_548/Documents/GitHub/Laplace/app run -s test -w @laplace/indexer -- queries`
Expected: FAIL — cannot resolve query modules.

- [ ] **Step 3: Implement `src/queries/intents.ts`**
```ts
import { and, asc, desc, eq, lt, type SQL } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { intents, events as eventsTable, type IntentRow } from '../db/schema.js';

export interface IntentFilter {
  status?: string; maker?: string; receiver?: string; criterionProgram?: string;
  limit: number; cursorSlot?: number;
}

export async function listIntents(db: Db, f: IntentFilter): Promise<IntentRow[]> {
  const conds: SQL[] = [];
  if (f.status) conds.push(eq(intents.status, f.status));
  if (f.maker) conds.push(eq(intents.maker, f.maker));
  if (f.receiver) conds.push(eq(intents.receiver, f.receiver));
  if (f.criterionProgram) conds.push(eq(intents.criterionProgram, f.criterionProgram));
  if (f.cursorSlot != null) conds.push(lt(intents.createdSlot, f.cursorSlot));
  return db.select().from(intents)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(intents.createdSlot))
    .limit(f.limit);
}

export interface IntentDetail { intent: IntentRow; timeline: { kind: string; signature: string; slot: number }[] }

export async function getIntent(db: Db, pda: string): Promise<IntentDetail | null> {
  const [row] = await db.select().from(intents).where(eq(intents.pda, pda));
  if (!row) return null;
  const tl = await db.select({ kind: eventsTable.kind, signature: eventsTable.signature, slot: eventsTable.slot })
    .from(eventsTable).where(eq(eventsTable.intentPda, pda)).orderBy(asc(eventsTable.slot), asc(eventsTable.eventIndex));
  return { intent: row, timeline: tl };
}
```

- [ ] **Step 4: Implement `src/queries/stats.ts`**
```ts
import type { Db } from '../db/client.js';
import { intents } from '../db/schema.js';

export interface Stats {
  byStatus: Record<'active' | 'fulfilled' | 'refunded', number>;
  closed: number;
  total: number;
}

export async function stats(db: Db): Promise<Stats> {
  const rows = await db.select().from(intents);
  const byStatus = { active: 0, fulfilled: 0, refunded: 0 };
  let closed = 0;
  for (const r of rows) {
    if (r.status === 'active' || r.status === 'fulfilled' || r.status === 'refunded') byStatus[r.status]++;
    if (r.closed) closed++;
  }
  return { byStatus, closed, total: rows.length };
}
```

- [ ] **Step 5: Implement `src/queries/configs.ts`**
```ts
import { desc } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { validityConfigs } from '../db/schema.js';

export async function listValidityConfigs(db: Db, limit = 50) {
  return db.select().from(validityConfigs).orderBy(desc(validityConfigs.createdSlot)).limit(limit);
}
```

- [ ] **Step 6: Run it — expect GREEN**

Run: `npm --prefix /Users/hash_548/Documents/GitHub/Laplace/app run -s test -w @laplace/indexer -- queries`
Expected: PASS.

- [ ] **Step 7: Commit**
```bash
git add app/packages/indexer/src/queries app/packages/indexer/test/queries.test.ts
git commit -m "feat(indexer): typed query module (intents, stats, configs)"
```

---

### Task 7: Thin read HTTP API (Hono)

**Files:**
- Create: `app/packages/indexer/src/api/server.ts`
- Create: `app/packages/indexer/test/api.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/packages/indexer/test/api.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeDb } from '../src/db/client.js';
import { applyEvents } from '../src/project/fold.js';
import { createApi } from '../src/api/server.js';
import type { EventRow } from '../src/db/schema.js';

function created(pda: string, maker: string, amount: string, slot: number): EventRow {
  return { signature: `c${pda}`, eventIndex: 0, slot, blockTime: 1, program: 'laplace', kind: 'IntentCreated', intentPda: pda, configPda: null,
    payload: { intent: pda, id: 'aa', maker, receiver: 'R', refundRecipient: 'F', criterionProgram: 'C', criterionDataHash: 'bb', criterionInterfaceVersion: 2, asset: { __kind: 'NativeSol' }, amount, expirySlot: '99', createdSlot: String(slot) } } as EventRow;
}

describe('read API', () => {
  it('serves /health, /intents, /intents/:pda, /stats', async () => {
    const { db, migrate, close } = await makeDb('memory://');
    await migrate();
    await applyEvents(db, [created('P1', 'M1', '100', 1)]);
    const app = createApi(db);

    expect((await app.request('/health')).status).toBe(200);

    const list = await (await app.request('/intents')).json();
    expect(list.intents.length).toBe(1);
    expect(list.intents[0].amount).toBe('100');

    const one = await (await app.request('/intents/P1')).json();
    expect(one.intent.pda).toBe('P1');

    const stats = await (await app.request('/stats')).json();
    expect(stats.total).toBe(1);

    expect((await app.request('/intents/NOPE')).status).toBe(404);
    await close();
  });
});
```

- [ ] **Step 2: Run it — expect RED**

Run: `npm --prefix /Users/hash_548/Documents/GitHub/Laplace/app run -s test -w @laplace/indexer -- api`
Expected: FAIL — cannot resolve `../src/api/server.js`.

- [ ] **Step 3: Implement `src/api/server.ts`**
```ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Db } from '../db/client.js';
import { listIntents, getIntent } from '../queries/intents.js';
import { stats } from '../queries/stats.js';
import { listValidityConfigs } from '../queries/configs.js';

export function createApi(db: Db): Hono {
  const app = new Hono();
  app.use('*', cors());
  app.get('/health', (c) => c.json({ ok: true }));

  app.get('/intents', async (c) => {
    const q = c.req.query();
    const intents = await listIntents(db, {
      status: q.status, maker: q.maker, receiver: q.receiver, criterionProgram: q.criterion,
      limit: Math.min(Number(q.limit ?? '50'), 200),
      cursorSlot: q.cursorSlot ? Number(q.cursorSlot) : undefined,
    });
    return c.json({ intents });
  });

  app.get('/intents/:pda', async (c) => {
    const detail = await getIntent(db, c.req.param('pda'));
    if (!detail) return c.json({ error: 'not found' }, 404);
    return c.json(detail);
  });

  app.get('/stats', async (c) => c.json(await stats(db)));
  app.get('/validity-configs', async (c) => c.json({ configs: await listValidityConfigs(db) }));
  return app;
}
```

- [ ] **Step 4: Run it — expect GREEN**

Run: `npm --prefix /Users/hash_548/Documents/GitHub/Laplace/app run -s test -w @laplace/indexer -- api`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add app/packages/indexer/src/api/server.ts app/packages/indexer/test/api.test.ts
git commit -m "feat(indexer): hono read API (intents, stats, configs)"
```

---

### Task 8: Entrypoints + barrel + run docs

**Files:**
- Create: `app/packages/indexer/src/index.ts`, `src/bin/indexer.ts`, `src/bin/api.ts`, `src/bin/reproject.ts`, `README.md`

- [ ] **Step 1: Create the barrel `src/index.ts`**
```ts
export * from './config.js';
export * from './db/schema.js';
export * from './db/client.js';
export * from './ingest/decode.js';
export * from './ingest/rpc.js';
export * from './ingest/poller.js';
export * from './project/fold.js';
export * from './queries/intents.js';
export * from './queries/stats.js';
export * from './queries/configs.js';
export { createApi } from './api/server.js';
```

- [ ] **Step 2: Create `src/bin/indexer.ts` (backfill + tail loop)**
```ts
import { createSolanaRpc } from '@solana/kit';
import { getCluster } from '@laplace/registry';
import { loadConfig } from '../config.js';
import { makeDb } from '../db/client.js';
import { rpcSource } from '../ingest/rpc.js';
import { runOnce, type ProgramIds } from '../ingest/poller.js';

async function main() {
  const cfg = loadConfig();
  const { programs } = getCluster(cfg.cluster);
  const ids: ProgramIds = { laplace: programs.laplace, validity: programs.validity };
  const { db, migrate } = await makeDb(cfg.databaseUrl);
  await migrate();
  const src = rpcSource(createSolanaRpc(cfg.rpcUrl), cfg.commitment);
  // eslint-disable-next-line no-console
  console.log(`[indexer] ${cfg.cluster} ${cfg.rpcUrl} every ${cfg.pollIntervalMs}ms`);
  for (;;) {
    try {
      const n = await runOnce(db, src, ids, 1000);
      if (n) console.log(`[indexer] ingested ${n} events`);
    } catch (err) {
      console.error('[indexer] tick failed, backing off', err);
    }
    await new Promise((r) => setTimeout(r, cfg.pollIntervalMs));
  }
}
main();
```

- [ ] **Step 3: Create `src/bin/api.ts`**
```ts
import { serve } from '@hono/node-server';
import { loadConfig } from '../config.js';
import { makeDb } from '../db/client.js';
import { createApi } from '../api/server.js';

async function main() {
  const cfg = loadConfig();
  const { db, migrate } = await makeDb(cfg.databaseUrl);
  await migrate();
  const app = createApi(db);
  serve({ fetch: app.fetch, port: cfg.apiPort });
  // eslint-disable-next-line no-console
  console.log(`[indexer-api] listening on :${cfg.apiPort}`);
}
main();
```
> Add `@hono/node-server` to `dependencies` in `package.json` (Step 5), since the API entrypoint needs a Node server adapter (the API test uses `app.request` and does not).

- [ ] **Step 4: Create `src/bin/reproject.ts`**
```ts
import { loadConfig } from '../config.js';
import { makeDb } from '../db/client.js';
import { reproject } from '../project/fold.js';

async function main() {
  const cfg = loadConfig();
  const { db, migrate, close } = await makeDb(cfg.databaseUrl);
  await migrate();
  await reproject(db);
  await close();
  // eslint-disable-next-line no-console
  console.log('[reproject] projections rebuilt from events');
}
main();
```

- [ ] **Step 5: Add `@hono/node-server` dependency**

In `app/packages/indexer/package.json` `dependencies`, add `"@hono/node-server": "^1.13.0"`, then
`npm --prefix /Users/hash_548/Documents/GitHub/Laplace/app install`.

- [ ] **Step 6: Create `README.md`**
```markdown
# @laplace/indexer

Ingests Laplace lifecycle events into Postgres and serves typed reads.

## Env
- `LAPLACE_CLUSTER` (default `devnet`), `LAPLACE_RPC_URL` (default from registry)
- `DATABASE_URL` — `postgres://…` (prod), `memory://` (default, ephemeral pglite), or `file:./data` (pglite on disk)
- `POLL_INTERVAL_MS` (default 5000), `START_SLOT`, `COMMITMENT` (default `finalized`), `API_PORT` (default 8787)

## Run
- Ingest worker: `node dist/bin/indexer.js`  (or `npx laplace-indexer`)
- Read API:      `node dist/bin/api.js`       (or `npx laplace-indexer-api`)
- Rebuild projections from events: `node dist/bin/reproject.js`

Generate migrations after a schema change: `npm run db:generate`.
```

- [ ] **Step 7: Typecheck the whole package**

Run: `npm --prefix /Users/hash_548/Documents/GitHub/Laplace/app run -s typecheck -w @laplace/indexer`
Expected: exit 0.

- [ ] **Step 8: Commit**
```bash
git add app/packages/indexer/src/index.ts app/packages/indexer/src/bin app/packages/indexer/README.md app/packages/indexer/package.json app/package-lock.json
git commit -m "feat(indexer): entrypoints (ingest/api/reproject) + barrel + docs"
```

---

### Task 9: Live devnet integration test (gated)

**Files:**
- Create: `app/packages/indexer/test/integration/devnet.test.ts`

- [ ] **Step 1: Write the gated integration test**

Create `app/packages/indexer/test/integration/devnet.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createSolanaRpc, createSolanaRpcSubscriptions, generateKeyPairSigner, airdropFactory, lamports } from '@solana/kit';
import { getCluster } from '@laplace/registry';
import { Laplace, Condition } from '@laplace/sdk';
import { makeDb } from '../../src/db/client.js';
import { rpcSource } from '../../src/ingest/rpc.js';
import { runOnce } from '../../src/ingest/poller.js';
import { getIntent } from '../../src/queries/intents.js';

const RUN = process.env.LAPLACE_DEVNET === '1';

describe.runIf(RUN)('indexer (devnet, live)', () => {
  it('indexes a real createIntent into the projection', async () => {
    const cluster = 'devnet' as const;
    const { rpcUrl, programs } = getCluster(cluster);
    const rpc = createSolanaRpc(rpcUrl);
    const rpcSubscriptions = createSolanaRpcSubscriptions('wss://api.devnet.solana.com');
    const maker = await generateKeyPairSigner();
    await airdropFactory({ rpc, rpcSubscriptions })({ commitment: 'confirmed', recipientAddress: maker.address, lamports: lamports(2_000_000_000n) });

    const laplace = new Laplace({ rpc, rpcSubscriptions, cluster });
    const slot = BigInt(await rpc.getSlot().send());
    const created = await laplace.createIntent({
      maker, receiver: maker.address, asset: { sol: true }, amount: 1_000_000n,
      expirySlot: slot + 10_000n, criterion: Condition.hashlock({}),
    });

    const { db, migrate, close } = await makeDb('memory://');
    await migrate();
    const src = rpcSource(rpc, 'confirmed');
    // poll until the createIntent signature is indexed (devnet finalization lag)
    let detail = null;
    for (let i = 0; i < 30 && !detail; i++) {
      await runOnce(db, src, { laplace: programs.laplace, validity: programs.validity }, 100);
      detail = await getIntent(db, created.intentPda);
      if (!detail) await new Promise((r) => setTimeout(r, 2000));
    }
    expect(detail?.intent.pda).toBe(created.intentPda);
    expect(detail?.intent.maker).toBe(maker.address);
    expect(detail?.intent.status).toBe('active');
    await close();
  }, 120_000);
});
```
> Uses `'confirmed'` here (not `finalized`) so the test sees the tx without waiting for full finalization. Reads `createIntent`'s return shape from `@laplace/sdk` (`{ signature, intentPda, id, secret }`, see `app/packages/sdk/src/client.ts`).

- [ ] **Step 2: Verify it compiles + skips without the env**

Run: `npm --prefix /Users/hash_548/Documents/GitHub/Laplace/app run -s test -w @laplace/indexer -- integration/devnet`
Expected: exit 0, 1 skipped.

- [ ] **Step 3 (optional, live): run against devnet**

Run: `LAPLACE_DEVNET=1 npm --prefix /Users/hash_548/Documents/GitHub/Laplace/app run -s test -w @laplace/indexer -- integration/devnet`
Expected: PASS — the real `createIntent` is indexed; requires a fundable devnet (airdrop may be rate-limited).

- [ ] **Step 4: Full suite + typecheck**

Run: `npm --prefix /Users/hash_548/Documents/GitHub/Laplace/app run -s test -w @laplace/indexer && npm --prefix /Users/hash_548/Documents/GitHub/Laplace/app run -s typecheck -w @laplace/indexer`
Expected: all pass; typecheck exit 0.

- [ ] **Step 5: Commit**
```bash
git add app/packages/indexer/test/integration/devnet.test.ts
git commit -m "test(indexer): gated live devnet integration test"
```

---

## Self-Review

**Spec coverage:**
- §3 architecture / data flow → Tasks 3–7. ✓
- §4 package layout (config, db, ingest, project, queries, api, bin) → Tasks 1–8 (one file per responsibility). ✓
- §5 data model (events/intents/validity_configs/sync_state, amount as TEXT, slots bigint) → Task 2 schema. ✓
- §6 cursor-based ingest (backfill + tail, dedupe, finalized, idempotent) → Task 5 (`runOnce`) + Task 8 (loop). ✓
- §7 query module + Hono read API → Tasks 6, 7. ✓
- §8 error handling (skip failed, idempotent writes, reproject) → Tasks 3 (`err`), 4 (`reproject`/onConflict), 5 (`onConflictDoNothing`). ✓
- §9 testing (fold unit, decode unit, mock-RPC integration, gated devnet) → Tasks 3, 4, 5, 9. ✓
- §10 dependencies → Task 1 + Task 8 (`@hono/node-server`). ✓

**Placeholder scan:** Every code step has full code; the only deferred items are explicitly-optional live runs (Task 9 Step 3) and version-mismatch import fixes (general note in the header), with concrete fallbacks. No "TBD"/"add error handling"/empty tests.

**Type consistency:** `EventRow`/`IntentRow` from `schema.ts` used consistently; `Db` type from `client.ts` threads through fold/poller/queries/api; `RawTx`/`ChainSource`/`SigInfo`/`ProgramIds` names match across `decode.ts`/`rpc.ts`/`poller.ts`; event payload field names (`intent`, `amount`, `finalStatus`, `config`, `configHash`, …) match the SDK `LaplaceEvent` camelCase keys folded in Task 4.

**Backfill note:** `runOnce` implements the steady-state tail. A full historical backfill (paging `before` to `START_SLOT`) is small for devnet (programs deployed 2026-06-02) and the tail with no cursor fetches the most recent `limit` signatures on first run; if deep history is later needed, add a `backfill()` that pages `before` until `START_SLOT` and sets `sync_state.backfilled` — out of scope for v1 given the tiny history.
