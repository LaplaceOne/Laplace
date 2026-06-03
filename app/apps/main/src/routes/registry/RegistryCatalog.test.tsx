import { render, screen, fireEvent } from '@testing-library/react';
import { RegistryCatalog } from './RegistryCatalog';

test('shows criteria cards and filters by tier', () => {
  render(<RegistryCatalog />);
  // Both official criteria appear under the default Criteria tab / All tiers.
  expect(screen.getByText(/hashlock/i)).toBeInTheDocument();
  // /validity/i also matches the "Validity guests" tab button, so use getAllByText.
  expect(screen.getAllByText(/validity/i).length).toBeGreaterThan(0);
  // Switch to the Validity guests tab → empty state (registry guests are empty today).
  fireEvent.click(screen.getByRole('button', { name: /validity guests/i }));
  expect(screen.getByText(/none yet/i)).toBeInTheDocument();
});
