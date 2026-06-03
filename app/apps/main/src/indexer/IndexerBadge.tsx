import { useIndexerStatus } from './useIndexerStatus';
import styles from './IndexerBadge.module.css';

/** Small console-appbar indicator of the discovery source: indexer (ok) vs. direct-chain fallback. */
export function IndexerBadge() {
  const status = useIndexerStatus();
  if (status === 'none') return null;
  const ok = status === 'ok';
  return (
    <span
      className={styles.badge}
      title={ok ? 'Indexer healthy' : 'Indexer unreachable — using direct chain reads (getProgramAccounts)'}
    >
      <span className={`${styles.dot} ${ok ? styles.ok : styles.down}`} />
      indexer{ok ? '' : ' · fallback'}
    </span>
  );
}
