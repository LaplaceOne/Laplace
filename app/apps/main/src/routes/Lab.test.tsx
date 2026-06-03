import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Lab from './Lab';

test('Lab renders the product family and verticals', () => {
  render(<MemoryRouter><Lab /></MemoryRouter>);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/one protocol/i);
  // "Future verticals" appears both as the section label and in the architecture
  // diagram's dashed box (both faithful ports), so use getAllByText.
  expect(screen.getAllByText(/future verticals/i).length).toBeGreaterThan(0);
});
