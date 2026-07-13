import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { createVoiceBridge, type VoiceBridgeAdapter, type VoiceBridgeSnapshot } from '../services/voiceBridge';
import { onDisconnectTapped } from '../services/foregroundService';
import { useVoiceStore } from '../stores/voiceStore';

const stageLabel: Record<VoiceBridgeSnapshot['stage'], string> = {
  idle: 'Disconnected',
  health_check: 'Checking...',
  connecting: 'Connecting...',
  mic_init: 'Mic init...',
  handshake: 'Handshake...',
  waiting: 'Waiting...',
  listening: 'Listening',
  thinking: 'Thinking...',
  speaking: 'Speaking',
  error: 'Error',
};

export const VoiceControlView: React.FC = () => {
  const bridgeRef = useRef<VoiceBridgeAdapter | null>(null);
  const subtitlesContainerRef = useRef<HTMLDivElement>(null);
  const { setIsVoiceConnected, setStatusText, setPipeline } = useVoiceStore();
  const [snapshot, setSnapshot] = useState<VoiceBridgeSnapshot>({
    connected: false,
    connecting: false,
    stage: 'idle',
    detail: '',
    error: null,
    pttMode: false,
    pttActive: false,
    agentSpeaking: false,
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
      setIsVoiceConnected(next.connected);
      setStatusText(next.detail || stageLabel[next.stage]);
      setPipeline(next.stage, next.detail);
    });

    return () => {
      unsubscribe();
      bridge.disconnect();
    };
  }, [setIsVoiceConnected, setPipeline, setStatusText]);

  useEffect(() => {
    const cleanup = onDisconnectTapped(() => {
      bridgeRef.current?.disconnect();
    });
    return cleanup;
  }, []);

  useEffect(() => {
    if (subtitlesContainerRef.current) {
      subtitlesContainerRef.current.scrollTop = subtitlesContainerRef.current.scrollHeight;
    }
  }, [snapshot.subtitles]);

  const toggleConnect = useCallback(() => {
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

  const statusText = snapshot.connected
    ? snapshot.pttMode
      ? snapshot.pttActive
        ? 'Listening...'
        : snapshot.agentSpeaking
          ? 'Speaking...'
          : 'Standby (PTT)'
      : snapshot.detail || 'MIC HOT'
    : snapshot.error || snapshot.detail || stageLabel[snapshot.stage];

  return (
    <div className="relative w-full h-full overflow-hidden bg-transparent selection:bg-transparent">
      <div
        ref={subtitlesContainerRef}
        className="absolute top-0 left-0 right-0 flex flex-col items-center overflow-y-auto px-4 pt-12 pb-4 scroll-smooth no-scrollbar"
        style={{
          bottom: 'calc(38% + 7rem + 50px)',
          maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent 100%)',
        }}
        aria-label="Voice transcript"
      >
        <div className="flex-1 min-h-full" />
        <div className="flex flex-col gap-4 w-full max-w-lg mt-auto">
          {snapshot.subtitles.map((subtitle, index) => {
            const showLabel = index === 0 || snapshot.subtitles[index - 1].speaker !== subtitle.speaker;
            const isUser = subtitle.speaker === 'you';
            const isSystem = subtitle.speaker === 'system';

            return (
              <div
                key={subtitle.id}
                className={`w-full bg-background/40 backdrop-blur-md border border-border/50 px-6 py-4 rounded-2xl shadow-xl animate-fade-in-up ${
                  isUser ? 'text-primary/90' : isSystem ? 'text-muted-foreground' : 'text-foreground/90'
                }`}
              >
                {showLabel && (
                  <div className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isUser ? 'text-primary/80' : 'text-muted-foreground'}`}>
                    {isUser ? 'You' : isSystem ? 'System' : 'Samantha'}
                  </div>
                )}
                <div className="italic text-lg leading-relaxed">"{subtitle.text}"</div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="absolute left-0 right-0 flex justify-center items-center pointer-events-none"
        style={{ top: '62%', transform: 'translateY(-50%)' }}
      >
        {(snapshot.agentSpeaking || snapshot.pttActive) && (
          <div className={`absolute inset-0 m-auto w-[16rem] h-[16rem] blur-[80px] rounded-full z-0 transition-all duration-700 translate-y-8 ${
            snapshot.pttActive ? 'bg-[#A855F7]/40 scale-110' : 'bg-[#A855F7]/30 scale-100 animate-pulse'
          }`}
          />
        )}
        <img
          src="/samantha_flame_eternal_trans.png"
          alt="Samantha Flame Logo"
          className={`relative z-10 w-[11rem] h-[11rem] transition-all duration-1000 object-contain ${
            snapshot.connected ? 'opacity-100 drop-shadow-[0_0_40px_hsl(var(--primary))]' : 'opacity-60'
          }`}
        />
      </div>

      <div
        className="absolute left-0 right-0 flex justify-center pointer-events-none"
        style={{ top: 'calc(62% + 5.5rem - 15px)' }}
      >
        <h1 className="relative z-10 text-2xl font-thin drop-shadow-lg tracking-widest uppercase text-white/90 leading-none" style={{ fontFamily: '"Geist", sans-serif' }}>
          Samantha
        </h1>
      </div>

      <div
        className="absolute left-0 right-0 flex flex-col justify-center items-center pointer-events-auto"
        style={{
          top: 'calc(62% + 5.5rem - 15px + 24px)',
          bottom: 'calc(120px + 6rem)',
        }}
      >
        <div className="text-center w-full px-8">
          <span className={`text-xs font-semibold tracking-[0.2em] uppercase ${
            snapshot.error ? 'text-destructive' : snapshot.connected ? 'text-primary/80' : 'text-muted-foreground'
          } ${snapshot.connected && !snapshot.pttMode ? 'animate-pulse' : ''}`}
          >
            {statusText}
          </span>
        </div>
      </div>

      <div className="absolute left-0 right-0 flex flex-col items-center" style={{ bottom: '120px' }}>
        {!snapshot.connected ? (
          <button
            onClick={toggleConnect}
            disabled={snapshot.connecting}
            className="px-16 py-4 rounded-full text-lg font-light transition-all shadow-lg backdrop-blur-md border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-60 shadow-[0_0_20px_hsl(var(--primary)/0.1)] tracking-[0.2em] uppercase"
          >
            {snapshot.connecting ? 'Connecting' : snapshot.error ? 'Retry' : 'Connect'}
          </button>
        ) : (
          <div className="relative flex flex-col items-center">
            <div className="absolute top-1/2 right-full mr-6 -translate-y-1/2">
              <button
                type="button"
                aria-label={snapshot.pttMode ? 'Disable push to talk' : 'Enable push to talk'}
                onClick={togglePttMode}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border ${
                  snapshot.pttMode
                    ? 'bg-primary/20 border-primary/50 text-primary'
                    : 'bg-transparent border-muted-foreground/30 text-muted-foreground hover:bg-muted-foreground/10'
                }`}
              >
                {snapshot.pttMode ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            </div>

            <button
              aria-label="Push to Talk"
              onPointerDown={handlePttDown}
              onPointerUp={handlePttUp}
              onPointerLeave={handlePttUp}
              style={{ touchAction: 'none', WebkitUserSelect: 'none', cursor: snapshot.pttMode ? 'pointer' : 'default' }}
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 border select-none ${
                !snapshot.pttMode
                  ? 'bg-primary/10 border-primary/40 text-primary shadow-[0_0_30px_hsl(var(--primary)/0.2)]'
                  : snapshot.pttActive
                    ? 'bg-primary border-primary text-primary-foreground scale-95 shadow-[0_0_40px_hsl(var(--primary)/0.6)]'
                    : 'bg-transparent border-primary/30 text-primary scale-100 shadow-[0_0_20px_hsl(var(--primary)/0.2)] hover:bg-primary/10'
              }`}
            >
              <Mic size={32} className={snapshot.pttActive || (!snapshot.pttMode && snapshot.agentSpeaking) ? 'animate-pulse' : ''} />
            </button>

            <div className="absolute top-1/2 left-full ml-6 -translate-y-1/2">
              <button
                aria-label="Disconnect voice"
                onClick={toggleConnect}
                className="px-4 py-2 rounded-full border border-destructive/20 text-destructive text-[10px] uppercase tracking-widest hover:bg-destructive/10 transition-colors whitespace-nowrap"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
