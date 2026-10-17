import { CapacitorShareTarget } from '@capgo/capacitor-share-target';
import { SplashScreen } from '@capacitor/splash-screen';
import { navigate } from './router';
import { setPendingShare } from './store';

/** Wires up app-only features: receiving links shared from Instagram, TikTok, browsers… */
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
}
