import { fromIndexerRow } from './adapters';
import type { IntentRow } from '../indexer/indexerClient';

// asset uses `__kind` — the real shape the SDK/indexer emit (kit discriminated union).
const row: IntentRow = {
  pda: 'P', id: 'i', maker: 'M', receiver: 'R', refundRecipient: 'RR', criterionProgram: 'C',
  asset: { __kind: 'NativeSol' }, amount: '1500000000', expirySlot: 1000, createdSlot: 10,
  status: 'active', closed: false, createdSig: 's', updatedSlot: 10,
};

test('fromIndexerRow normalizes amounts/slots/status and SOL asset', () => {
  const v = fromIndexerRow(row);
  expect(v.amount).toBe(1500000000n);
  expect(v.expirySlot).toBe(1000n);
  expect(v.status).toBe('Active');
  expect(v.asset).toEqual({ kind: 'NativeSol', symbol: 'SOL', decimals: 9 });
});

test('fromIndexerRow handles an SPL asset (__kind) without crashing', () => {
  const spl: IntentRow = { ...row, asset: { __kind: 'SplToken', mint: 'Mint1111', tokenProgram: 'Tok', vault: 'V' } };
  const v = fromIndexerRow(spl);
  expect(v.asset.kind).toBe('SplToken');
  expect(v.asset.mint).toBe('Mint1111');
});
