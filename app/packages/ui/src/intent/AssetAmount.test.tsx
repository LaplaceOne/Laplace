import { render, screen } from '@testing-library/react';
import { AssetAmount } from './AssetAmount.js';

test('formats base units with the asset symbol', () => {
  render(<AssetAmount amount={1500000000n} asset={{ kind: 'NativeSol', symbol: 'SOL', decimals: 9 }} />);
  expect(screen.getByText('1.5')).toBeInTheDocument();
  expect(screen.getByText('SOL')).toBeInTheDocument();
});
