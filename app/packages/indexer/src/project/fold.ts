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
