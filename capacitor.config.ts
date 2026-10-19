import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Change to a reverse-domain ID you own before publishing to the App Store / Google Play.
  appId: 'com.taisty.app',
  appName: 'Taisty',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#121513',
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_notify',
      iconColor: '#3d7f71',
    },
  },
};

export default config;
