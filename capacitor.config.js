/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'com.tradevault.app',
  appName: 'TradeVault',
  webDir: 'web/dist',
  bundledWebRuntime: false,
  loggingEnabled: false,
  android: {
    allowMixedContent: true,
    captureInput: true
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

module.exports = config;
