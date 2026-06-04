import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@laplace-one/sdk/react', () => ({
  useSlot: () => 0n,
}));

vi.mock('../../wallet/WalletProvider', () => ({
  useWallet: () => ({ selectedAccount: undefined }),
}));

vi.mock('../../indexer/hooks', () => ({
  useIntentList: () => ({ data: [], loading: false }),
  useStats: () => null,
}));

import Dashboard from './Dashboard';

test('renders role tabs and the empty-state CTA', () => {
  render(<MemoryRouter><Dashboard /></MemoryRouter>);
  expect(screen.getByRole('button', { name: 'Made by me' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'To me' })).toBeInTheDocument();
  expect(screen.getByText(/no intents here yet/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /create intent/i })).toBeInTheDocument();
});
