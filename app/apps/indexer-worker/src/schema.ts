// SQLite (Cloudflare D1) schema — column names mirror the Postgres schema in @laplace/indexer
// so the projection/query logic is a 1:1 port. jsonb → text(json); boolean → integer(boolean);
// bigint(number) → integer(number).
import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';

export const events = sqliteTable(
  'events',
  {
    signature: text('signature').notNull(),
    eventIndex: integer('event_index').notNull(),
    slot: integer('slot').notNull(),
    blockTime: integer('block_time'),
    program: text('program').notNull(),
    kind: text('kind').notNull(),
    intentPda: text('intent_pda'),
    configPda: text('config_pda'),
    payload: text('payload', { mode: 'json' }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.signature, t.eventIndex] }),
    bySlot: index('events_slot_idx').on(t.slot),
    byIntent: index('events_intent_idx').on(t.intentPda),
  }),
);

export const intents = sqliteTable(
  'intents',
  {
    pda: text('pda').primaryKey(),
    id: text('id').notNull(),
    maker: text('maker').notNull(),
    receiver: text('receiver').notNull(),
    refundRecipient: text('refund_recipient').notNull(),
    criterionProgram: text('criterion_program').notNull(),
    asset: text('asset', { mode: 'json' }).notNull(),
    amount: text('amount').notNull(),
    expirySlot: integer('expiry_slot').notNull(),
    createdSlot: integer('created_slot').notNull(),
    status: text('status').notNull(),
    closed: integer('closed', { mode: 'boolean' }).notNull().default(false),
    createdSig: text('created_sig').notNull(),
    settledSig: text('settled_sig'),
    settledSlot: integer('settled_slot'),
    closedSig: text('closed_sig'),
    closedSlot: integer('closed_slot'),
    updatedSlot: integer('updated_slot').notNull(),
  },
  (t) => ({
    byMaker: index('intents_maker_idx').on(t.maker),
    byReceiver: index('intents_receiver_idx').on(t.receiver),
    byStatus: index('intents_status_idx').on(t.status),
  }),
);

export const validityConfigs = sqliteTable('validity_configs', {
  config: text('config').primaryKey(),
  configHash: text('config_hash').notNull(),
  guestElfHash: text('guest_elf_hash').notNull(),
  sp1VkeyHash: text('sp1_vkey_hash').notNull(),
  fixedPublicInputsLen: integer('fixed_public_inputs_len').notNull(),
  payer: text('payer').notNull(),
  createdSig: text('created_sig').notNull(),
  createdSlot: integer('created_slot').notNull(),
});

export const syncState = sqliteTable('sync_state', {
  program: text('program').primaryKey(),
  lastSignature: text('last_signature'),
  lastSlot: integer('last_slot'),
  backfilled: integer('backfilled', { mode: 'boolean' }).notNull().default(false),
});

export type EventRow = typeof events.$inferInsert;
export type IntentRow = typeof intents.$inferSelect;
