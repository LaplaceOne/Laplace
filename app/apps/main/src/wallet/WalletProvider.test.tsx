import { act, renderHook } from '@testing-library/react';

vi.mock('@wallet-standard/react', () => ({
  useWallets: () => [{ name: 'Phantom', icon: 'i', accounts: [{ address: 'ACC1', chains: ['solana:devnet'] }], chains: ['solana:devnet'], features: ['solana:signTransaction'] }],
  useConnect: () => [false, vi.fn()],
  useDisconnect: () => [false, vi.fn()],
}));

import { WalletProvider, useWallet } from './WalletProvider';

beforeEach(() => { try { localStorage.clear(); } catch {} });

test('select() sets the account and persists it', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => <WalletProvider>{children}</WalletProvider>;
  const { result } = renderHook(() => useWallet(), { wrapper });
  expect(result.current.selectedAccount).toBeUndefined();
  act(() => result.current.select(result.current.wallets[0]!.accounts[0]!));
  expect(result.current.selectedAccount?.address).toBe('ACC1');
  expect(localStorage.getItem('laplace-wallet')).toBe('ACC1');
});

test('auto-reselects a persisted account on mount', () => {
  try { localStorage.setItem('laplace-wallet', 'ACC1'); } catch {}
  const wrapper = ({ children }: { children: React.ReactNode }) => <WalletProvider>{children}</WalletProvider>;
  const { result } = renderHook(() => useWallet(), { wrapper });
  expect(result.current.selectedAccount?.address).toBe('ACC1');
});
