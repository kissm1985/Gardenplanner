import '@fontsource-variable/outfit';
import '@fontsource/jetbrains-mono/400.css';
import '../styles/tokens.css';
import '../styles/app.css';
import './admin.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Admin } from './Admin';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Admin />
  </StrictMode>,
);
