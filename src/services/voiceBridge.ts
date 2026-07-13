import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  type LocalAudioTrack,
  type RemoteTrack,
} from 'livekit-client';
import { startVoiceService, stopVoiceService } from './foregroundService';

export type VoiceBridgeStage =
  | 'idle'
  | 'health_check'
  | 'connecting'
  | 'mic_init'
  | 'handshake'
  | 'waiting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

export type VoiceSubtitle = {
  id: string;
  text: string;
  timestamp: number;
  speaker: 'you' | 'samantha' | 'system';
};

export type VoiceBridgeSnapshot = {
  connected: boolean;
  connecting: boolean;
  stage: VoiceBridgeStage;
  detail: string;
  error: string | null;
  pttMode: boolean;
  pttActive: boolean;
  agentSpeaking: boolean;
  subtitles: VoiceSubtitle[];
};

export type VoiceBridgeConnectOptions = {
  pttMode?: boolean;
};

export interface VoiceBridgeAdapter {
  subscribe(listener: (snapshot: VoiceBridgeSnapshot) => void): () => void;
  connect(options?: VoiceBridgeConnectOptions): Promise<void>;
  disconnect(): Promise<void>;
  setPttMode(enabled: boolean): Promise<void>;
  startPtt(): Promise<void>;
  stopPtt(): Promise<void>;
}

type TokenResponse = {
  token: string;
  serverUrl: string;
  room?: string;
  identity?: string;
};

const apiBase = import.meta.env.VITE_API_BASE || '';
const config = {
  tokenEndpoint: import.meta.env.VITE_VOICE_TOKEN_ENDPOINT || `${apiBase}/api/voice/token`,
  livekitUrl: import.meta.env.VITE_LIVEKIT_URL || '',
  roomName: import.meta.env.VITE_VOICE_ROOM || 'samantha-room',
  identity: import.meta.env.VITE_VOICE_IDENTITY || 'david',
  voice: import.meta.env.VITE_VOICE_PROFILE || 'kokoro-af_heart',
  peerConnectionTimeoutMs: Number(import.meta.env.VITE_LIVEKIT_PEER_TIMEOUT_MS || 20_000),
  websocketTimeoutMs: Number(import.meta.env.VITE_LIVEKIT_WS_TIMEOUT_MS || 8_000),
  maxRetries: Number(import.meta.env.VITE_VOICE_CONNECT_RETRIES || 3),
  retryBackoffMs: Number(import.meta.env.VITE_VOICE_RETRY_BACKOFF_MS || 3_000),
  handshakeIntervalMs: Number(import.meta.env.VITE_VOICE_HANDSHAKE_INTERVAL_MS || 2_000),
  handshakeAttempts: Number(import.meta.env.VITE_VOICE_HANDSHAKE_ATTEMPTS || 10),
};

const initialSnapshot: VoiceBridgeSnapshot = {
  connected: false,
  connecting: false,
  stage: 'idle',
  detail: '',
  error: null,
  pttMode: false,
  pttActive: false,
  agentSpeaking: false,
  subtitles: [],
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const appendQuery = (url: string, params: Record<string, string>) => {
  const base = url || '/api/voice/token';
  const parsed = new URL(base, window.location.origin);
  Object.entries(params).forEach(([key, value]) => parsed.searchParams.set(key, value));
  return /^https?:\/\//.test(base) ? parsed.toString() : `${parsed.pathname}${parsed.search}${parsed.hash}`;
};

class SnapshotEmitter {
  protected snapshot: VoiceBridgeSnapshot = { ...initialSnapshot };
  private listeners = new Set<(snapshot: VoiceBridgeSnapshot) => void>();

  subscribe(listener: (snapshot: VoiceBridgeSnapshot) => void) {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  protected emit(patch: Partial<VoiceBridgeSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener(this.snapshot));
  }

  protected appendSubtitle(subtitle: VoiceSubtitle) {
    this.emit({ subtitles: [...this.snapshot.subtitles, subtitle].slice(-50) });
  }
}

class LiveKitVoiceBridgeAdapter extends SnapshotEmitter implements VoiceBridgeAdapter {
  private room: Room | null = null;
  private micTrack: LocalAudioTrack | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private remoteAudioElements = new Set<HTMLMediaElement>();

  async connect(options: VoiceBridgeConnectOptions = {}) {
    if (this.room || this.snapshot.connecting) return;

    this.emit({
      connecting: true,
      connected: false,
      error: null,
      pttMode: Boolean(options.pttMode ?? this.snapshot.pttMode),
      stage: 'health_check',
      detail: 'Starting voice bridge...',
      subtitles: [],
    });

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= config.maxRetries; attempt += 1) {
      try {
        await this.connectOnce(attempt);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        await this.cleanupRoom();

        if (attempt < config.maxRetries) {
          const detail = attempt === 1
            ? `Connecting... retry ${attempt + 1}/${config.maxRetries}`
            : `Check Tailscale VPN is on - retry ${attempt + 1}/${config.maxRetries}`;
          this.emit({ stage: 'connecting', detail });
          await wait(config.retryBackoffMs * attempt);
        }
      }
    }

    this.emit({
      connecting: false,
      connected: false,
      stage: 'error',
      detail: 'Cannot reach voice bridge',
      error: lastError?.message || 'Connection failed',
    });
  }

  async disconnect() {
    await this.cleanupRoom();
    this.emit({
      connected: false,
      connecting: false,
      stage: 'idle',
      detail: '',
      error: null,
      pttActive: false,
      agentSpeaking: false,
    });
  }

  async setPttMode(enabled: boolean) {
    this.emit({ pttMode: enabled, pttActive: false });
    await this.applyMicMode();
  }

  async startPtt() {
    if (!this.snapshot.pttMode) return;
    if (!this.room && this.snapshot.connected) {
      this.emit({ pttActive: true, stage: 'listening', detail: 'Inputting...' });
      return;
    }
    if (!this.room) return;
    await this.room.localParticipant.setMicrophoneEnabled(true);
    this.emit({ pttActive: true, stage: 'listening', detail: 'Inputting...' });
  }

  async stopPtt() {
    if (!this.snapshot.pttMode) return;
    if (!this.room && this.snapshot.connected) {
      this.emit({ pttActive: false, stage: 'listening', detail: 'Standby (PTT)' });
      return;
    }
    if (!this.room) return;
    await this.room.localParticipant.setMicrophoneEnabled(false);
    this.emit({ pttActive: false, stage: 'listening', detail: 'Listening' });
  }

  private async connectOnce(attempt: number) {
    this.emit({ stage: 'health_check', detail: 'Getting token...' });
    const tokenData = await this.fetchToken();

    if (tokenData.serverUrl.startsWith('mock://')) {
      this.connectMockRoom();
      return;
    }

    const room = new Room({
      adaptiveStream: false,
      dynacast: false,
    });

    this.installRoomHandlers(room);
    this.emit({ stage: 'connecting', detail: `Joining room... (${attempt}/${config.maxRetries})` });

    await room.connect(tokenData.serverUrl, tokenData.token, {
      autoSubscribe: true,
      peerConnectionTimeout: config.peerConnectionTimeoutMs,
      websocketTimeout: config.websocketTimeoutMs,
    });
    await room.startAudio();

    this.room = room;
    this.emit({ connected: true, connecting: false, stage: 'mic_init', detail: 'Enabling microphone...' });
    await startVoiceService();

    this.micTrack = await createLocalAudioTrack({
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
    });
    await room.localParticipant.publishTrack(this.micTrack);
    await this.applyMicMode();

    await this.requestWakeLock();
    await this.handshakeWithWorker(room);

    if (this.room === room) {
      this.emit({ stage: 'listening', detail: this.snapshot.pttMode ? 'Standby (PTT)' : 'Listening' });
    }
  }

  private async fetchToken(): Promise<TokenResponse> {
    const url = appendQuery(config.tokenEndpoint, {
      room: config.roomName,
      identity: config.identity,
      voice: config.voice,
    });
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Token failed: ${response.status}`);

    const data = await response.json();
    const serverUrl = data.serverUrl || config.livekitUrl;
    if (!data.token || !serverUrl) throw new Error('Token response missing LiveKit connection details');

    return { ...data, serverUrl };
  }

  private installRoomHandlers(room: Room) {
    room.on(RoomEvent.Reconnected, () => {
      this.emit({ stage: 'listening', detail: 'Reconnected' });
      room.startAudio().catch(() => {});
    });

    room.on(RoomEvent.Disconnected, () => {
      this.cleanupRoom().catch(() => {});
      this.emit({ connected: false, connecting: false, stage: 'idle', detail: '', agentSpeaking: false });
    });

    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Audio) return;
      const element = track.attach();
      element.autoplay = true;
      element.style.display = 'none';
      document.body.appendChild(element);
      this.remoteAudioElements.add(element);
      this.emit({ agentSpeaking: true, stage: 'speaking', detail: 'Samantha is speaking' });
    });

    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      track.detach().forEach((element) => {
        element.remove();
        this.remoteAudioElements.delete(element);
      });
      this.emit({ agentSpeaking: false, stage: 'listening', detail: 'Listening' });
    });

    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const agentSpeaking = speakers.some((participant) => participant.identity !== room.localParticipant.identity);
      const userSpeaking = speakers.some((participant) => participant.identity === room.localParticipant.identity);

      if (agentSpeaking) {
        this.emit({ agentSpeaking: true, stage: 'speaking', detail: 'Samantha is speaking' });
      } else if (userSpeaking) {
        this.emit({ agentSpeaking: false, stage: 'listening', detail: 'Inputting...' });
      } else if (this.snapshot.connected) {
        this.emit({ agentSpeaking: false, stage: 'listening', detail: this.snapshot.pttMode ? 'Standby (PTT)' : 'Listening' });
      }
    });

    room.on(RoomEvent.TranscriptionReceived, (segments) => {
      segments.forEach((segment) => {
        if (!segment.text?.trim()) return;
        this.upsertSubtitle({
          id: segment.id || `transcript-${Date.now()}`,
          text: segment.text.trim(),
          timestamp: Date.now(),
          speaker: 'samantha',
        });
      });
      this.emit({ stage: 'speaking', detail: 'Samantha is speaking' });
    });

    room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
      if (topic === 'ready_ack') {
        this.emit({ stage: 'waiting', detail: 'Agent connected, loading...' });
        return;
      }

      if (topic !== 'raw_subtitle') return;
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (!data.text) return;

        const trimmed = String(data.text).trim();
        const speaker = trimmed.startsWith('You:') ? 'you' : trimmed.startsWith('Samantha:') ? 'samantha' : 'samantha';
        const cleanText = trimmed.replace(/^(You|Samantha):\s*/, '');
        this.mergeSubtitle({
          id: `raw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: cleanText,
          timestamp: Date.now(),
          speaker,
        });
      } catch (err) {
        console.error('[VoiceBridge] Failed to parse subtitle payload', err);
      }
    });
  }

  private async handshakeWithWorker(room: Room) {
    this.emit({ stage: 'handshake', detail: 'Waiting for agent...' });

    let acked = false;
    const onAck = (_payload: Uint8Array, _participant?: unknown, _kind?: unknown, topic?: string) => {
      if (topic === 'ready_ack') acked = true;
    };
    room.on(RoomEvent.DataReceived, onAck);

    try {
      for (let attempt = 1; attempt <= config.handshakeAttempts; attempt += 1) {
        if (acked || this.room !== room) break;
        this.emit({ stage: 'handshake', detail: `Waiting for agent... (${attempt}/${config.handshakeAttempts})` });
        const payload = new TextEncoder().encode(JSON.stringify({ action: 'connected_and_ready' }));
        await room.localParticipant.publishData(payload, { reliable: true });
        await wait(config.handshakeIntervalMs);
      }
    } finally {
      room.off(RoomEvent.DataReceived, onAck);
    }

    if (!acked) {
      this.appendSubtitle({
        id: `handshake-${Date.now()}`,
        text: 'No voice worker acknowledgement yet. Waiting for agent fallback.',
        timestamp: Date.now(),
        speaker: 'system',
      });
    }
  }

  private async applyMicMode() {
    if (!this.room) return;
    await this.room.localParticipant.setMicrophoneEnabled(!this.snapshot.pttMode);
  }

  private async requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch {
      this.wakeLock = null;
    }
  }

  private upsertSubtitle(subtitle: VoiceSubtitle) {
    const subtitles = [...this.snapshot.subtitles];
    const index = subtitles.findIndex((item) => item.id === subtitle.id);
    if (index >= 0) {
      subtitles[index] = subtitle;
      this.emit({ subtitles });
    } else {
      this.appendSubtitle(subtitle);
    }
  }

  private mergeSubtitle(subtitle: VoiceSubtitle) {
    const subtitles = [...this.snapshot.subtitles];
    const last = subtitles[subtitles.length - 1];
    if (last && last.speaker === subtitle.speaker && subtitle.timestamp - last.timestamp < 2_000) {
      subtitles[subtitles.length - 1] = {
        ...last,
        text: `${last.text} ${subtitle.text}`,
        timestamp: subtitle.timestamp,
      };
      this.emit({ subtitles });
      return;
    }

    this.appendSubtitle(subtitle);
  }

  private connectMockRoom() {
    this.emit({
      connecting: false,
      connected: true,
      stage: 'listening',
      detail: this.snapshot.pttMode ? 'Standby (PTT)' : 'Listening',
      error: null,
      subtitles: [{
        id: 'mock-ready',
        text: 'Connected to voice bridge test adapter.',
        timestamp: Date.now(),
        speaker: 'system',
      }],
    });
  }

  private async cleanupRoom() {
    const room = this.room;
    this.room = null;
    this.micTrack = null;

    this.remoteAudioElements.forEach((element) => element.remove());
    this.remoteAudioElements.clear();

    if (this.wakeLock) {
      await this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }

    if (room) {
      await room.disconnect(true).catch(() => {});
    }

    await stopVoiceService();
  }
}

export const createVoiceBridge = (): VoiceBridgeAdapter => new LiveKitVoiceBridgeAdapter();
