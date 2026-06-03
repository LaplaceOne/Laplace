import type { Cluster } from '@laplace/registry';
import type { UiWalletAccount } from '@wallet-standard/react';

/** Wallet Standard Solana chain ids. Note: our 'mainnet-beta' cluster maps to 'solana:mainnet'. */
export const CHAIN = {
  localnet: 'solana:localnet',
  devnet: 'solana:devnet',
  'mainnet-beta': 'solana:mainnet',
} as const satisfies Record<Cluster, `solana:${string}`>;

/** Whether a connected account advertises support for the dApp's cluster. */
export function accountSupportsCluster(account: UiWalletAccount, cluster: Cluster): boolean {
  return (account.chains as readonly string[]).includes(CHAIN[cluster]);
}
