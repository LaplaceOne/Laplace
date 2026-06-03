import { renderHook, waitFor } from '@testing-library/react';

// Stable mock references: returning fresh objects each render would churn the hooks'
// effect dependency arrays ([idx], [rpc]) into a setState/render loop. In production
// IndexerProvider memoizes the client and LaplaceProvider memoizes rpc, so both are stable.
const listIntents = vi.fn();
const indexerMock = { baseUrl: 'x', listIntents, health: async () => true, getIntent: vi.fn(), stats: vi.fn(), validityConfigs: vi.fn() };
const sdkCtx = { rpc: {}, cluster: 'devnet', signer: { address: 'ME' } };

vi.mock('./IndexerProvider', () => ({ useIndexer: () => indexerMock }));
vi.mock('@laplace/sdk/react', () => ({ useLaplaceContext: () => sdkCtx }));

import { useIntentList } from './hooks';

test('useIntentList queries the indexer by role→owner and returns views', async () => {
  listIntents.mockResolvedValue([{ pda: 'P', id: 'i', maker: 'ME', receiver: 'R', refundRecipient: 'RR', criterionProgram: 'C', asset: { kind: 'NativeSol' }, amount: '1', expirySlot: 9, createdSlot: 1, status: 'active', closed: false, createdSig: 's', updatedSlot: 1 }]);
  const { result } = renderHook(() => useIntentList({ role: 'maker' }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(listIntents).toHaveBeenCalledWith(expect.objectContaining({ maker: 'ME' }));
  expect(result.current.data[0]!.pda).toBe('P');
});
