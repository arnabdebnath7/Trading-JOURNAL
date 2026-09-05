// Android/iOS niceties: hardware back button + status bar colour.
// Safe to call on the web — it simply does nothing there.
export async function initNative() {
  if (typeof window === 'undefined') return;
  const C = window.Capacitor;
  if (!C || C.isNativePlatform?.() !== true) return;

  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', ({ canGoBack }) => {
      const path = window.location.pathname;
      if (!canGoBack || path === '/' || path === '/index.html') {
        App.exitApp();
      } else {
        window.history.back();
      }
    });
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && typeof window.__tradevaultSync === 'function') window.__tradevaultSync();
    });
  } catch {
    /* plugin not present */
  }

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0b0f16' });
  } catch {
    /* plugin not present */
  }
}
