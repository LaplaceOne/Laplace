import type { Address } from '@solana/kit';
import { TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';

export type EscrowAssetInput = { sol: true } | { spl: { mint: Address; tokenProgram: Address } };
export function nativeSol(): EscrowAssetInput { return { sol: true }; }
export function splToken(args: { mint: Address; tokenProgram?: Address }): EscrowAssetInput {
  return { spl: { mint: args.mint, tokenProgram: args.tokenProgram ?? TOKEN_PROGRAM_ADDRESS } };
}
export function toBaseUnits(human: string | number, decimals: number): bigint {
  const s = typeof human === 'number' ? human.toString() : human;
  const [whole, frac = ''] = s.split('.');
  if (frac.length > decimals) throw new Error(`too many fractional digits for ${decimals} decimals`);
  return BigInt((whole || '0') + frac.padEnd(decimals, '0'));
}
export function toDisplay(base: bigint, decimals: number): string {
  const neg = base < 0n; const v = neg ? -base : base;
  const s = v.toString().padStart(decimals + 1, '0');
  const whole = s.slice(0, s.length - decimals); const frac = s.slice(s.length - decimals).replace(/0+$/, '');
  return (neg ? '-' : '') + (frac ? `${whole}.${frac}` : whole);
}
