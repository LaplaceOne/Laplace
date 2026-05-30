import type { Address } from '@solana/kit';
import type { Intent } from './generated/laplace/index.js';
export interface ResolvedIntent { address: Address; data: Intent; }
