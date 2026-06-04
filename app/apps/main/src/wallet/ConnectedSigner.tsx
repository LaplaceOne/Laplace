import { useWalletAccountTransactionSendingSigner } from '@solana/react';
import type { UiWalletAccount } from '@wallet-standard/react';
import { LaplaceProvider } from '@laplace-one/wallet';
import type { TransactionSigner } from '@solana/kit';
import { env } from '../env';
import { CHAIN } from './cluster';

/** Renders LaplaceProvider with a signer derived from the selected account, or none. */
export function SignerGate({ account, children }: { account: UiWalletAccount | undefined; children: React.ReactNode }) {
  if (!account) {
    return <LaplaceProvider cluster={env.cluster} rpcUrl={env.rpcUrl} signer={undefined}>{children}</LaplaceProvider>;
  }
  return <Connected account={account}>{children}</Connected>;
}

function Connected({ account, children }: { account: UiWalletAccount; children: React.ReactNode }) {
  // A SENDING signer: the wallet signs AND submits on this exact chain, so it operates on the
  // dApp's cluster (devnet) rather than whatever network the wallet UI happens to be set to.
  const signer = useWalletAccountTransactionSendingSigner(account, CHAIN[env.cluster]);
  return (
    <LaplaceProvider cluster={env.cluster} rpcUrl={env.rpcUrl} signer={signer as unknown as TransactionSigner}>
      {children}
    </LaplaceProvider>
  );
}
