import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tradevault.app',
  appName: 'TradeVault',
  webDir: 'web/dist',
  bundledWebRuntime: false,
  loggingEnabled: false,
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },
  server: {
    // The hosted API. Override at runtime from Settings > Server URL inside the app.
    cleartext: true
  },
  plugins: {
    Keyboard: {
      resizeOnFullScreen: true
    }
  }
};

export default config;
