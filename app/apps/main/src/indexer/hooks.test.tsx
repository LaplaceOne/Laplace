import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';

const listIntents = vi.fn();
vi.mock('./IndexerProvider', () => ({
  useIndexer: () => ({ baseUrl: 'x', listIntents, health: async () => true, getIntent: vi.fn(), stats: vi.fn(), validityConfigs: vi.fn() }),
}));
vi.mock('@laplace/sdk/react', () => ({ useLaplaceContext: () => ({ rpc: {}, cluster: 'devnet', signer: { address: 'ME' } }) }));

import { useIntentList } from './hooks';

test('useIntentList queries the indexer by role→owner and returns views', async () => {
  listIntents.mockResolvedValue([{ pda: 'P', id: 'i', maker: 'ME', receiver: 'R', refundRecipient: 'RR', criterionProgram: 'C', asset: { kind: 'NativeSol' }, amount: '1', expirySlot: 9, createdSlot: 1, status: 'active', closed: false, createdSig: 's', updatedSlot: 1 }]);
  const { result } = renderHook(() => useIntentList({ role: 'maker' }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(listIntents).toHaveBeenCalledWith(expect.objectContaining({ maker: 'ME' }));
  expect(result.current.data[0].pda).toBe('P');
});
