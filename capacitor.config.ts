import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.samantha.voice',
  appName: 'Samantha',
  webDir: 'dist',
  server: {
    androidScheme: 'https',  // WebRTC requires secure context for getUserMedia
  },
  android: {
    allowMixedContent: true,  // Allow ws:// LiveKit from https:// origin (Tailscale)
  },
};

export default config;
