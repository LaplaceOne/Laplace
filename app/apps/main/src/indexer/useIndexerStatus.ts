import * as React from 'react';
import { useIndexer } from './IndexerProvider';

export type IndexerStatus = 'none' | 'ok' | 'down';

/** Polls the configured indexer's /health so the UI can show whether reads come from the indexer
 *  or the SDK getProgramAccounts fallback. 'none' when no indexer URL is configured. */
export function useIndexerStatus(intervalMs = 30_000): IndexerStatus {
  const idx = useIndexer();
  const [status, setStatus] = React.useState<IndexerStatus>(idx ? 'ok' : 'none');
  React.useEffect(() => {
    if (!idx) {
      setStatus('none');
      return;
    }
    let live = true;
    const ping = async () => {
      const ok = await idx.health();
      if (live) setStatus(ok ? 'ok' : 'down');
    };
    ping();
    const h = setInterval(ping, intervalMs);
    return () => {
      live = false;
      clearInterval(h);
    };
  }, [idx, intervalMs]);
  return status;
}
