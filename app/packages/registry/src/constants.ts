// Single source of truth for the official program IDs (verified against the on-chain
// declare_id! / Anchor.toml). Both clusters.ts and criteria.ts import from here so the
// two never drift — these are security-critical addresses.
export const PROGRAM_IDS = {
  laplace: 'Bkb7WhLQcnz52gYrSdExPoxZUs8b2fzwjzQwrhcv8ACG',
  hashlock: '9FWQGf16ZB5wdrwg3gDCmUcpRJNVuzp1uG12C6z5RVTw',
  validity: 'CuSVyvxRCfnsvvDWWqP8xRw8fNbGRwTdam5iKsqY3Kq1',
} as const;
