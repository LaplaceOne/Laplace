import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { SiteLayout } from './SiteLayout';
import { ThemeProvider } from '@laplace/ui';

test('SiteLayout renders nav links and footer', () => {
  const router = createMemoryRouter(
    [{ path: '/', element: <SiteLayout />, children: [{ index: true, element: <p>home</p> }] }],
    { initialEntries: ['/'] },
  );
  render(<ThemeProvider><RouterProvider router={router} /></ThemeProvider>);
  expect(screen.getByRole('link', { name: /docs/i })).toBeInTheDocument();
  expect(screen.getByText(/laplace protocol/i)).toBeInTheDocument();
});
