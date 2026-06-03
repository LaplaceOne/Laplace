import { ThemeProvider, ToastProvider } from '@laplace/ui';
import { WalletProvider, useWallet } from '../wallet/WalletProvider';
import { SignerGate } from '../wallet/ConnectedSigner';
import { IndexerProvider } from '../indexer/IndexerProvider';

function WithSigner({ children }: { children: React.ReactNode }) {
  const { selectedAccount } = useWallet();
  return <SignerGate account={selectedAccount}>{children}</SignerGate>;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <WalletProvider>
        <WithSigner>
          <IndexerProvider>
            <ToastProvider>{children}</ToastProvider>
          </IndexerProvider>
        </WithSigner>
      </WalletProvider>
    </ThemeProvider>
  );
}
