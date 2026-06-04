import { Icon } from '@laplace-one/ui';
import { useWallet } from './WalletProvider';
import { accountSupportsCluster } from './cluster';
import { env } from '../env';
import styles from './ClusterWarning.module.css';

/**
 * Warns when the connected wallet account doesn't advertise the dApp's cluster (e.g. a
 * mainnet-only wallet like MetaMask on a devnet dApp). Such wallets simulate/submit on their
 * own network — where the Laplace programs aren't deployed — so transactions revert with an
 * opaque error. Non-blocking: some wallets under-report chains, so this informs rather than gates.
 */
export function ClusterWarning() {
  const { selectedAccount } = useWallet();
  if (!selectedAccount || accountSupportsCluster(selectedAccount, env.cluster)) return null;
  return (
    <div className={styles.banner} role="alert">
      <Icon icon="eva:alert-triangle-outline" />
      <span>
        This wallet doesn&apos;t advertise <strong>{env.cluster}</strong> support, so it may simulate or
        submit on its own network (where the Laplace programs aren&apos;t deployed) and transactions can
        revert. For {env.cluster}, use <strong>Phantom</strong>, <strong>Solflare</strong>, or{' '}
        <strong>Backpack</strong>.
      </span>
    </div>
  );
}
