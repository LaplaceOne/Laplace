export interface IntentRow {
  pda: string; id: string; maker: string; receiver: string; refundRecipient: string;
  criterionProgram: string;
  asset: { __kind: 'NativeSol' } | { __kind: 'SplToken'; mint: string; tokenProgram: string; vault: string };
  amount: string; expirySlot: number; createdSlot: number;
  status: 'active' | 'fulfilled' | 'refunded'; closed: boolean;
  createdSig: string; settledSig?: string; settledSlot?: number; closedSig?: string; closedSlot?: number; updatedSlot: number;
}
export interface IntentTimelineItem { kind: string; signature: string; slot: number }
export interface IntentDetail { intent: IntentRow; timeline: IntentTimelineItem[] }
export interface Stats { byStatus: { active: number; fulfilled: number; refunded: number }; closed: number; total: number }
export interface ValidityConfigRow { configHash: string; guestElfHash: string; sp1VkeyHash: string; fixedPublicInputsLen: number; createdSlot: number }

export interface IntentListParams {
  status?: 'active' | 'fulfilled' | 'refunded'; maker?: string; receiver?: string;
  criterion?: string; limit?: number; cursorSlot?: number;
}

export interface IndexerClient {
  baseUrl: string;
  health(): Promise<boolean>;
  listIntents(p: IntentListParams): Promise<IntentRow[]>;
  getIntent(pda: string): Promise<IntentDetail | null>;
  stats(): Promise<Stats>;
  validityConfigs(): Promise<ValidityConfigRow[]>;
}

function qs(p: Record<string, string | number | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined) u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : '';
}

export function createIndexerClient(baseUrl: string): IndexerClient {
  const base = baseUrl.replace(/\/$/, '');
  async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${base}${path}`);
    if (!res.ok) throw new Error(`indexer ${path} → ${res.status}`);
    return (await res.json()) as T;
  }
  return {
    baseUrl: base,
    async health() { try { const r = await get<{ ok: boolean }>('/health'); return !!r.ok; } catch { return false; } },
    async listIntents(p) {
      const r = await get<{ intents: IntentRow[] }>(`/intents${qs({ status: p.status, maker: p.maker, receiver: p.receiver, criterion: p.criterion, limit: p.limit, cursorSlot: p.cursorSlot })}`);
      return r.intents;
    },
    async getIntent(pda) { try { return await get<IntentDetail>(`/intents/${pda}`); } catch { return null; } },
    async stats() { return get<Stats>('/stats'); },
    async validityConfigs() { const r = await get<{ configs: ValidityConfigRow[] }>('/validity-configs'); return r.configs; },
  };
}
