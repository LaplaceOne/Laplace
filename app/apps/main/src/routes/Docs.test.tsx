import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Docs from './Docs';

test('Docs renders the rail and all major section headings', () => {
  render(<MemoryRouter><Docs /></MemoryRouter>);
  expect(screen.getByRole('link', { name: /intent lifecycle/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /the intent lifecycle/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /program ids/i })).toBeInTheDocument();
});
