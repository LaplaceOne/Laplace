import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Registry from './Registry';

test('Registry renders trust model, tiers, and catalog', () => {
  render(<MemoryRouter><Registry /></MemoryRouter>);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/permissionless protocol/i);
  // "tiers" appears in the label, the title, and a filter chip → use getAllByText.
  expect(screen.getAllByText(/tiers/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/hashlock/i)).toBeInTheDocument();
});
