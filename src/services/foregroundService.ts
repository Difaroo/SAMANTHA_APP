import { Capacitor } from '@capacitor/core';

/**
 * Foreground Service wrapper for Android.
 * Keeps the LiveKit WebRTC connection alive when the screen is off
 * or the app is backgrounded by registering as a microphone-type
 * foreground service (same mechanism as phone calls / Spotify).
 */

type ForegroundServiceButtonEvent = { buttonId: number };
type ForegroundServiceListener = { remove: () => void };
type ForegroundServiceModule = {
  startForegroundService: (options: {
    id: number;
    title: string;
    body: string;
    smallIcon: string;
    buttons: { id: number; title: string }[];
  }) => Promise<void>;
  stopForegroundService: () => Promise<void>;
  addListener: (
    eventName: 'buttonClicked',
    callback: (event: ForegroundServiceButtonEvent) => void
  ) => Promise<ForegroundServiceListener>;
};

let foregroundServiceModule: ForegroundServiceModule | null = null;

const getForegroundService = async () => {
  if (foregroundServiceModule) return foregroundServiceModule;
  try {
    const mod = await import('@capawesome-team/capacitor-android-foreground-service');
    // Capacitor plugins are proxies and expose arbitrary property names as
    // native methods. Returning that proxy from an async function makes the
    // Promise resolver probe `.then`, which invokes a non-existent native
    // `ForegroundService.then()` method. Return a plain wrapper instead.
    const plugin = mod.ForegroundService;
    foregroundServiceModule = {
      startForegroundService: (options) => plugin.startForegroundService(options),
      stopForegroundService: () => plugin.stopForegroundService(),
      addListener: (eventName, callback) => plugin.addListener(eventName, callback),
    } as ForegroundServiceModule;
    return foregroundServiceModule;
  } catch {
    console.warn('[ForegroundService] Plugin not available on this platform');
    return null;
  }
};

export const startVoiceService = async () => {
  if (Capacitor.getPlatform() !== 'android') return;

  const ForegroundService = await getForegroundService();
  if (!ForegroundService) return;

  try {
    await ForegroundService.startForegroundService({
      id: 9001,
      title: 'Samantha — Connected',
      body: 'Voice conversation active',
      smallIcon: 'ic_stat_samantha',
      buttons: [
        { id: 1, title: 'Disconnect' },
      ],
    });
    console.log('[ForegroundService] Started');
  } catch (err) {
    console.error('[ForegroundService] Failed to start:', err);
  }
};

export const stopVoiceService = async () => {
  if (Capacitor.getPlatform() !== 'android') return;

  const ForegroundService = await getForegroundService();
  if (!ForegroundService) return;

  try {
    await ForegroundService.stopForegroundService();
    console.log('[ForegroundService] Stopped');
  } catch (err) {
    console.error('[ForegroundService] Failed to stop:', err);
  }
};

/**
 * Listen for notification button taps.
 * Returns a cleanup function to remove the listener.
 */
export const onDisconnectTapped = (callback: () => void): (() => void) => {
  if (Capacitor.getPlatform() !== 'android') return () => {};

  // Mutable state object so cleanup can signal cancellation to pending async
  const state = { removed: false, removeListener: () => {} };

  getForegroundService().then((ForegroundService) => {
    if (!ForegroundService || state.removed) return;
    ForegroundService.addListener('buttonClicked', (event: { buttonId: number }) => {
      if (event.buttonId === 1) callback();
    }).then((listener) => {
      if (state.removed) {
        listener.remove();
        return;
      }
      state.removeListener = () => listener.remove();
    });
  });

  return () => {
    state.removed = true;
    state.removeListener();
  };
};
