import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AudioLines, ChevronDown, Mic, MicOff, PhoneOff } from 'lucide-react';
import {
  createVoiceBridge,
  type VoiceBridgeAdapter,
  type VoiceBridgeSnapshot,
  type VoiceConnectionStep,
  type VoiceSubtitle,
} from '../services/voiceBridge';
import { onDisconnectTapped } from '../services/foregroundService';
import { useVoiceStore } from '../stores/voiceStore';

const stageLabel: Record<VoiceBridgeSnapshot['stage'], string> = {
  idle: 'Disconnected',
  health_check: 'Initializing',
  connecting: 'Connecting',
  mic_init: 'Audio ready',
  handshake: 'Connected',
  waiting: 'Ready',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  error: 'Error',
};

const connectionStepLabel: Record<VoiceConnectionStep, string> = {
  initialising: 'Initializing',
  fetching_token: 'Fetching token',
  joining_room: 'Joining room',
  audio_ready: 'Audio ready',
  connected_ready: 'Ready',
};

type SubtitleGroup = {
  id: string;
  speaker: VoiceSubtitle['speaker'];
  lines: string[];
};

export const VoiceControlView: React.FC = () => {
  const bridgeRef = useRef<VoiceBridgeAdapter | null>(null);
  const subtitlesContainerRef = useRef<HTMLDivElement>(null);
  const speedHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speedHoldActivatedRef = useRef(false);
  const { setIsVoiceConnected, setStatusText, setPipeline } = useVoiceStore();
  const [speedEditorOpen, setSpeedEditorOpen] = useState(false);
  const [followLatestSubtitle, setFollowLatestSubtitle] = useState(true);
  const [logoDimmed, setLogoDimmed] = useState(false);
  const [snapshot, setSnapshot] = useState<VoiceBridgeSnapshot>({
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
  });

  if (bridgeRef.current === null) {
    bridgeRef.current = createVoiceBridge();
  }

  useEffect(() => {
    const bridge = bridgeRef.current;
    if (!bridge) return;

    const unsubscribe = bridge.subscribe((next) => {
      setSnapshot(next);
      if (next.connected) setLogoDimmed(true);
      if (!next.connected) setSpeedEditorOpen(false);
      setIsVoiceConnected(next.connected);
      setStatusText(next.detail || stageLabel[next.stage]);
      setPipeline(next.stage, next.detail);
    });

    return () => {
      unsubscribe();
      bridge.disconnect();
    };
  }, [setIsVoiceConnected, setPipeline, setStatusText]);

  useEffect(() => onDisconnectTapped(() => {
    bridgeRef.current?.disconnect();
  }), []);

  useEffect(() => {
    const container = subtitlesContainerRef.current;
    if (!container || snapshot.subtitles.length === 0) return;
    if (followLatestSubtitle) container.scrollTop = container.scrollHeight;
  }, [followLatestSubtitle, snapshot.subtitles]);

  useEffect(() => () => {
    if (speedHoldTimerRef.current) clearTimeout(speedHoldTimerRef.current);
  }, []);

  const toggleConnect = useCallback(() => {
    setFollowLatestSubtitle(true);
    if (snapshot.connected || snapshot.connecting) {
      bridgeRef.current?.disconnect();
    } else {
      bridgeRef.current?.connect({ pttMode: snapshot.pttMode });
    }
  }, [snapshot.connected, snapshot.connecting, snapshot.pttMode]);

  const togglePttMode = useCallback(() => {
    bridgeRef.current?.setPttMode(!snapshot.pttMode);
  }, [snapshot.pttMode]);

  const handlePttDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.cancelable) event.preventDefault();
    bridgeRef.current?.startPtt();
  }, []);

  const handlePttUp = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.cancelable) event.preventDefault();
    bridgeRef.current?.stopPtt();
  }, []);

  const enrollLatestSpeakerAsDavid = useCallback(() => {
    bridgeRef.current?.enrollLatestSpeakerAsDavid();
  }, []);

  const setVoiceSpeed = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    bridgeRef.current?.setVoiceSpeed(Number(event.target.value));
  }, []);

  const resetVoiceSpeed = useCallback(() => {
    setSpeedEditorOpen(false);
    bridgeRef.current?.setVoiceSpeed(null);
  }, []);

  const beginSpeedHold = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.cancelable) event.preventDefault();
    speedHoldActivatedRef.current = false;
    speedHoldTimerRef.current = setTimeout(() => {
      speedHoldActivatedRef.current = true;
      setSpeedEditorOpen(true);
    }, 450);
  }, []);

  const finishSpeedHold = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.cancelable) event.preventDefault();
    if (speedHoldTimerRef.current) clearTimeout(speedHoldTimerRef.current);
    speedHoldTimerRef.current = null;
    if (!speedHoldActivatedRef.current) resetVoiceSpeed();
  }, [resetVoiceSpeed]);

  const cancelSpeedHold = useCallback(() => {
    if (speedHoldTimerRef.current) clearTimeout(speedHoldTimerRef.current);
    speedHoldTimerRef.current = null;
  }, []);

  const pauseSubtitleFollow = useCallback(() => {
    const container = subtitlesContainerRef.current;
    if (container && container.scrollHeight > container.clientHeight + 1) {
      setFollowLatestSubtitle(false);
    }
  }, []);

  const handleSubtitleScroll = useCallback(() => {
    const container = subtitlesContainerRef.current;
    if (!container || !followLatestSubtitle) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom > 24) setFollowLatestSubtitle(false);
  }, [followLatestSubtitle]);

  const resumeSubtitleFollow = useCallback(() => {
    setFollowLatestSubtitle(true);
    requestAnimationFrame(() => {
      const container = subtitlesContainerRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    });
  }, []);

  const statusText = (() => {
    if (snapshot.error) return 'Error';
    if (snapshot.connected) {
      if (snapshot.agentSpeaking) return 'Speaking';
      if (snapshot.stage === 'thinking') return 'Thinking';
      if (snapshot.pttMode) return snapshot.pttActive ? 'Listening' : 'Standby';
      return 'Listening';
    }
    if (snapshot.stage === 'health_check') {
      return snapshot.connectionStep === 'fetching_token' ? 'Fetching token' : 'Initializing';
    }
    if (snapshot.stage === 'connecting') return 'Joining room';
    if (snapshot.stage === 'mic_init') return 'Audio ready';
    if (snapshot.stage === 'handshake') return 'Connected';
    if (snapshot.stage === 'waiting') return 'Ready';
    if (snapshot.connectionStep) return connectionStepLabel[snapshot.connectionStep];
    return stageLabel[snapshot.stage];
  })();

  const statusTone = snapshot.error
    ? 'text-red-400'
    : statusText === 'Speaking'
      ? 'text-primary'
      : statusText === 'Listening' || statusText === 'Connected' || statusText === 'Ready'
        ? 'text-emerald-300'
        : snapshot.connecting
          ? 'text-amber-300'
          : 'text-primary/75';

  const subtitleGroups = snapshot.subtitles.reduce<SubtitleGroup[]>((groups, subtitle) => {
    const last = groups[groups.length - 1];
    if (last && last.speaker === subtitle.speaker) {
      last.lines.push(subtitle.text);
    } else {
      groups.push({ id: subtitle.id, speaker: subtitle.speaker, lines: [subtitle.text] });
    }
    return groups;
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-transparent selection:bg-transparent">
      <div
        data-testid="samantha-lockup"
        className="pointer-events-none absolute left-1/2 z-0 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-opacity duration-1000"
        style={{
          top: 'calc(50% - 108px)',
          opacity: logoDimmed ? 0.2 : 1,
        }}
        aria-hidden="true"
      >
        {(snapshot.agentSpeaking || snapshot.pttActive) && (
          <div className={`absolute top-1/2 h-64 w-64 -translate-y-1/2 rounded-full blur-[80px] transition-all duration-700 ${
            snapshot.pttActive ? 'scale-110 bg-primary/40' : 'animate-pulse bg-primary/30'
          }`} />
        )}
        <img
          src="/samantha_flame_eternal_trans.png"
          alt=""
          className="relative h-44 w-44 object-contain drop-shadow-[0_0_38px_hsl(var(--primary)/0.55)]"
        />
        <h1
          className="relative -mt-4 text-2xl font-thin uppercase leading-none tracking-[0.24em] text-white/90"
          style={{ fontFamily: '"Geist", sans-serif' }}
        >
          Samantha
        </h1>
      </div>

      <div
        ref={subtitlesContainerRef}
        onScroll={handleSubtitleScroll}
        onTouchMove={pauseSubtitleFollow}
        onWheel={pauseSubtitleFollow}
        className="no-scrollbar absolute inset-x-0 top-0 z-10 flex flex-col items-center overflow-y-auto px-4 pb-0 pt-14"
        style={{
          bottom: '168px',
          maskImage: 'linear-gradient(to bottom, transparent, black 10%, black 69%, transparent calc(100% - 64px), transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 10%, black 69%, transparent calc(100% - 64px), transparent 100%)',
        }}
        aria-label="Voice transcript"
      >
        <div className="min-h-full flex-1" />
        <div className="mt-auto flex w-full max-w-lg flex-col gap-3">
          {subtitleGroups.map((group) => {
            const isUser = group.speaker === 'you';
            const isSystem = group.speaker === 'system';
            const isSamantha = group.speaker === 'samantha';
            const label = isUser
              ? 'You'
              : group.speaker === 'samantha'
                ? 'Samantha'
                : group.speaker.charAt(0).toUpperCase() + group.speaker.slice(1);

            return (
              <div
                key={group.id}
                data-testid="subtitle-turn"
                className={`w-full animate-fade-in-up rounded-2xl border border-primary/10 bg-background/30 px-5 py-3.5 shadow-xl backdrop-blur-sm ${
                  isSamantha ? 'text-primary/90' : isSystem ? 'text-muted-foreground' : 'text-foreground/90'
                }`}
              >
                <div className={`mb-2 text-xs font-semibold uppercase tracking-wider ${
                  isSamantha ? 'text-primary/80' : isUser ? 'text-foreground/80' : 'text-muted-foreground'
                }`}>
                  {label}
                </div>
                <div className="space-y-2 text-[17px] italic leading-relaxed">
                  {group.lines.map((line, index) => <p key={`${group.id}-${index}`}>{line}</p>)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!followLatestSubtitle && snapshot.subtitles.length > 0 && (
        <button
          type="button"
          aria-label="Jump to latest subtitles"
          onClick={resumeSubtitleFollow}
          className="absolute left-1/2 z-20 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-white/15 bg-background/55 text-white/60 shadow-lg backdrop-blur-md transition-colors hover:border-primary/40 hover:text-primary"
          style={{ bottom: '232px' }}
        >
          <ChevronDown size={16} strokeWidth={1.5} />
        </button>
      )}

      <div
        data-testid="voice-readout-row"
        className="pointer-events-none absolute inset-x-0 z-40 h-11"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div
          role="status"
          aria-label="Voice status"
          className={`absolute inset-0 flex items-end justify-center pb-[5px] whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.24em] ${statusTone}`}
        >
          <span data-testid="voice-status-text">{statusText}</span>
        </div>

        {snapshot.connected && <div className="pointer-events-auto absolute inset-y-0 left-4 flex items-end">
          {speedEditorOpen && (
            <div className="absolute bottom-full left-0 mb-3 flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-background/80 px-3 py-3 shadow-2xl backdrop-blur-xl">
              <span className="text-[10px] text-white">{snapshot.voiceSpeed.toFixed(2)}×</span>
              <input
                aria-label="Samantha voice speed"
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                value={snapshot.voiceSpeed}
                onChange={setVoiceSpeed}
                className="h-40 w-5 accent-primary"
                style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
              />
            </div>
          )}
          <button
            type="button"
            aria-label={`Voice speed ${snapshot.voiceSpeed.toFixed(2)} times, ${snapshot.voiceSpeedOverride ? 'fixed' : 'automatic'}`}
            onPointerDown={beginSpeedHold}
            onPointerUp={finishSpeedHold}
            onPointerCancel={cancelSpeedHold}
            onContextMenu={(event) => event.preventDefault()}
            className={`flex h-11 min-w-20 select-none items-end pb-[5px] text-[10px] font-medium uppercase tracking-[0.16em] transition-colors ${
              snapshot.voiceSpeedOverride || speedEditorOpen ? 'text-white' : 'text-primary'
            }`}
            style={{ touchAction: 'none' }}
          >
            <span data-testid="voice-speed-text">{snapshot.voiceSpeed.toFixed(2)}×</span>
          </button>
        </div>}
      </div>

      <div className="absolute inset-x-0 z-30 flex flex-col items-center" style={{ bottom: '120px' }}>
        {snapshot.connected && snapshot.enrollableSpeakerId && (
          <button
            type="button"
            onClick={enrollLatestSpeakerAsDavid}
            aria-label={`Enrol speaker ${snapshot.enrollableSpeakerId} as David for this session`}
            className="mb-4 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-xs uppercase tracking-widest text-primary"
          >
            This is David · {snapshot.enrollableSpeakerId}
          </button>
        )}

        {snapshot.error && !snapshot.connecting && (
          <div role="alert" className="mb-4 max-w-[min(28rem,calc(100vw-2rem))] px-4 text-center text-xs text-red-300">
            {snapshot.error}
          </div>
        )}

        {!snapshot.connected ? (
          <button
            aria-label={snapshot.connecting ? 'Cancel' : snapshot.error ? 'Retry' : 'Connect'}
            onClick={toggleConnect}
            className="flex h-24 w-24 items-center justify-center rounded-full border border-primary/50 bg-primary/10 text-primary shadow-[0_0_28px_hsl(var(--primary)/0.25)] backdrop-blur-md transition-all hover:bg-primary/20"
          >
            <AudioLines
              size={32}
              strokeWidth={1.5}
              className={snapshot.connecting ? 'animate-pulse' : ''}
            />
          </button>
        ) : (
          <div className="relative flex items-center justify-center">
            {snapshot.pttMode ? (
              <button
                aria-label="Push to Talk"
                onPointerDown={handlePttDown}
                onPointerUp={handlePttUp}
                onPointerLeave={handlePttUp}
                className={`flex h-24 w-24 select-none items-center justify-center rounded-full border transition-all duration-200 ${
                  snapshot.pttActive
                    ? 'scale-95 border-white bg-primary text-white shadow-[0_0_42px_hsl(var(--primary)/0.65)]'
                    : 'border-primary/50 bg-primary/10 text-primary shadow-[0_0_28px_hsl(var(--primary)/0.25)]'
                }`}
                style={{ touchAction: 'none', WebkitUserSelect: 'none' }}
              >
                <Mic size={32} className={snapshot.pttActive ? 'animate-pulse' : ''} />
              </button>
            ) : (
              <button
                aria-label="Disconnect voice"
                onClick={toggleConnect}
                className="flex h-24 w-24 items-center justify-center rounded-full border border-primary/50 bg-primary/10 text-primary shadow-[0_0_28px_hsl(var(--primary)/0.25)] transition-all hover:bg-primary/20"
              >
                <PhoneOff size={30} strokeWidth={1.5} />
              </button>
            )}

            <button
              type="button"
              aria-label={snapshot.pttMode ? 'Disable push to talk' : 'Enable push to talk'}
              aria-pressed={snapshot.pttMode}
              onClick={togglePttMode}
              className={`absolute left-full ml-6 flex h-12 w-12 items-center justify-center rounded-full border bg-transparent transition-all ${
                snapshot.pttMode
                  ? 'border-white/60 text-white shadow-[0_0_18px_rgba(255,255,255,0.18)]'
                  : 'border-primary/50 text-primary hover:bg-primary/10'
              }`}
            >
              <MicOff size={19} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
