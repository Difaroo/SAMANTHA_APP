import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
} from 'livekit-client';
import { startVoiceService, stopVoiceService } from './foregroundService';
import { startVoiceAudioRoute, stopVoiceAudioRoute } from './voiceAudioRoute';
import { RoomLease } from './roomLease';
import { decodeVoiceDataEvent, type VoiceSpeaker } from './voiceDataProtocol';

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

export type VoiceConnectionStep =
  | 'initialising'
  | 'fetching_token'
  | 'joining_room'
  | 'audio_ready'
  | 'connected_ready';

export type VoiceSubtitle = {
  id: string;
  text: string;
  timestamp: number;
  speaker: VoiceSpeaker | 'system';
};

export type VoiceBridgeSnapshot = {
  connected: boolean;
  connecting: boolean;
  stage: VoiceBridgeStage;
  connectionStep: VoiceConnectionStep | null;
  failedStep: VoiceConnectionStep | null;
  detail: string;
  error: string | null;
  pttMode: boolean;
  pttActive: boolean;
  agentSpeaking: boolean;
  voiceSpeed: number;
  voiceSpeedOverride: boolean;
  enrollableSpeakerId: string | null;
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
  setVoiceSpeed(speed: number | null): Promise<void>;
  enrollLatestSpeakerAsDavid(): Promise<void>;
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
  connectionStep: null,
  failedStep: null,
  detail: '',
  error: null,
  pttMode: false,
  pttActive: false,
  agentSpeaking: false,
  voiceSpeed: 0.9,
  voiceSpeedOverride: false,
  enrollableSpeakerId: null,
  subtitles: [],
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const VOICE_SPEED_STORAGE_KEY = 'samantha-voice-speed';
const normalizeVoiceSpeed = (speed: number) => (
  Math.min(2, Math.max(0.5, Math.round(speed * 20) / 20))
);

const loadVoiceSpeed = (): number | null => {
  try {
    const stored = window.localStorage.getItem(VOICE_SPEED_STORAGE_KEY);
    if (stored === null) return null;
    const speed = Number(stored);
    return Number.isFinite(speed) && speed >= 0.5 && speed <= 2
      ? normalizeVoiceSpeed(speed)
      : null;
  } catch {
    return null;
  }
};

const persistVoiceSpeed = (speed: number | null) => {
  try {
    if (speed === null) window.localStorage.removeItem(VOICE_SPEED_STORAGE_KEY);
    else window.localStorage.setItem(VOICE_SPEED_STORAGE_KEY, String(speed));
  } catch {
    // Private/locked storage must not block live voice controls.
  }
};

class VoiceConnectionError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'VoiceConnectionError';
    this.retryable = retryable;
  }
}

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
  private roomLease = new RoomLease<Room>();
  private connectAbortController: AbortController | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private remoteAudioElements = new Set<HTMLMediaElement>();
  private reconnectHandshake: Promise<void> | null = null;
  private pendingDeliveryId: string | null = null;
  private lastAssistantAudioAt = 0;

  constructor() {
    super();
    const savedSpeed = loadVoiceSpeed();
    if (savedSpeed !== null) {
      persistVoiceSpeed(savedSpeed);
      this.snapshot = {
        ...this.snapshot,
        voiceSpeed: savedSpeed,
        voiceSpeedOverride: true,
      };
    }
  }

  async connect(options: VoiceBridgeConnectOptions = {}) {
    if (this.roomLease.hasActiveCycle() || this.snapshot.connecting || this.snapshot.connected) return;

    this.emit({
      connecting: true,
      connected: false,
      error: null,
      pttMode: Boolean(options.pttMode ?? this.snapshot.pttMode),
      stage: 'health_check',
      connectionStep: 'initialising',
      failedStep: null,
      detail: 'Initialising voice bridge...',
      enrollableSpeakerId: null,
      subtitles: [],
    });

    const abortController = new AbortController();
    this.connectAbortController = abortController;
    let lastError: Error | null = null;
    let lastFailedStep: VoiceConnectionStep = 'initialising';

    // Match VoiceBridge prod: establish the Android foreground/audio lifecycle
    // before joining LiveKit, so no joined participant can stall before mic
    // publication and the connected_and_ready handshake.
    await startVoiceAudioRoute();
    await startVoiceService();

    for (let attempt = 1; attempt <= config.maxRetries; attempt += 1) {
      const generation = this.roomLease.begin();
      try {
        await this.connectOnce(attempt, generation, abortController.signal);
        if (this.connectAbortController === abortController) this.connectAbortController = null;
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        lastFailedStep = this.snapshot.connectionStep || lastFailedStep;
        await this.cleanupGeneration(generation);

        if (abortController.signal.aborted) {
          await stopVoiceService();
          await stopVoiceAudioRoute();
          return;
        }
        const retryable = !(lastError instanceof VoiceConnectionError) || lastError.retryable;
        if (retryable && attempt < config.maxRetries) {
          const detail = attempt === 1
            ? `Connecting... retry ${attempt + 1}/${config.maxRetries}`
            : `Check Tailscale VPN is on - retry ${attempt + 1}/${config.maxRetries}`;
          this.emit({ stage: 'connecting', connectionStep: lastFailedStep, detail });
          await wait(config.retryBackoffMs * attempt);
          if (abortController.signal.aborted) return;
        } else {
          break;
        }
      }
    }

    if (this.connectAbortController === abortController) this.connectAbortController = null;
    await stopVoiceService();
    await stopVoiceAudioRoute();
    this.emit({
      connecting: false,
      connected: false,
      stage: 'error',
      connectionStep: lastFailedStep,
      failedStep: lastFailedStep,
      detail: 'Cannot reach voice bridge',
      error: lastError?.message || 'Connection failed',
    });
  }

  async disconnect() {
    this.connectAbortController?.abort();
    this.connectAbortController = null;
    const room = this.roomLease.current();
    this.roomLease.cancel();
    await this.cleanupRoom(room);
    this.emit({
      connected: false,
      connecting: false,
      stage: 'idle',
      connectionStep: null,
      failedStep: null,
      detail: '',
      error: null,
      pttActive: false,
      agentSpeaking: false,
      enrollableSpeakerId: null,
    });
  }

  async setPttMode(enabled: boolean) {
    this.emit({
      pttMode: enabled,
      pttActive: false,
      ...(this.snapshot.connected && !this.snapshot.agentSpeaking
        ? { stage: 'listening' as const, detail: enabled ? 'Standby (PTT)' : 'Listening' }
        : {}),
    });
    await this.publishControl({ action: 'ptt_mode', enabled });
    if (!enabled) await this.publishControl({ action: 'ptt_up' });
    await this.applyMicMode();
  }

  async startPtt() {
    if (!this.snapshot.pttMode) return;
    const room = this.roomLease.current();
    if (!room && this.snapshot.connected) {
      this.emit({ pttActive: true, stage: 'listening', detail: 'Inputting...' });
      return;
    }
    if (!room) return;
    await this.publishControl({ action: 'ptt_down' });
    await room.localParticipant.setMicrophoneEnabled(true);
    this.emit({ pttActive: true, stage: 'listening', detail: 'Inputting...' });
  }

  async stopPtt() {
    if (!this.snapshot.pttMode) return;
    const room = this.roomLease.current();
    if (!room && this.snapshot.connected) {
      this.emit({ pttActive: false, stage: 'listening', detail: 'Standby (PTT)' });
      return;
    }
    if (!room) return;
    await this.publishControl({ action: 'ptt_up' });
    await room.localParticipant.setMicrophoneEnabled(false);
    this.emit({ pttActive: false, stage: 'listening', detail: 'Standby (PTT)' });
  }

  async setVoiceSpeed(speed: number | null) {
    const normalized = speed === null
      ? null
      : normalizeVoiceSpeed(speed);
    if (speed !== null && !Number.isFinite(speed)) return;

    persistVoiceSpeed(normalized);
    this.emit({
      voiceSpeed: normalized ?? 0.9,
      voiceSpeedOverride: normalized !== null,
    });
    await this.publishControl(
      { action: 'set_voice_speed', speed: normalized },
      'voice_settings',
    );
  }

  async enrollLatestSpeakerAsDavid() {
    const speakerId = this.snapshot.enrollableSpeakerId;
    if (!speakerId) return;
    await this.publishControl(
      { action: 'enroll_speaker', speakerId },
      'speaker_enrollment',
    );
  }

  private async connectOnce(attempt: number, generation: number, signal: AbortSignal) {
    this.emit({
      stage: 'health_check',
      connectionStep: 'fetching_token',
      failedStep: null,
      detail: 'Fetching secure room token...',
    });
    const tokenData = await this.fetchToken(signal);
    if (!this.roomLease.isCurrentGeneration(generation)) throw new Error('Connection cancelled');

    if (tokenData.serverUrl.startsWith('mock://')) {
      this.connectMockRoom();
      return;
    }

    const room = new Room({ adaptiveStream: false, dynacast: false });
    if (!this.roomLease.attach(generation, room)) {
      await room.disconnect(true).catch(() => {});
      throw new Error('Connection cancelled');
    }

    this.installRoomHandlers(room, generation);
    this.emit({
      stage: 'connecting',
      connectionStep: 'joining_room',
      detail: `Joining LiveKit room... (${attempt}/${config.maxRetries})`,
    });

    await room.connect(tokenData.serverUrl, tokenData.token, {
      autoSubscribe: true,
      peerConnectionTimeout: config.peerConnectionTimeoutMs,
      websocketTimeout: config.websocketTimeoutMs,
    });
    if (!this.roomLease.isCurrent(generation, room)) throw new Error('Connection cancelled');
    await room.startAudio();

    this.emit({
      stage: 'mic_init',
      connectionStep: 'audio_ready',
      detail: 'Publishing microphone audio...',
    });
    // Use LiveKit's microphone lifecycle, exactly as VoiceBridge prod does.
    // This publishes a microphone-sourced track before readiness is signalled.
    await room.localParticipant.setMicrophoneEnabled(true, {
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
    });
    if (this.snapshot.pttMode) {
      // Readiness requires a real published microphone track. Publish it once,
      // then mute it for PTT; disabling before first publication leaves the
      // worker waiting forever for audio readiness.
      await room.localParticipant.setMicrophoneEnabled(false);
    }

    // A saved PRISM setting must reach the worker before readiness triggers
    // Samantha's first turn, otherwise the first audible reply uses 0.9x.
    if (this.snapshot.voiceSpeedOverride) {
      await this.publishControl(
        { action: 'set_voice_speed', speed: this.snapshot.voiceSpeed },
        'voice_settings',
      );
    }

    await this.requestWakeLock();
    this.emit({
      stage: 'handshake',
      connectionStep: 'connected_ready',
      detail: 'Audio ready; checking Samantha...',
    });
    await this.handshakeWithWorker(room, generation);

    if (this.roomLease.isCurrent(generation, room)) {
      this.emit({
        connected: true,
        connecting: false,
        stage: 'listening',
        connectionStep: 'connected_ready',
        failedStep: null,
        detail: this.snapshot.pttMode ? 'Standby (PTT)' : 'Listening',
      });
    }
  }

  private async fetchToken(signal: AbortSignal): Promise<TokenResponse> {
    // VoiceBridge owns the supported room and identity. Match the standalone
    // client contract: request a fresh credential from the bare endpoint.
    const response = await fetch(config.tokenEndpoint, {
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!response.ok) {
      const retryable = response.status >= 500 || response.status === 408 || response.status === 429;
      throw new VoiceConnectionError(
        `Voice sign-in failed (${response.status}). Check the configured voice endpoint and Tailscale connection.`,
        retryable,
      );
    }

    const data = await response.json();
    const serverUrl = data.serverUrl || config.livekitUrl;
    if (!data.token || !serverUrl) throw new Error('Token response missing LiveKit connection details');
    return { ...data, serverUrl };
  }

  private installRoomHandlers(room: Room, generation: number) {
    room.on(RoomEvent.Reconnecting, () => {
      if (!this.roomLease.isCurrent(generation, room)) return;
      this.emit({
        connected: false,
        connecting: true,
        stage: 'connecting',
        connectionStep: 'joining_room',
        failedStep: null,
        detail: 'Connection interrupted; recovering...',
        agentSpeaking: false,
      });
    });

    room.on(RoomEvent.Reconnected, () => {
      this.beginRecoveryHandshake(room, generation, 'Connection restored; checking Samantha...');
    });

    room.on(RoomEvent.ParticipantConnected, (participant) => {
      if (participant.identity !== 'samantha' || !this.snapshot.connected) return;
      // The handset can remain in LiveKit while the worker process restarts.
      // Replay client-owned settings before re-readiness so the replacement
      // worker cannot silently fall back to its default first-turn speed.
      this.beginRecoveryHandshake(room, generation, 'Samantha rejoined; restoring controls...');
    });

    room.on(RoomEvent.Disconnected, () => {
      if (!this.roomLease.release(room)) return;
      void this.cleanupRoom(null);
      this.emit({
        connected: false,
        connecting: false,
        stage: 'idle',
        connectionStep: null,
        failedStep: null,
        detail: '',
        agentSpeaking: false,
        enrollableSpeakerId: null,
      });
    });

    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (!this.roomLease.isCurrent(generation, room) || track.kind !== Track.Kind.Audio) return;
      const element = track.attach();
      element.autoplay = true;
      element.style.display = 'none';
      const observeAudioDelivery = () => {
        if (!this.roomLease.isCurrent(generation, room)) return;
        // A live media element's clock advances through silence, so it cannot
        // truthfully indicate that Samantha is speaking. ActiveSpeakersChanged
        // owns that UI state; this callback only completes delivery evidence.
        if (!this.snapshot.agentSpeaking) return;
        this.lastAssistantAudioAt = Date.now();
        void this.publishAudioObservation();
      };
      element.addEventListener('playing', observeAudioDelivery);
      element.addEventListener('timeupdate', observeAudioDelivery);
      document.body.appendChild(element);
      this.remoteAudioElements.add(element);
    });

    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      if (!this.roomLease.isCurrent(generation, room)) return;
      track.detach().forEach((element) => {
        element.remove();
        this.remoteAudioElements.delete(element);
      });
      this.lastAssistantAudioAt = 0;
      this.emit({ agentSpeaking: false, stage: 'listening', detail: 'Listening' });
    });

    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      if (!this.roomLease.isCurrent(generation, room)) return;
      const agentSpeaking = speakers.some((participant) => participant.identity !== room.localParticipant.identity);
      const userSpeaking = speakers.some((participant) => participant.identity === room.localParticipant.identity);

      if (agentSpeaking) {
        this.lastAssistantAudioAt = Date.now();
        this.emit({ agentSpeaking: true, stage: 'speaking', detail: 'Samantha is speaking' });
        void this.publishAudioObservation();
      } else if (userSpeaking) {
        this.emit({ agentSpeaking: false, stage: 'listening', detail: 'Inputting...' });
      } else if (this.snapshot.connected) {
        this.emit({
          agentSpeaking: false,
          stage: 'listening',
          detail: this.snapshot.pttMode ? 'Standby (PTT)' : 'Listening',
        });
      }
    });

    room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
      if (!this.roomLease.isCurrent(generation, room)) return;
      const isLocalUser = participant?.identity === room.localParticipant.identity;
      const hasFinalUserSpeech = isLocalUser && segments.some((segment) => segment.final);
      if (hasFinalUserSpeech) {
        this.emit({ error: null, agentSpeaking: false, stage: 'thinking', detail: 'Thinking' });
      }
    });

    room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
      if (!this.roomLease.isCurrent(generation, room)) return;
      const event = decodeVoiceDataEvent(topic, payload);
      if (!event) return;

      if (event.kind === 'warming') {
        this.emit({
          stage: 'handshake',
          connectionStep: 'connected_ready',
          detail: 'Samantha connected; waiting for audio readiness...',
        });
        return;
      }
      if (event.kind === 'ready') {
        this.emit({
          stage: 'waiting',
          connectionStep: 'connected_ready',
          detail: 'Connected and ready; finalising controls...',
        });
        return;
      }
      if (event.kind === 'error') {
        this.emit({ stage: 'error', detail: 'Connected; turn failed', error: event.message });
        return;
      }
      if (event.kind === 'enrollment') {
        if (event.status === 'enrolled') {
          this.emit({
            enrollableSpeakerId: null,
            error: null,
            stage: 'listening',
            detail: 'David enrolled for this voice session',
          });
        } else {
          this.emit({
            error: 'Speaker enrolment was rejected. Wait for a current unknown speaker label and try again.',
          });
        }
        return;
      }
      if (event.kind === 'settings') {
        persistVoiceSpeed(event.overrideActive ? event.speed : null);
        this.emit({
          voiceSpeed: event.speed,
          voiceSpeedOverride: event.overrideActive,
        });
        return;
      }

      if (event.speaker === 'you') {
        this.emit({ error: null, agentSpeaking: false, stage: 'thinking', detail: 'Thinking' });
      }
      if (event.deliveryId) {
        this.pendingDeliveryId = event.deliveryId;
        void this.publishAudioObservation();
      }
      if (event.speaker === 'unknown' && event.speakerId) {
        this.emit({ enrollableSpeakerId: event.speakerId });
      }
      this.mergeSubtitle({
        id: event.deliveryId || `raw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: event.text,
        timestamp: Date.now(),
        speaker: event.speaker,
      });
    });
  }

  private async handshakeWithWorker(room: Room, generation: number) {
    this.emit({
      stage: 'handshake',
      connectionStep: 'connected_ready',
      detail: 'Audio ready; waiting for Samantha...',
    });
    let ready = false;
    let resolveReady: (() => void) | null = null;
    const readyAcknowledgement = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    const onAck = (payload: Uint8Array, _participant?: unknown, _kind?: unknown, topic?: string) => {
      const event = decodeVoiceDataEvent(topic, payload);
      if (event?.kind === 'ready') {
        ready = true;
        resolveReady?.();
      }
    };
    room.on(RoomEvent.DataReceived, onAck);

    try {
      for (let attempt = 1; attempt <= config.handshakeAttempts; attempt += 1) {
        if (ready || !this.roomLease.isCurrent(generation, room)) break;
        this.emit({
          stage: 'handshake',
          connectionStep: 'connected_ready',
          detail: `Audio ready; waiting for Samantha... (${attempt}/${config.handshakeAttempts})`,
        });
        await room.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify({ action: 'connected_and_ready' })),
          { reliable: true },
        );
        await Promise.race([readyAcknowledgement, wait(config.handshakeIntervalMs)]);
      }
    } finally {
      room.off(RoomEvent.DataReceived, onAck);
    }

    if (!ready && this.roomLease.isCurrent(generation, room)) {
      throw new Error('Agent readiness timed out. Check the voice worker and reconnect.');
    }
  }

  private beginRecoveryHandshake(room: Room, generation: number, detail: string) {
    if (!this.roomLease.isCurrent(generation, room) || this.reconnectHandshake) return;
    this.emit({
      stage: 'handshake',
      connectionStep: 'connected_ready',
      detail,
    });
    this.reconnectHandshake = (async () => {
      await room.startAudio();
      if (this.snapshot.voiceSpeedOverride) {
        await this.publishControl(
          { action: 'set_voice_speed', speed: this.snapshot.voiceSpeed },
          'voice_settings',
        );
      }
      await this.handshakeWithWorker(room, generation);
      if (!this.roomLease.isCurrent(generation, room)) return;
      this.emit({
        connected: true,
        connecting: false,
        stage: 'listening',
        connectionStep: 'connected_ready',
        failedStep: null,
        detail: this.snapshot.pttMode ? 'Standby (PTT)' : 'Listening',
      });
    })().catch((error) => {
      if (!this.roomLease.isCurrent(generation, room)) return;
      this.emit({
        connected: false,
        connecting: false,
        stage: 'error',
        connectionStep: 'connected_ready',
        failedStep: 'connected_ready',
        detail: 'Agent unavailable after reconnect',
        error: error instanceof Error ? error.message : 'Agent readiness failed after reconnect',
      });
      room.disconnect().catch(() => {});
    }).finally(() => {
      this.reconnectHandshake = null;
    });
  }

  private async publishControl(payload: Record<string, unknown>, topic?: string) {
    const room = this.roomLease.current();
    if (!room) return;
    try {
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(payload)),
        topic ? { reliable: true, topic } : { reliable: true },
      );
    } catch (error) {
      console.warn('[VoiceBridge] Failed to publish control event', error);
    }
  }

  private async publishAudioObservation() {
    const room = this.roomLease.current();
    const deliveryId = this.pendingDeliveryId;
    if (!room || !deliveryId || Date.now() - this.lastAssistantAudioAt > 750) return;

    this.pendingDeliveryId = null;
    try {
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ action: 'assistant_audio_observed', deliveryId })),
        { reliable: true, topic: 'delivery_ack' },
      );
    } catch (error) {
      if (this.pendingDeliveryId === null) this.pendingDeliveryId = deliveryId;
      console.warn('[VoiceBridge] Failed to publish audio observation', error);
    }
  }

  private async applyMicMode(room = this.roomLease.current()) {
    if (!room) return;
    await room.localParticipant.setMicrophoneEnabled(!this.snapshot.pttMode);
  }

  private async requestWakeLock() {
    try {
      if ('wakeLock' in navigator) this.wakeLock = await navigator.wakeLock.request('screen');
    } catch {
      this.wakeLock = null;
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
      connectionStep: 'connected_ready',
      failedStep: null,
      detail: this.snapshot.pttMode ? 'Standby (PTT)' : 'Listening',
      error: null,
      enrollableSpeakerId: null,
      subtitles: [{
        id: 'mock-ready',
        text: 'Connected to voice bridge test adapter.',
        timestamp: Date.now(),
        speaker: 'system',
      }, {
        id: 'mock-samantha',
        text: 'Samantha subtitle colour sample.',
        timestamp: Date.now() + 1,
        speaker: 'samantha',
      }, {
        id: 'mock-you',
        text: 'User subtitle colour sample.',
        timestamp: Date.now() + 2,
        speaker: 'you',
      }],
    });
  }

  private async cleanupGeneration(generation: number) {
    const room = this.roomLease.current();
    if (!this.roomLease.cancel(generation)) return;
    // VoiceBridge prod keeps its foreground/audio lifecycle alive while a
    // bounded room rejoin cycle is still in progress.
    await this.cleanupRoom(room, false);
  }

  private async cleanupRoom(room: Room | null, stopService = true) {
    this.pendingDeliveryId = null;
    this.lastAssistantAudioAt = 0;
    this.reconnectHandshake = null;

    this.remoteAudioElements.forEach((element) => element.remove());
    this.remoteAudioElements.clear();

    if (this.wakeLock) {
      await this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
    if (room) await room.disconnect(true).catch(() => {});
    if (stopService) {
      await stopVoiceService();
      await stopVoiceAudioRoute();
    }
  }
}

export const createVoiceBridge = (): VoiceBridgeAdapter => new LiveKitVoiceBridgeAdapter();
