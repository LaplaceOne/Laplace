import { render, screen } from '@testing-library/react';
import { App } from './App';

test('App renders the root', () => {
  render(<App />);
  expect(screen.getByTestId('app-root')).toBeInTheDocument();
});
