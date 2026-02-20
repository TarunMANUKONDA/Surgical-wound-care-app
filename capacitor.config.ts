import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.surgical.woundcare',
  appName: 'Surgical Wound Care',
  webDir: 'dist',
  server: {
    cleartext: true,
    androidScheme: 'http',
    allowNavigation: ['10.235.248.134:8000', '192.168.0.6:8000', 'localhost:8000']
  }
};

export default config;
