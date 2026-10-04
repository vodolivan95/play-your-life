import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AccountRoot from './AccountRoot';
import './styles.css';
import './interface.css';
import './components/PlayerAppearance.css';
import './components/AdaptiveLayout.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccountRoot />
  </StrictMode>,
);

