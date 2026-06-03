import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider } from '@laplace/ui';
import { SiteLayout } from './layouts/SiteLayout';
import Landing from './routes/Landing';
import Docs from './routes/Docs';

// AppProviders needs RPC/wallet; for the routing assertion we render SiteLayout under
// ThemeProvider only (layout has no chain deps). The full provider stack is covered by
// WalletProvider.test.tsx / hooks.test.tsx.
test('renders the docs route under the site layout', () => {
  const router = createMemoryRouter(
    [{ element: <SiteLayout />, children: [{ path: '/', element: <Landing /> }, { path: '/docs', element: <Docs /> }] }],
    { initialEntries: ['/docs'] },
  );
  render(<ThemeProvider><RouterProvider router={router} /></ThemeProvider>);
  expect(screen.getByRole('heading', { name: /the intent lifecycle/i })).toBeInTheDocument();
});
