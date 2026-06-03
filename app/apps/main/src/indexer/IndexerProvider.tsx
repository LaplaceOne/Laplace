import * as React from 'react';
import { createIndexerClient, type IndexerClient } from './indexerClient';
import { env } from '../env';

const Ctx = React.createContext<IndexerClient | null>(null);

export function IndexerProvider({ children }: { children: React.ReactNode }) {
  const client = React.useMemo(() => (env.indexerUrl ? createIndexerClient(env.indexerUrl) : null), []);
  return <Ctx.Provider value={client}>{children}</Ctx.Provider>;
}

/** Null when no indexer is configured — hooks then fall back to the SDK. */
export function useIndexer(): IndexerClient | null { return React.useContext(Ctx); }
