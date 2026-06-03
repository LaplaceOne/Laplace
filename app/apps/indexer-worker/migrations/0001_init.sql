-- Laplace indexer — D1 (SQLite) schema. Mirrors @laplace/indexer's Postgres schema.
CREATE TABLE IF NOT EXISTS events (
  signature   TEXT NOT NULL,
  event_index INTEGER NOT NULL,
  slot        INTEGER NOT NULL,
  block_time  INTEGER,
  program     TEXT NOT NULL,
  kind        TEXT NOT NULL,
  intent_pda  TEXT,
  config_pda  TEXT,
  payload     TEXT NOT NULL,
  PRIMARY KEY (signature, event_index)
);
CREATE INDEX IF NOT EXISTS events_slot_idx ON events (slot);
CREATE INDEX IF NOT EXISTS events_intent_idx ON events (intent_pda);

CREATE TABLE IF NOT EXISTS intents (
  pda               TEXT PRIMARY KEY,
  id                TEXT NOT NULL,
  maker             TEXT NOT NULL,
  receiver          TEXT NOT NULL,
  refund_recipient  TEXT NOT NULL,
  criterion_program TEXT NOT NULL,
  asset             TEXT NOT NULL,
  amount            TEXT NOT NULL,
  expiry_slot       INTEGER NOT NULL,
  created_slot      INTEGER NOT NULL,
  status            TEXT NOT NULL,
  closed            INTEGER NOT NULL DEFAULT 0,
  created_sig       TEXT NOT NULL,
  settled_sig       TEXT,
  settled_slot      INTEGER,
  closed_sig        TEXT,
  closed_slot       INTEGER,
  updated_slot      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS intents_maker_idx ON intents (maker);
CREATE INDEX IF NOT EXISTS intents_receiver_idx ON intents (receiver);
CREATE INDEX IF NOT EXISTS intents_status_idx ON intents (status);

CREATE TABLE IF NOT EXISTS validity_configs (
  config                  TEXT PRIMARY KEY,
  config_hash             TEXT NOT NULL,
  guest_elf_hash          TEXT NOT NULL,
  sp1_vkey_hash           TEXT NOT NULL,
  fixed_public_inputs_len INTEGER NOT NULL,
  payer                   TEXT NOT NULL,
  created_sig             TEXT NOT NULL,
  created_slot            INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_state (
  program        TEXT PRIMARY KEY,
  last_signature TEXT,
  last_slot      INTEGER,
  backfilled     INTEGER NOT NULL DEFAULT 0
);
