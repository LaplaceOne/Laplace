import * as React from 'react';
import { useWalletAccountTransactionSigner } from '@solana/react';
import type { UiWalletAccount } from '@wallet-standard/react';
import { LaplaceProvider } from '@laplace/wallet';
import type { TransactionSigner } from '@solana/kit';
import { env } from '../env';

/** Renders LaplaceProvider with a signer derived from the selected account, or none. */
export function SignerGate({ account, children }: { account: UiWalletAccount | undefined; children: React.ReactNode }) {
  if (!account) {
    return <LaplaceProvider cluster={env.cluster} rpcUrl={env.rpcUrl} signer={undefined}>{children}</LaplaceProvider>;
  }
  return <Connected account={account}>{children}</Connected>;
}

function Connected({ account, children }: { account: UiWalletAccount; children: React.ReactNode }) {
  const signer = useWalletAccountTransactionSigner(account, `solana:${env.cluster}`);
  return (
    <LaplaceProvider cluster={env.cluster} rpcUrl={env.rpcUrl} signer={signer as unknown as TransactionSigner}>
      {children}
    </LaplaceProvider>
  );
}
