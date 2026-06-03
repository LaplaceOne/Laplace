import { createBrowserRouter } from 'react-router-dom';
import { SiteLayout } from './layouts/SiteLayout';
import { ConsoleLayout } from './layouts/ConsoleLayout';
import Landing from './routes/Landing';
import Docs from './routes/Docs';
import Lab from './routes/Lab';
import Registry from './routes/Registry';
import NotFound from './routes/NotFound';
import Dashboard from './routes/console/Dashboard';
import Create from './routes/console/Create';
import IntentDetail from './routes/console/IntentDetail';
import PublicIntent from './routes/console/PublicIntent';
import Manual from './routes/console/Manual';

export const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/docs', element: <Docs /> },
      { path: '/lab', element: <Lab /> },
      { path: '/registry', element: <Registry /> },
    ],
  },
  {
    path: '/app',
    element: <ConsoleLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'create', element: <Create /> },
      { path: 'intent/:pda', element: <IntentDetail /> },
      { path: 'i/:pda', element: <PublicIntent /> },
      { path: 'manual', element: <Manual /> },
    ],
  },
  { path: '*', element: <NotFound /> },
]);
