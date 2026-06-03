import * as React from 'react';
import { useWallets } from '@wallet-standard/react';
import type { UiWallet, UiWalletAccount } from '@wallet-standard/react';

const STORAGE = 'laplace-wallet';

interface WalletCtx {
  wallets: readonly UiWallet[];
  selectedAccount: UiWalletAccount | undefined;
  selectedWallet: UiWallet | undefined;
  select: (account: UiWalletAccount) => void;
  disconnect: () => void;
}
const Ctx = React.createContext<WalletCtx | null>(null);

function isSolana(w: UiWallet): boolean {
  return w.chains.some((c) => c.startsWith('solana:')) && w.features.includes('solana:signAndSendTransaction');
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const all = useWallets();
  const wallets = React.useMemo(() => all.filter(isSolana), [all]);
  const [account, setAccount] = React.useState<UiWalletAccount | undefined>(undefined);

  const select = React.useCallback((a: UiWalletAccount) => {
    setAccount(a);
    try { localStorage.setItem(STORAGE, a.address); } catch {}
  }, []);
  const disconnect = React.useCallback(() => {
    setAccount(undefined);
    try { localStorage.removeItem(STORAGE); } catch {}
  }, []);

  // Re-select a persisted account once its wallet (re)registers.
  React.useEffect(() => {
    if (account) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem(STORAGE); } catch {}
    if (!saved) return;
    for (const w of wallets) {
      const a = w.accounts.find((acc) => acc.address === saved);
      if (a) { setAccount(a); break; }
    }
  }, [wallets, account]);

  const selectedWallet = React.useMemo(
    () => wallets.find((w) => w.accounts.some((a) => a.address === account?.address)),
    [wallets, account],
  );

  const value: WalletCtx = { wallets, selectedAccount: account, selectedWallet, select, disconnect };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletCtx {
  const c = React.useContext(Ctx);
  if (!c) throw new Error('useWallet must be used within <WalletProvider>');
  return c;
}
