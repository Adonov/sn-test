import { App } from '@capacitor/app';
import { CapacitorShareTarget } from '@capgo/capacitor-share-target';
import { SplashScreen } from '@capacitor/splash-screen';
import { syncHealth } from './healthSync';
import { refreshReminders, setupReminders } from './notify';
import { setupPremium } from './premium';
import { navigate } from './router';
import { setPendingShare } from './store';
import { finishStravaAuth, syncStrava } from './strava';
import { setupWidgets } from './widget';

/** Wires up app-only features: shared links, widgets, reminders, Apple Health / Health Connect. */
export function setupNative(): void {
  SplashScreen.hide().catch(() => {});

  CapacitorShareTarget.addListener('shareReceived', (event) => {
    const text = [event.title, ...(event.texts ?? [])].filter(Boolean).join('\n').trim();
    if (!text) return;
    setPendingShare(text);
    // A fresh route segment remounts the import page even if it is already open.
    navigate(`/import/${Date.now()}`);
  }).catch(() => {
    // Not available (e.g. iOS without the Share Extension); importing via paste still works.
  });

  App.addListener('appUrlOpen', ({ url }) => {
    // taisty://<callback domain>/strava?code=… – back from authorizing Strava.
    const strava = /^taisty:\/\/[^/]+\/strava\?(.*)$/.exec(url);
    if (strava) {
      import('@capacitor/browser').then(({ Browser }) => Browser.close().catch(() => {}));
      navigate('/connections');
      finishStravaAuth(new URLSearchParams(strava[1])).catch((err) => console.warn('Strava sign-in failed', err));
      return;
    }
    // taisty://nutrition, taisty://fasting… from the home screen widgets.
    const match = /^taisty:\/\/([\w/-]*)/.exec(url);
    if (match) navigate(`/${match[1]}`);
  }).catch(() => {});

  App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) return;
    syncHealth();
    syncStrava();
    refreshReminders();
  }).catch(() => {});

  setupPremium();
  setupWidgets();
  setupReminders();
  syncHealth();
}
