// Plain-language messages keyed by each program's Anchor ErrorCode. Anchor numbers every
// program's errors independently from 6000, so the SAME numeric code means different things in
// different programs (e.g. 6001 = laplace InvalidExpiry, hashlock InvalidPreimage, validity
// InvalidFulfillmentData). Callers pass `program` when they know which program failed (a hashlock
// fulfillment → 'hashlock'); the default 'laplace' covers the core lifecycle instructions.
export type LaplaceProgram = 'laplace' | 'hashlock' | 'validity';

const LAPLACE_MESSAGES: Record<number, string> = {
  6000: 'Intent amount must be greater than zero.',
  6001: 'Intent expiry must be in the future.',
  6002: 'This intent is not active.',
  6003: 'This intent has expired.',
  6004: 'This intent has not expired yet.',
  6005: 'Receiver does not match the intent.',
  6006: 'Refund recipient does not match the intent.',
  6007: 'Criterion program does not match the intent.',
  6008: 'Criterion program must be executable.',
  6009: 'Fulfillment data exceeds the protocol limit.',
  6010: 'Criterion CPI cannot receive protected escrow accounts.',
  6011: 'Failed to serialize the criterion request.',
  6012: 'Escrow does not contain the locked amount.',
  6013: 'Intent must be fulfilled or refunded before close.',
  6014: 'Asset-specific account list is invalid.',
  6015: 'Token mint does not match the intent asset.',
  6016: 'Token program does not match the intent asset.',
  6017: 'Token account does not match the intent asset.',
  6018: 'Token vault balance is invalid for this operation.',
  6019: 'Criterion account split is invalid.',
};

const HASHLOCK_MESSAGES: Record<number, string> = {
  6000: 'The hashlock fulfillment payload is malformed.',
  6001: 'The revealed secret does not match this hashlock.',
  6002: 'This program is not the hashlock criterion adapter.',
};

const VALIDITY_MESSAGES: Record<number, string> = {
  6000: 'The validity config hash does not match the configured fields.',
  6001: 'The validity fulfillment payload is malformed.',
  6002: 'The validity proof failed verification.',
  6003: 'This program is not the validity criterion adapter.',
  6004: 'The fixed public inputs exceed the configured maximum.',
};

const TABLES: Record<LaplaceProgram, Record<number, string>> = {
  laplace: LAPLACE_MESSAGES,
  hashlock: HASHLOCK_MESSAGES,
  validity: VALIDITY_MESSAGES,
};

function extractCode(err: unknown): number | undefined {
  const e = err as any;
  return e?.context?.code ?? e?.cause?.context?.code ?? (typeof e?.code === 'number' ? e.code : undefined);
}

export function mapLaplaceError(
  err: unknown,
  opts?: { program?: LaplaceProgram },
): { code?: number; program?: LaplaceProgram; message: string } {
  const code = extractCode(err);
  const program = opts?.program ?? 'laplace';
  if (code != null) {
    const msg = TABLES[program][code];
    if (msg) return { code, program, message: msg };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { code, message };
}
