import { create } from 'zustand';

interface VoiceState {
  isVoiceConnected: boolean;
  setIsVoiceConnected: (connected: boolean) => void;
  voiceSessionStart: number | null;
  setVoiceSessionStart: (time: number | null) => void;
  statusText: string;
  setStatusText: (text: string) => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  isVoiceConnected: false,
  setIsVoiceConnected: (connected) => set({ 
    isVoiceConnected: connected, 
    voiceSessionStart: connected ? Date.now() : null 
  }),
  voiceSessionStart: null,
  setVoiceSessionStart: (time) => set({ voiceSessionStart: time }),
  statusText: '',
  setStatusText: (text) => set({ statusText: text }),
}));
