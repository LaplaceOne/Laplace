import * as React from 'react';
import { cn } from '@laplace-one/ui';
import { useWallet } from './WalletProvider';
import { useWalletBalance } from './useWalletBalance';
import { ConnectModal } from './ConnectModal';
import styles from './WalletButton.module.css';

function shorten(a: string): string {
  return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

export function WalletButton() {
  const { selectedAccount, disconnect } = useWallet();
  const balance = useWalletBalance();
  const [open, setOpen] = React.useState(false);

  if (!selectedAccount) {
    return (
      <>
        <button type="button" className={styles.walletBtn} onClick={() => setOpen(true)}>
          Connect wallet
        </button>
        {open && <ConnectModal onClose={() => setOpen(false)} />}
      </>
    );
  }

  return (
    <button
      type="button"
      className={cn(styles.walletBtn, styles.connected)}
      onClick={() => disconnect()}
      title="Disconnect"
    >
      <span className={styles.wdot} />
      <span className={styles.waddr}>{shorten(selectedAccount.address)}</span>
      {balance !== null && <span className={styles.wbal}>{balance.toFixed(2)} SOL</span>}
    </button>
  );
}
