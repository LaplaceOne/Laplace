CREATE TABLE IF NOT EXISTS "events" (
	"signature" text NOT NULL,
	"event_index" integer NOT NULL,
	"slot" bigint NOT NULL,
	"block_time" bigint,
	"program" text NOT NULL,
	"kind" text NOT NULL,
	"intent_pda" text,
	"config_pda" text,
	"payload" jsonb NOT NULL,
	CONSTRAINT "events_signature_event_index_pk" PRIMARY KEY("signature","event_index")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "intents" (
	"pda" text PRIMARY KEY NOT NULL,
	"id" text NOT NULL,
	"maker" text NOT NULL,
	"receiver" text NOT NULL,
	"refund_recipient" text NOT NULL,
	"criterion_program" text NOT NULL,
	"asset" jsonb NOT NULL,
	"amount" text NOT NULL,
	"expiry_slot" bigint NOT NULL,
	"created_slot" bigint NOT NULL,
	"status" text NOT NULL,
	"closed" boolean DEFAULT false NOT NULL,
	"created_sig" text NOT NULL,
	"settled_sig" text,
	"settled_slot" bigint,
	"closed_sig" text,
	"closed_slot" bigint,
	"updated_slot" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_state" (
	"program" text PRIMARY KEY NOT NULL,
	"last_signature" text,
	"last_slot" bigint,
	"backfilled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "validity_configs" (
	"config" text PRIMARY KEY NOT NULL,
	"config_hash" text NOT NULL,
	"guest_elf_hash" text NOT NULL,
	"sp1_vkey_hash" text NOT NULL,
	"fixed_public_inputs_len" integer NOT NULL,
	"payer" text NOT NULL,
	"created_sig" text NOT NULL,
	"created_slot" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_slot_idx" ON "events" USING btree ("slot");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_intent_idx" ON "events" USING btree ("intent_pda");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intents_maker_idx" ON "intents" USING btree ("maker");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intents_receiver_idx" ON "intents" USING btree ("receiver");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intents_status_idx" ON "intents" USING btree ("status");