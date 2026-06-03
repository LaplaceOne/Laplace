import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@laplace/ui/styles/tokens.css';
import '@laplace/ui/styles/base.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
