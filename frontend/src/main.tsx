import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import './shared/styles.css';
import { AuthProvider } from './features/auth/AuthProvider';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element was not found.');

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider><App /></AuthProvider>
  </StrictMode>,
);
