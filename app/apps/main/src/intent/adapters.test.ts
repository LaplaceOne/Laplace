import { fromIndexerRow } from './adapters';
import type { IntentRow } from '../indexer/indexerClient';

const row: IntentRow = {
  pda: 'P', id: 'i', maker: 'M', receiver: 'R', refundRecipient: 'RR', criterionProgram: 'C',
  asset: { kind: 'NativeSol' }, amount: '1500000000', expirySlot: 1000, createdSlot: 10,
  status: 'active', closed: false, createdSig: 's', updatedSlot: 10,
};

test('fromIndexerRow normalizes amounts/slots/status and SOL asset', () => {
  const v = fromIndexerRow(row);
  expect(v.amount).toBe(1500000000n);
  expect(v.expirySlot).toBe(1000n);
  expect(v.status).toBe('Active');
  expect(v.asset).toEqual({ kind: 'NativeSol', symbol: 'SOL', decimals: 9 });
});
