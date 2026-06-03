import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { IntentView } from '@laplace/ui';

const VIEW: IntentView = {
  pda: 'PDA1111111111111111111111111111111111111111',
  maker: 'ME',
  receiver: 'Recv1111111111111111111111111111111111111111',
  refundRecipient: 'ME',
  criterionProgram: 'DNotXVWh1ifzp9MHSd5H4F78SRHptF9p8vGfMmjtuWX2',
  asset: { kind: 'NativeSol', symbol: 'SOL', decimals: 9 },
  amount: 1500000000n,
  expirySlot: 1000n,
  createdSlot: 10n,
  status: 'Active',
  closed: false,
};

vi.mock('@laplace/sdk/react', () => ({
  useSlot: () => 0n,
  useLaplaceContext: () => ({ signer: { address: 'ME' }, cluster: 'devnet' }),
  useClient: () => ({}),
  useIntent: () => null,
}));

vi.mock('../../indexer/hooks', () => ({
  useIntentDetail: () => ({ view: VIEW, timeline: [] }),
}));

vi.mock('./useIntentActions', () => ({
  useIntentActions: () => ({
    ri: null,
    busy: false,
    fulfillHashlock: vi.fn(),
    fulfillValidity: vi.fn(),
    refund: vi.fn(),
    close: vi.fn(),
  }),
}));

import IntentDetail from './IntentDetail';

test('renders the amount, a party row, and the secret-free share input', () => {
  render(
    <MemoryRouter initialEntries={['/app/intent/PDA1111111111111111111111111111111111111111']}>
      <Routes>
        <Route path="/app/intent/:pda" element={<IntentDetail />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(screen.getByText('1.5')).toBeInTheDocument();
  expect(screen.getByText('receiver')).toBeInTheDocument();
  const share = screen.getByLabelText('Share link') as HTMLInputElement;
  expect(share).toBeInTheDocument();
  expect(share.value).toBe('/app/i/PDA1111111111111111111111111111111111111111?cluster=devnet');
  expect(share.value).not.toMatch(/secret/i);
});
