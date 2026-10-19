import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Change to a reverse-domain ID you own before publishing to the App Store / Google Play.
  appId: 'com.taisty.app',
  appName: 'tAIsty',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#6aae9f',
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_notify',
      iconColor: '#3d7f71',
    },
  },
};

export default config;
