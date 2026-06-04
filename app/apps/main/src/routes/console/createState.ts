import { Condition, minutesToSlots, nativeSol, splToken, type CriterionSpec } from '@laplace-one/sdk';
import { address } from '@solana/kit';

export type Recipe = 'hashlock' | 'validity' | 'custom';
export interface CreateState {
  asset: 'sol' | 'spl';
  mint: string; decimals: number;
  amount: string; receiver: string; refund: string; expiryMinutes: number;
  recipe: Recipe;
  hashMode: 'generate' | 'paste'; secret?: Uint8Array; pastedHash: string;
  configHash: string;
  customPid: string; customHash: string; customAck: string;
}

export const initialCreate: CreateState = {
  asset: 'sol', mint: '', decimals: 9, amount: '', receiver: '', refund: '', expiryMinutes: 60,
  recipe: 'hashlock', hashMode: 'generate', pastedHash: '', configHash: '',
  customPid: '', customHash: '', customAck: '',
};

export function isAddress(s: string): boolean { try { address(s); return true; } catch { return false; } }

export function validateStep1(s: CreateState): { ok: boolean; reason?: string } {
  if (!s.amount || Number(s.amount) <= 0) return { ok: false, reason: 'Enter a positive amount' };
  if (!isAddress(s.receiver)) return { ok: false, reason: 'Enter a valid receiver address' };
  if (s.refund && !isAddress(s.refund)) return { ok: false, reason: 'Refund recipient is not a valid address' };
  if (s.asset === 'spl' && !isAddress(s.mint)) return { ok: false, reason: 'Enter a valid mint address' };
  return { ok: true };
}

export function validateStep2(s: CreateState): { ok: boolean; reason?: string } {
  if (s.recipe === 'hashlock') {
    if (s.hashMode === 'generate') return s.secret ? { ok: true } : { ok: false, reason: 'Generate and save your secret first' };
    return /^[0-9a-fA-F]{64}$/.test(s.pastedHash) ? { ok: true } : { ok: false, reason: 'Paste a 32-byte hex hash' };
  }
  if (s.recipe === 'validity') return /^[0-9a-fA-F]{64}$/.test(s.configHash) ? { ok: true } : { ok: false, reason: 'Select or enter a config hash' };
  // custom: require pid and a matching typed acknowledgment
  if (!isAddress(s.customPid)) return { ok: false, reason: 'Enter the criterion program ID' };
  if (s.customPid !== s.customAck) return { ok: false, reason: 'Re-type the program ID to acknowledge' };
  if (!/^[0-9a-fA-F]{64}$/.test(s.customHash)) return { ok: false, reason: 'Enter the criterion data hash (hex)' };
  return { ok: true };
}

export function computeExpirySlot(currentSlot: bigint, minutes: number): bigint {
  return currentSlot + minutesToSlots(minutes);
}

export function hexToBytes(hex: string): Uint8Array {
  const m = hex.match(/.{1,2}/g) ?? [];
  return Uint8Array.from(m.map((b) => parseInt(b, 16)));
}
export function toBytes32Hex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function buildCriterion(s: CreateState): CriterionSpec {
  if (s.recipe === 'hashlock') {
    return s.hashMode === 'generate'
      ? Condition.hashlock({ secret: s.secret! })
      : Condition.hashlock({ hash: hexToBytes(s.pastedHash) });
  }
  if (s.recipe === 'validity') return Condition.validity({ configHash: hexToBytes(s.configHash) });
  return Condition.custom({ programId: address(s.customPid), criterionDataHash: hexToBytes(s.customHash) });
}

export function buildAsset(s: CreateState) {
  return s.asset === 'sol' ? nativeSol() : splToken({ mint: address(s.mint) });
}
