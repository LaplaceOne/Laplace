import { parseLaplaceEvents, type LaplaceEvent } from '@laplace-one/sdk';
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

// JSON-safe payload: bigints (amount, slots) → strings; raw byte fields (e.g. the 32-byte intent
// `id`) → hex, instead of the default `{"0":..}` object form that stringifies to "[object Object]".
function toPayload(e: LaplaceEvent): unknown {
  return JSON.parse(
    JSON.stringify(e, (_k, v) => {
      if (typeof v === 'bigint') return v.toString();
      if (v instanceof Uint8Array) return Array.from(v, (b) => b.toString(16).padStart(2, '0')).join('');
      return v;
    }),
  );
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
