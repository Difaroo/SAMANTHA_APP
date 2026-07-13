import { create } from 'zustand';
import type { VoiceBridgeStage } from '../services/voiceBridge';

interface VoiceState {
  isVoiceConnected: boolean;
  setIsVoiceConnected: (connected: boolean) => void;
  voiceSessionStart: number | null;
  setVoiceSessionStart: (time: number | null) => void;
  statusText: string;
  setStatusText: (text: string) => void;
  pipelineStage: VoiceBridgeStage;
  pipelineDetail: string;
  setPipeline: (stage: VoiceBridgeStage, detail?: string) => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  isVoiceConnected: false,
  setIsVoiceConnected: (connected) => set((state) => {
    if (state.isVoiceConnected === connected) return state;
    return {
      isVoiceConnected: connected,
      voiceSessionStart: connected ? Date.now() : null,
    };
  }),
  voiceSessionStart: null,
  setVoiceSessionStart: (time) => set({ voiceSessionStart: time }),
  statusText: '',
  setStatusText: (text) => set({ statusText: text }),
  pipelineStage: 'idle',
  pipelineDetail: '',
  setPipeline: (stage, detail = '') => set({ pipelineStage: stage, pipelineDetail: detail }),
}));
