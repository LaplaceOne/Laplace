// Single source of truth for the official program IDs (verified against the on-chain
// declare_id! / Anchor.toml). Both clusters.ts and criteria.ts import from here so the
// two never drift — these are security-critical addresses.
export const PROGRAM_IDS = {
  laplace: '5ozBamUtiAHCkiipAVL9E8v8r54HqZsHMDbkHdczpidu',
  hashlock: 'DNotXVWh1ifzp9MHSd5H4F78SRHptF9p8vGfMmjtuWX2',
  validity: 'EQfH4VFdxcFYh8prdAsB4XwKCZiiR5uta594bfiwhLsB',
} as const;
