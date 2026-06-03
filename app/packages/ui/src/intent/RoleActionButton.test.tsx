import { render, screen, fireEvent } from '@testing-library/react';
import { RoleActionButton } from './RoleActionButton.js';

test('renders the action label and fires onAct when enabled', () => {
  const onAct = vi.fn();
  render(<RoleActionButton action={{ kind: 'fulfill', enabled: true, label: 'Fulfill' }} onAct={onAct} />);
  fireEvent.click(screen.getByRole('button', { name: 'Fulfill' }));
  expect(onAct).toHaveBeenCalledWith('fulfill');
});

test('disables and shows the reason when not enabled', () => {
  render(<RoleActionButton action={{ kind: 'refund', enabled: false, label: 'Refund', reason: 'Connect wallet' }} onAct={() => {}} />);
  expect(screen.getByRole('button', { name: /refund/i })).toBeDisabled();
  expect(screen.getByText('Connect wallet')).toBeInTheDocument();
});
