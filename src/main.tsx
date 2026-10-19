import '@fontsource-variable/manrope';
import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import AccountRoot from './AccountRoot';
import ErrorBoundary from './components/ErrorBoundary';
import { preloadCityAssets } from './cityLive/preload';
import './styles.css';
import './interface.css';
import './components/PlayerAppearance.css';
import './components/AdaptiveLayout.css';
const SportRoomDemo = lazy(() => import('./components/room3d/SportRoomDemo'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {new URLSearchParams(location.search).get('room-demo') === 'sport' ? <Suspense fallback={<p>Загружаем 3D-спортзал…</p>}><SportRoomDemo /></Suspense> : <ErrorBoundary scope="app"><AccountRoot /></ErrorBoundary>}
  </StrictMode>,
);

if (new URLSearchParams(location.search).get('room-demo') !== 'sport') preloadCityAssets();

import './selection.css';
import './menuTheme';
import './theme-dark.generated.css';
import './theme-dark.css';
import './apple-switch.css';
import './theme-light-glass.css';
import './theme-dark-glass.css';
