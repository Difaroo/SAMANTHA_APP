import { Capacitor, registerPlugin } from '@capacitor/core';

type VoiceAudioRouteResult = {
  route: 'bluetooth' | 'headset' | 'earpiece' | 'communication-default' | 'communication-device';
  communicationMode: boolean;
};

type VoiceAudioRoutePlugin = {
  start: () => Promise<VoiceAudioRouteResult>;
  stop: () => Promise<void>;
};

const nativeVoiceAudioRoute = registerPlugin<VoiceAudioRoutePlugin>('VoiceAudioRoute');

export async function startVoiceAudioRoute(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  const result = await nativeVoiceAudioRoute.start();
  console.log(`[VoiceAudioRoute] Started (${result.route})`);
}

export async function stopVoiceAudioRoute(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    await nativeVoiceAudioRoute.stop();
    console.log('[VoiceAudioRoute] Restored');
  } catch (error) {
    console.error('[VoiceAudioRoute] Failed to restore:', error);
  }
}
