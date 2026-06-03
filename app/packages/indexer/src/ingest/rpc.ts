import type { RawTx } from './decode.js';

export interface SigInfo { signature: string; slot: number; err: unknown | null }

export interface ChainSource {
  getSignatures(program: string, opts: { until?: string; before?: string; limit: number }): Promise<SigInfo[]>;
  getTx(signature: string): Promise<RawTx | null>;
}

/** A ChainSource backed by a @solana/kit rpc. */
export function rpcSource(rpc: any, commitment: 'processed' | 'confirmed' | 'finalized'): ChainSource {
  return {
    async getSignatures(program, opts) {
      const res = await rpc.getSignaturesForAddress(program, { limit: opts.limit, until: opts.until, before: opts.before, commitment }).send();
      return (res as any[]).map((s) => ({ signature: s.signature, slot: Number(s.slot), err: s.err ?? null }));
    },
    async getTx(signature) {
      const tx = await rpc.getTransaction(signature, { maxSupportedTransactionVersion: 0, encoding: 'json', commitment }).send();
      if (!tx) return null;
      return {
        signature,
        slot: Number(tx.slot),
        blockTime: tx.blockTime == null ? null : Number(tx.blockTime),
        err: tx.meta?.err ?? null,
        logMessages: tx.meta?.logMessages ?? [],
      };
    },
  };
}
