import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import AccountRoot from './AccountRoot';
import './styles.css';
import './interface.css';
import './components/PlayerAppearance.css';
import './components/AdaptiveLayout.css';
const SportRoomDemo = lazy(() => import('./components/room3d/SportRoomDemo'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {new URLSearchParams(location.search).get('room-demo') === 'sport' ? <Suspense fallback={<p>Загружаем 3D-спортзал…</p>}><SportRoomDemo /></Suspense> : <AccountRoot />}
  </StrictMode>,
);


import './selection.css';
