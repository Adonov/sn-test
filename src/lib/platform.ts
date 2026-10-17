import { Capacitor } from '@capacitor/core';

/** True inside the iOS/Android app, false in a regular browser. */
export const isNative = Capacitor.isNativePlatform();
