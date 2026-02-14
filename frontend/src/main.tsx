import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import './styles/tokens.css';
import './styles/reset.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/workspace.css';
import './styles/library.css';
import './styles/lexicon.css';
import './styles/settings.css';
import './styles/responsive.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
