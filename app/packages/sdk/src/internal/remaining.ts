import { type Address, type Instruction, type AccountMeta, AccountRole } from '@solana/kit';

export type Meta = { address: Address; role: AccountRole };
export function withRemaining(ix: Instruction, remaining: Meta[]): Instruction {
  if (remaining.length === 0) return ix;
  const extra = remaining.map((m) => ({ address: m.address, role: m.role }) as AccountMeta);
  return { ...ix, accounts: [...(ix.accounts ?? []), ...extra] };
}
export const W = AccountRole.WRITABLE;
export const R = AccountRole.READONLY;
