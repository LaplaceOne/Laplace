import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from '@laplace/ui';
import { router } from './router';

export function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}
