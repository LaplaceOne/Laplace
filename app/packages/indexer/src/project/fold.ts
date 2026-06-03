import { eq } from 'drizzle-orm';
import type { EventRow } from '../db/schema.js';
import { pgTables, type SchemaTables, type AnyDb } from '../db/tables.js';

type Payload = Record<string, unknown>;
const str = (p: Payload, k: string): string => String(p[k]);
const num = (p: Payload, k: string): number => Number(p[k]);

/** Apply event rows to the projections, ordered by (slot, signature, eventIndex). Idempotent.
 *  `t` selects the dialect's tables (defaults to Postgres). */
export async function applyEvents(db: AnyDb, rows: EventRow[], t: SchemaTables = pgTables): Promise<void> {
  const ordered = [...rows].sort(
    (a, b) => a.slot - b.slot || a.signature.localeCompare(b.signature) || a.eventIndex - b.eventIndex,
  );
  for (const r of ordered) {
    const p = r.payload as Payload;
    switch (r.kind) {
      case 'IntentCreated': {
        await db
          .insert(t.intents)
          .values({
            pda: str(p, 'intent'), id: str(p, 'id'), maker: str(p, 'maker'), receiver: str(p, 'receiver'),
            refundRecipient: str(p, 'refundRecipient'), criterionProgram: str(p, 'criterionProgram'),
            asset: p.asset, amount: str(p, 'amount'), expirySlot: num(p, 'expirySlot'), createdSlot: num(p, 'createdSlot'),
            status: 'active', closed: false, createdSig: r.signature, updatedSlot: r.slot,
          })
          .onConflictDoUpdate({
            target: t.intents.pda,
            set: { maker: str(p, 'maker'), receiver: str(p, 'receiver'), amount: str(p, 'amount'), updatedSlot: r.slot },
          });
        break;
      }
      case 'IntentFulfilled':
        await db.update(t.intents).set({ status: 'fulfilled', settledSig: r.signature, settledSlot: r.slot, updatedSlot: r.slot }).where(eq(t.intents.pda, str(p, 'intent')));
        break;
      case 'IntentRefunded':
        await db.update(t.intents).set({ status: 'refunded', settledSig: r.signature, settledSlot: r.slot, updatedSlot: r.slot }).where(eq(t.intents.pda, str(p, 'intent')));
        break;
      case 'IntentClosed':
        await db.update(t.intents).set({ closed: true, closedSig: r.signature, closedSlot: r.slot, updatedSlot: r.slot }).where(eq(t.intents.pda, str(p, 'intent')));
        break;
      case 'ValidityConfigCreated':
        await db
          .insert(t.validityConfigs)
          .values({
            config: str(p, 'config'), configHash: str(p, 'configHash'), guestElfHash: str(p, 'guestElfHash'),
            sp1VkeyHash: str(p, 'sp1VkeyHash'), fixedPublicInputsLen: num(p, 'fixedPublicInputsLen'),
            payer: str(p, 'payer'), createdSig: r.signature, createdSlot: r.slot,
          })
          .onConflictDoNothing();
        break;
    }
  }
}

/** Rebuild all projections from the immutable events table. */
export async function reproject(db: AnyDb, t: SchemaTables = pgTables): Promise<void> {
  await db.delete(t.intents);
  await db.delete(t.validityConfigs);
  const all = await db.select().from(t.events);
  await applyEvents(db, all as EventRow[], t);
}
