// Hand-written Anchor event decoder. Codama renderers-js@2.2.0 does NOT render events, so this is
// intentionally manual and is the source of truth — `npm run codegen` will not regenerate it.
// Mirrors the on-chain #[event] structs in programs/laplace/src/events.rs and
// programs/validity/src/events.rs (Borsh field order must match exactly).
import {
  type Address, type ReadonlyUint8Array, type Decoder,
  getStructDecoder, getAddressDecoder, getBytesDecoder, fixDecoderSize,
  getU16Decoder, getU32Decoder, getU64Decoder, getBase64Encoder,
} from '@solana/kit';
import { sha256 } from '@noble/hashes/sha256';
import {
  getEscrowAssetDecoder, getIntentStatusDecoder, type EscrowAsset, type IntentStatus,
} from './generated/laplace/index.js';

const utf8 = (s: string) => new TextEncoder().encode(s);
function disc(name: string): Uint8Array { return sha256(utf8(`event:${name}`)).slice(0, 8); }
const bytes32 = () => fixDecoderSize(getBytesDecoder(), 32);

export const EVENT_DISCRIMINATORS = {
  IntentCreated: disc('IntentCreated'),
  IntentFulfilled: disc('IntentFulfilled'),
  IntentRefunded: disc('IntentRefunded'),
  IntentClosed: disc('IntentClosed'),
  ValidityConfigCreated: disc('ValidityConfigCreated'),
} as const;

export interface IntentCreatedEvent {
  intent: Address; id: ReadonlyUint8Array; maker: Address; receiver: Address;
  refundRecipient: Address; criterionProgram: Address; criterionDataHash: ReadonlyUint8Array;
  criterionInterfaceVersion: number; asset: EscrowAsset; amount: bigint; expirySlot: bigint; createdSlot: bigint;
}
export interface IntentFulfilledEvent {
  intent: Address; id: ReadonlyUint8Array; maker: Address; receiver: Address;
  criterionProgram: Address; asset: EscrowAsset; amount: bigint; slot: bigint;
}
export interface IntentRefundedEvent {
  intent: Address; id: ReadonlyUint8Array; maker: Address; refundRecipient: Address;
  asset: EscrowAsset; amount: bigint; slot: bigint;
}
export interface IntentClosedEvent {
  intent: Address; id: ReadonlyUint8Array; maker: Address; finalStatus: IntentStatus; slot: bigint;
}
export interface ValidityConfigCreatedEvent {
  config: Address; configHash: ReadonlyUint8Array; guestElfHash: ReadonlyUint8Array;
  sp1VkeyHash: ReadonlyUint8Array; fixedPublicInputsLen: number; payer: Address;
}

export type LaplaceEvent =
  | ({ kind: 'IntentCreated' } & IntentCreatedEvent)
  | ({ kind: 'IntentFulfilled' } & IntentFulfilledEvent)
  | ({ kind: 'IntentRefunded' } & IntentRefundedEvent)
  | ({ kind: 'IntentClosed' } & IntentClosedEvent)
  | ({ kind: 'ValidityConfigCreated' } & ValidityConfigCreatedEvent);

const intentCreatedDecoder: Decoder<IntentCreatedEvent> = getStructDecoder([
  ['intent', getAddressDecoder()], ['id', bytes32()], ['maker', getAddressDecoder()],
  ['receiver', getAddressDecoder()], ['refundRecipient', getAddressDecoder()],
  ['criterionProgram', getAddressDecoder()], ['criterionDataHash', bytes32()],
  ['criterionInterfaceVersion', getU16Decoder()], ['asset', getEscrowAssetDecoder()],
  ['amount', getU64Decoder()], ['expirySlot', getU64Decoder()], ['createdSlot', getU64Decoder()],
]);
const intentFulfilledDecoder: Decoder<IntentFulfilledEvent> = getStructDecoder([
  ['intent', getAddressDecoder()], ['id', bytes32()], ['maker', getAddressDecoder()],
  ['receiver', getAddressDecoder()], ['criterionProgram', getAddressDecoder()],
  ['asset', getEscrowAssetDecoder()], ['amount', getU64Decoder()], ['slot', getU64Decoder()],
]);
const intentRefundedDecoder: Decoder<IntentRefundedEvent> = getStructDecoder([
  ['intent', getAddressDecoder()], ['id', bytes32()], ['maker', getAddressDecoder()],
  ['refundRecipient', getAddressDecoder()], ['asset', getEscrowAssetDecoder()],
  ['amount', getU64Decoder()], ['slot', getU64Decoder()],
]);
const intentClosedDecoder: Decoder<IntentClosedEvent> = getStructDecoder([
  ['intent', getAddressDecoder()], ['id', bytes32()], ['maker', getAddressDecoder()],
  ['finalStatus', getIntentStatusDecoder()], ['slot', getU64Decoder()],
]);
const validityConfigCreatedDecoder: Decoder<ValidityConfigCreatedEvent> = getStructDecoder([
  ['config', getAddressDecoder()], ['configHash', bytes32()], ['guestElfHash', bytes32()],
  ['sp1VkeyHash', bytes32()], ['fixedPublicInputsLen', getU32Decoder()], ['payer', getAddressDecoder()],
]);

const TABLE: { kind: LaplaceEvent['kind']; disc: Uint8Array; decoder: Decoder<any> }[] = [
  { kind: 'IntentCreated', disc: EVENT_DISCRIMINATORS.IntentCreated, decoder: intentCreatedDecoder },
  { kind: 'IntentFulfilled', disc: EVENT_DISCRIMINATORS.IntentFulfilled, decoder: intentFulfilledDecoder },
  { kind: 'IntentRefunded', disc: EVENT_DISCRIMINATORS.IntentRefunded, decoder: intentRefundedDecoder },
  { kind: 'IntentClosed', disc: EVENT_DISCRIMINATORS.IntentClosed, decoder: intentClosedDecoder },
  { kind: 'ValidityConfigCreated', disc: EVENT_DISCRIMINATORS.ValidityConfigCreated, decoder: validityConfigCreatedDecoder },
];

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Decode all recognized Laplace lifecycle events from a transaction's log messages. */
export function parseLaplaceEvents(logs: readonly string[]): LaplaceEvent[] {
  const out: LaplaceEvent[] = [];
  for (const line of logs) {
    const m = /^Program data: (.+)$/.exec(line);
    if (!m?.[1]) continue;
    const b64 = m[1];
    let data: Uint8Array;
    // Buffer is a Node global; use kit's base64 encoder so the SDK decodes events in the browser too.
    try { data = new Uint8Array(getBase64Encoder().encode(b64)); } catch { continue; }
    if (data.length < 8) continue;
    const head = data.subarray(0, 8);
    const entry = TABLE.find((e) => bytesEqual(head, e.disc));
    if (!entry) continue;
    out.push({ kind: entry.kind, ...entry.decoder.decode(data.subarray(8)) });
  }
  return out;
}

/** Fetch a confirmed transaction by signature and decode its Laplace events. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAndParseEvents(rpc: any, signature: string): Promise<LaplaceEvent[]> {
  const tx = await rpc
    .getTransaction(signature, { maxSupportedTransactionVersion: 0, encoding: 'json', commitment: 'confirmed' })
    .send();
  const logs: string[] = tx?.meta?.logMessages ?? [];
  return parseLaplaceEvents(logs);
}
