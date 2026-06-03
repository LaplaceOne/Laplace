import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { IndexerProvider } from '../indexer/IndexerProvider';
import Landing from './Landing';

// useStats reads useIndexer(); with VITE_INDEXER_URL unset it is null → stats render '—'.
test('Landing renders hero and key section headings', () => {
  render(<MemoryRouter><IndexerProvider><Landing /></IndexerProvider></MemoryRouter>);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/escrow that releases/i);
  expect(screen.getByText(/how it works/i)).toBeInTheDocument();
  expect(screen.getByText(/pluggable criteria/i)).toBeInTheDocument();
});
