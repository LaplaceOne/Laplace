import { render, screen } from '@testing-library/react';
import { IntentStatusBadge } from './IntentStatusBadge.js';

test('renders the effective status label and class', () => {
  render(<IntentStatusBadge status="Expiring soon" />);
  const el = screen.getByText('Expiring soon');
  expect(el).toBeInTheDocument();
  expect(el.className).toMatch(/expiring/);
});
