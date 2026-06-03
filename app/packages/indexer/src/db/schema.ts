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
