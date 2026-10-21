import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { setupErrorReporting } from './lib/errorReport';
import { isNative } from './lib/platform';
import { initStore } from './lib/store';
import './styles.css';

setupErrorReporting();

// Back from authorizing Strava on the website: /strava-callback?code=…
const stravaCallback = location.pathname === '/strava-callback' ? new URLSearchParams(location.search) : undefined;
if (stravaCallback) history.replaceState(null, '', '/#/connections');

initStore().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
  if (stravaCallback) {
    import('./lib/strava')
      .then((m) => m.finishStravaAuth(stravaCallback))
      .catch((err) => console.warn('Strava sign-in failed', err));
  }
});

import('./lib/cloud').then((m) => m.setupCloud());

if (isNative) {
  import('./lib/native').then((m) => m.setupNative());
} else if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
