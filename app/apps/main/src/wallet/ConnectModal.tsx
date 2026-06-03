import * as React from 'react';
import { useConnect } from '@wallet-standard/react';
import type { UiWallet } from '@wallet-standard/react';
import { useLaplaceContext } from '@laplace/sdk/react';
import { makeAirdrop } from '@laplace/wallet';
import { useToast } from '@laplace/ui';
import { useWallet } from './WalletProvider';
import { env } from '../env';
import styles from './ConnectModal.module.css';

/** One row per wallet. `useConnect` is per-wallet, so each row calls it at the top level. */
function WalletRow({ wallet, onConnected }: { wallet: UiWallet; onConnected: () => void }) {
  const { select } = useWallet();
  const [isConnecting, connect] = useConnect(wallet);
  const onClick = React.useCallback(async () => {
    const accounts = await connect();
    if (accounts[0]) {
      select(accounts[0]);
      onConnected();
    }
  }, [connect, select, onConnected]);
  return (
    <button type="button" className={styles.row} disabled={isConnecting} onClick={onClick}>
      <img className={styles.wicon} src={wallet.icon} alt="" />
      {wallet.name}
      {isConnecting && ' …'}
    </button>
  );
}

function AirdropButton() {
  const { rpc, rpcSubscriptions, signer } = useLaplaceContext() as any;
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  if (!signer?.address) return null;
  const onAirdrop = async () => {
    setBusy(true);
    try {
      await makeAirdrop(rpc, rpcSubscriptions)(signer.address, 1);
      toast('Airdropped 1 SOL');
    } catch {
      toast('Airdrop failed', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={styles.airdrop}>
      <button type="button" className={styles.row} disabled={busy} onClick={onAirdrop}>
        {busy ? 'Requesting…' : 'Airdrop 1 SOL (devnet)'}
      </button>
    </div>
  );
}

export function ConnectModal({ onClose }: { onClose: () => void }) {
  const { wallets, selectedAccount } = useWallet();
  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.head}>
          <span className={styles.title}>Connect a wallet</span>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className={styles.list}>
          {wallets.length === 0 ? (
            <p className={styles.empty}>No Solana wallets detected.</p>
          ) : (
            wallets.map((w) => <WalletRow key={`${w.name}`} wallet={w} onConnected={onClose} />)
          )}
        </div>
        {selectedAccount && env.cluster === 'devnet' && <AirdropButton />}
      </div>
    </div>
  );
}
