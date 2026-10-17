import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Change to a reverse-domain ID you own before publishing to the App Store / Google Play.
  appId: 'com.forkful.app',
  appName: 'Forkful',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#e8590c',
      showSpinner: false,
    },
  },
};

export default config;
