export type Cluster = 'localnet' | 'devnet' | 'mainnet-beta';
export type TrustTier = 'official' | 'audited' | 'community' | 'unverified' | 'flagged';
export interface ClusterConfig { cluster: Cluster; rpcUrl: string;
  programs: { laplace: string; hashlock: string; validity: string };
  stablecoins: { symbol: string; mint: string; decimals: number }[]; }
export interface CriterionEntry { key: string; name: string; kind: string; desc: string; tier: TrustTier;
  programId: Partial<Record<Cluster, string>>; stateful: boolean; criterionAccountCount: number;
  fulfillmentKind: 'preimage' | 'sp1-proof' | 'custom'; commitment: string; verify: string;
  conformance: { binds: 'full' | 'partial' | 'unknown'; accounts: number; interfaceVersion: number; note: string };
  audit?: { by: string; date: string; findings: string; url: string };
  build?: { repo: string; commit: string; match: boolean };
  usage?: { settled: number; value?: string; since: string }; incidents?: string; warnings?: string[]; docsUrl: string; }
export interface ValidityGuestEntry { key: string; name: string; tier: TrustTier; proves: string; statement: string;
  publicInputsSchema: string[]; guestElfHash: string; sp1VkeyHash: string;
  build: { repo: string; commit: string; elfMatch: boolean; vkeyMatch: boolean };
  audit?: CriterionEntry['audit']; configs?: number; usage?: { settled: number; since: string }; }
export interface ValidityConfigEntry { label: string; cluster: Cluster; configHash: string;
  guestKey?: string; guestElfHash: string; sp1VkeyHash: string; fixedPublicInputs: string; authorNote?: string; }
