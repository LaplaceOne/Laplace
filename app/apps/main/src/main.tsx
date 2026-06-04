import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@laplace-one/ui/styles/tokens.css';
import '@laplace-one/ui/styles/base.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
