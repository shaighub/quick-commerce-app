import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import { routes } from './routes.js';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root is missing');
}

const router = createBrowserRouter(routes);

createRoot(rootElement).render(
  <StrictMode>
    <App router={router} />
  </StrictMode>,
);
