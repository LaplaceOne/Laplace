import { render, screen } from '@testing-library/react';
import { ExpiryCountdown } from './ExpiryCountdown.js';

test('shows expired when current slot passed expiry', () => {
  render(<ExpiryCountdown expirySlot={100n} currentSlot={150n} />);
  expect(screen.getByText(/expired/i)).toBeInTheDocument();
});

test('shows a remaining duration when before expiry', () => {
  render(<ExpiryCountdown expirySlot={1000n} currentSlot={100n} />);
  // 900 slots * 400ms ≈ 6m
  expect(screen.getByText(/m|s/)).toBeInTheDocument();
});
