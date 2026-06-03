import { address, getBase64Encoder, getAddressEncoder, getProgramDerivedAddress } from '@solana/kit';

// The indexer stores only {mint, tokenProgram, vault} for an SPL asset (no decimals), so the
// dashboard/detail must resolve decimals (mandatory) and symbol (best-effort) from chain. Both an
// already-resolved result cache and an in-flight Promise cache live at module scope so concurrent
// callers — e.g. many cards rendering the same mint — dedupe down to a single RPC round-trip.

export interface MintInfo { decimals: number; symbol?: string }

const resultCache = new Map<string, MintInfo>();
const inflight = new Map<string, Promise<MintInfo>>();

// Symbols we can name without a chain read. 4zMM… is the USDC-Dev preset in Create.tsx.
const KNOWN_SYMBOLS: Record<string, string> = {
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU': 'USDC',
};

// Metaplex Token Metadata program — PDA seeds are ['metadata', programId, mint].
const METADATA_PROGRAM = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';

/** Decode a Borsh `u32 LE length + utf8` string starting at `off`; returns [value, nextOffset]. */
function readBorshString(bytes: Uint8Array, off: number): [string, number] {
  const len = bytes[off]! | (bytes[off + 1]! << 8) | (bytes[off + 2]! << 16) | (bytes[off + 3]! << 24);
  const start = off + 4;
  const raw = new TextDecoder().decode(bytes.subarray(start, start + len));
  return [raw.replace(/[\0\s]+$/, ''), start + len];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveSymbol(rpc: any, mint: string): Promise<string | undefined> {
  const known = KNOWN_SYMBOLS[mint];
  if (known) return known;
  // Best-effort Metaplex read: never let a failure (no metadata, bad layout) bubble up.
  try {
    const addrEnc = getAddressEncoder();
    const [metadataPda] = await getProgramDerivedAddress({
      programAddress: address(METADATA_PROGRAM),
      seeds: ['metadata', addrEnc.encode(address(METADATA_PROGRAM)), addrEnc.encode(address(mint))],
    });
    const { value } = await rpc.getAccountInfo(metadataPda, { encoding: 'base64' }).send();
    if (!value) return undefined;
    const bytes = new Uint8Array(getBase64Encoder().encode((value.data as [string, string])[0]));
    // key u8(1) + updateAuthority(32) + mint(32) = 65, then name (Borsh string), then symbol.
    let off = 1 + 32 + 32;
    [, off] = readBorshString(bytes, off); // name — skip
    const [symbol] = readBorshString(bytes, off);
    return symbol || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve an SPL mint's decimals (mandatory; throws if the account is missing/too short so the
 * caller can keep its fallback) and symbol (best-effort, never throws). Deduped + cached.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveMintInfo(rpc: any, mint: string): Promise<MintInfo> {
  const cached = resultCache.get(mint);
  if (cached) return cached;
  const pending = inflight.get(mint);
  if (pending) return pending;

  const promise = (async (): Promise<MintInfo> => {
    const { value } = await rpc.getAccountInfo(mint, { encoding: 'base64' }).send();
    if (!value) throw new Error(`mint not found: ${mint}`);
    // Buffer is a Node global; kit's base64 encoder keeps this working in the browser.
    const bytes = new Uint8Array(getBase64Encoder().encode((value.data as [string, string])[0]));
    // SPL Mint layout: mintAuthority COption(36) + supply u64(8) → decimals u8 at offset 44
    // (also valid for the Token-2022 base mint). Require the account to reach that byte.
    if (bytes.length < 45) throw new Error(`mint account too short: ${mint}`);
    const decimals = bytes[44]!;
    const symbol = await resolveSymbol(rpc, mint);
    const info: MintInfo = symbol ? { decimals, symbol } : { decimals };
    resultCache.set(mint, info);
    return info;
  })().finally(() => { inflight.delete(mint); });

  inflight.set(mint, promise);
  return promise;
}
