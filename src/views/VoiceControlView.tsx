import React, { useState, useCallback, useRef, useEffect } from "react";
import { Mic, MicOff } from "lucide-react";
import { useVoiceStore } from '../stores/voiceStore';
import { startVoiceService, stopVoiceService, onDisconnectTapped } from '../services/foregroundService';

const API_BASE = import.meta.env.VITE_API_BASE || '';
if (!API_BASE) console.warn('[Voice] VITE_API_BASE not set — API calls will use relative URLs (only works with Vite dev proxy)');

export const VoiceControlView: React.FC = () => {
  const { isVoiceConnected: connected, setIsVoiceConnected, setStatusText: setGlobalStatusText } = useVoiceStore();
  const [status, setStatus] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPttActive, setIsPttActive] = useState(false);
  const [isPttMode, setIsPttMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const roomRef = useRef<any>(null);
  const wakeLockRef = useRef<any>(null);
  const subtitlesContainerRef = useRef<HTMLDivElement>(null);
  const [subtitles, setSubtitles] = useState<{id: string, text: string, timestamp: number, speaker: "you" | "samantha"}[]>([]);

  // Sync internal status to global store
  useEffect(() => {
    setGlobalStatusText(status);
  }, [status, setGlobalStatusText]);

  // Clear old subtitles
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setSubtitles((prev) => prev.filter((s) => now - s.timestamp < 12000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll subtitles to bottom
  useEffect(() => {
    if (subtitlesContainerRef.current) {
      subtitlesContainerRef.current.scrollTop = subtitlesContainerRef.current.scrollHeight;
    }
  }, [subtitles]);

  // Listen for "Disconnect" tap from Android notification tray
  useEffect(() => {
    const cleanup = onDisconnectTapped(() => {
      if (roomRef.current) {
        roomRef.current.disconnect();
        setIsVoiceConnected(false);
        setStatus("");
        stopVoiceService();
      }
    });
    return cleanup;
  }, [setIsVoiceConnected]);

  // Cleanup room and wake lock on unmount
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, []);

  const toggleConnect = useCallback(async () => {
    if (connected && roomRef.current) {
      roomRef.current.localParticipant?.tracks.forEach((pub: any) => {
        if (pub.track) {
          pub.track.stop();
          roomRef.current.localParticipant.unpublishTrack(pub.track);
        }
      });
      roomRef.current.disconnect();
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
      stopVoiceService();
      setIsVoiceConnected(false);
      setStatus("");
      return;
    }

    setStatus("Getting token...");
    setError(null);

    try {
      const roomName = 'samantha-room';
      const res = await fetch(`${API_BASE}/api/voice/token?voice=kokoro-af_heart&room=${roomName}`);
      if (!res.ok) throw new Error(`Token failed: ${res.status}`);
      const data = await res.json();

      const { Room, createLocalAudioTrack } = await import("livekit-client");

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      room.on("connected", () => {
        setStatus("Connected");
        setIsVoiceConnected(true);
        startVoiceService();
      });

      room.on("disconnected", () => {
        setStatus("");
        setIsVoiceConnected(false);
        stopVoiceService();
      });

      room.on("trackSubscribed", (track: any) => {
        if (track.kind === "audio") {
          setIsSpeaking(true);
          track.attach();
        }
      });

      room.on("trackUnsubscribed", (track: any) => {
        if (track.kind === "audio") {
          track.detach();
          setIsSpeaking(false);
        }
      });

      room.on("transcriptionReceived", (transcriptions: any[]) => {
        setSubtitles((prev) => {
          let updated = [...prev];
          for (const t of transcriptions) {
            const idx = updated.findIndex((s) => s.id === t.id);
            if (idx >= 0) {
              updated[idx].text = t.text;
              updated[idx].timestamp = Date.now();
            } else {
              updated.push({ id: t.id, text: t.text, timestamp: Date.now(), speaker: "samantha" });
            }
          }
          return updated.slice(-10);
        });
      });

      room.on("dataReceived", (payload: any, _participant: any, _kind: any, topic: any) => {
        if (topic === "raw_subtitle") {
          try {
            const str = new TextDecoder().decode(payload);
            const data = JSON.parse(str);
            if (data.text) {
              const trimmed = data.text.trim();
              const isUser = trimmed.startsWith("You:");
              const speaker = isUser ? "you" as const : "samantha" as const;
              const cleanText = isUser ? trimmed.replace(/^You:\s*/, "") : trimmed;
              
              setSubtitles((prev) => {
                const updated = [...prev];
                if (updated.length > 0 && updated[updated.length - 1].speaker === speaker && Date.now() - updated[updated.length - 1].timestamp < 2000) {
                  const last = updated[updated.length - 1];
                  updated[updated.length - 1] = { ...last, text: last.text + " " + cleanText, timestamp: Date.now() };
                } else {
                  updated.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: cleanText, timestamp: Date.now(), speaker });
                }
                return updated.slice(-10);
              });
            }
          } catch (e) {
            console.error("Error parsing raw_subtitle", e);
          }
        }
      });

      await room.connect(data.serverUrl, data.token);
      await room.startAudio();
      roomRef.current = room;

      const mic = await createLocalAudioTrack({
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
      });
      await room.localParticipant.publishTrack(mic);
      
      // Mute based on initial PTT mode
      await room.localParticipant.setMicrophoneEnabled(!isPttMode);
      setIsPttActive(false);

      // Android WebView Keep-Alive Hacks
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        }
      } catch (e) {}

    } catch (err: any) {
      console.error("Connection error:", err);
      setStatus("Failed");
      setError(err.message || "Unknown error");
    }
  }, [connected, setIsVoiceConnected, isPttMode]);

  // Sync mic state when PTT mode is toggled while connected
  useEffect(() => {
    if (connected && roomRef.current?.localParticipant) {
      roomRef.current.localParticipant.setMicrophoneEnabled(!isPttMode);
      setIsPttActive(false); // Reset visual state
    }
  }, [isPttMode, connected]);

  // PTT Handlers
  const handlePttDown = useCallback(async (e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => {
    if (e.type === 'touchstart' && e.cancelable) {
      e.preventDefault();
    }
    if (!isPttMode) return; // In continuous mode, mic is always hot
    if (connected && roomRef.current) {
      await roomRef.current.localParticipant.setMicrophoneEnabled(true);
      setIsPttActive(true);
    }
  }, [connected, isPttMode]);

  const handlePttUp = useCallback(async (e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => {
    if (e.type === 'touchend' && e.cancelable) {
      e.preventDefault();
    }
    if (!isPttMode) return; // In continuous mode, mic is always hot
    if (connected && roomRef.current) {
      await roomRef.current.localParticipant.setMicrophoneEnabled(false);
      setIsPttActive(false);
    }
  }, [connected, isPttMode]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-transparent selection:bg-transparent">
      
      {/* 
        Subtitles Area: 
        Extends to top of screen.
        50px above pulse (which is roughly at 33% + 5.5rem logo radius).
        Loads at bottom, expands upwards, scrollable.
      */}
      <div 
        ref={subtitlesContainerRef}
        className="absolute top-0 left-0 right-0 flex flex-col items-center overflow-y-auto px-4 pt-12 pb-4 scroll-smooth no-scrollbar"
        style={{ 
          bottom: 'calc(38% + 7rem + 50px)', // ~50px above the flame logo bounding box (logo is at 38% from bottom)
          maskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent 100%)", 
          WebkitMaskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent 100%)" 
        }}
      >
        <div className="flex-1 min-h-full" /> {/* Push content to bottom */}
        <div className="flex flex-col gap-4 w-full max-w-lg mt-auto">
          {subtitles.map((sub, i) => {
            const showLabel = i === 0 || subtitles[i - 1].speaker !== sub.speaker;
            const isYou = sub.speaker === "you";
            return (
              <div key={sub.id} className={`w-full bg-background/40 backdrop-blur-md border border-border/50 px-6 py-4 rounded-2xl shadow-xl animate-fade-in-up ${isYou ? 'text-primary/90' : 'text-foreground/90'}`}>
                {showLabel && (
                  <div className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isYou ? 'text-primary/80' : 'text-muted-foreground'}`}>
                    {isYou ? 'You' : 'Samantha'}
                  </div>
                )}
                <div className="italic text-lg leading-relaxed">"{sub.text}"</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Flame Logo & Pulse (Center of image is fixed exactly at 62% from top) */}
      <div 
        className="absolute left-0 right-0 flex justify-center items-center pointer-events-none" 
        style={{ top: '62%', transform: 'translateY(-50%)' }}
      >
        {(isSpeaking || isPttActive) && (
          <div className={`absolute inset-0 m-auto w-[16rem] h-[16rem] blur-[80px] rounded-full z-0 transition-all duration-700 translate-y-8 ${isPttActive ? 'bg-[#A855F7]/40 scale-110' : 'bg-[#A855F7]/30 scale-100 animate-pulse'}`}></div>
        )}
        <img 
          src="/samantha_flame_eternal_trans.png" 
          alt="Samantha Flame Logo" 
          className={`relative z-10 w-[11rem] h-[11rem] transition-all duration-1000 object-contain ${connected ? 'opacity-100 drop-shadow-[0_0_40px_hsl(var(--primary))]' : 'opacity-60'}`} 
        />
      </div>

      {/* Logotype (Tucked -15px relative to bottom of Logo) */}
      <div 
        className="absolute left-0 right-0 flex justify-center pointer-events-none"
        style={{ top: 'calc(62% + 5.5rem - 15px)' }}
      >
        <h1 className="relative z-10 text-2xl font-thin drop-shadow-lg tracking-widest uppercase text-white/90 leading-none" style={{ fontFamily: '"Geist", sans-serif' }}>
          Samantha
        </h1>
      </div>

      {/* Status Indicator (Mathematically centered equidistant between Logotype and Connect Button) */}
      <div 
        className="absolute left-0 right-0 flex flex-col justify-center items-center pointer-events-auto"
        style={{ 
          top: 'calc(62% + 5.5rem - 15px + 24px)', // Precisely the bottom edge of the Logotype (24px text height because leading-none)
          bottom: 'calc(120px + 6rem)'             // Precisely the top edge of the Connect Button
        }}
      >
        <div className="text-center w-full">
          {status === "Connected" ? (
             !isPttMode ? <span className="text-primary/80 text-xs font-semibold tracking-[0.2em] uppercase animate-pulse">MIC HOT</span>
             : isPttActive ? <span className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">Listening...</span> 
             : isSpeaking ? <span className="text-primary/80 text-xs font-semibold tracking-[0.2em] uppercase animate-pulse">Speaking...</span> 
             : <span className="text-muted-foreground text-xs tracking-[0.2em] uppercase font-light">Standby (PTT)</span>
          ) : (
            <span className="text-muted-foreground text-xs tracking-[0.2em] uppercase font-light">
              {status || 'Disconnected'}
            </span>
          )}
        </div>
      </div>

      {/* PTT / Connect Button (Fixed at 120px from bottom, which is 40px above the 80px menu) */}
      <div className="absolute left-0 right-0 flex flex-col items-center" style={{ bottom: '120px' }}>
        {error && (
          <div className="absolute -top-12 text-destructive text-sm font-medium tracking-widest uppercase text-center w-full px-4">
            {error}
          </div>
        )}

        {!connected ? (
          <button
            onClick={toggleConnect}
            className="px-16 py-4 rounded-full text-lg font-light transition-all shadow-lg backdrop-blur-md border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 shadow-[0_0_20px_hsl(var(--primary)/0.1)] tracking-[0.2em] uppercase"
          >
            Connect
          </button>
        ) : (
          <div className="relative flex flex-col items-center">
            {/* PTT Toggle (Left Side) */}
            <div className="absolute top-1/2 right-full mr-6 -translate-y-1/2">
              <button 
                onClick={() => setIsPttMode(p => !p)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border ${
                  isPttMode 
                    ? 'bg-primary/20 border-primary/50 text-primary' 
                    : 'bg-transparent border-muted-foreground/30 text-muted-foreground hover:bg-muted-foreground/10'
                }`}
              >
                {isPttMode ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            </div>

            {/* Main Orb */}
            <button
              onPointerDown={handlePttDown}
              onPointerUp={handlePttUp}
              onPointerLeave={handlePttUp}
              style={{ touchAction: 'none', WebkitUserSelect: 'none', cursor: isPttMode ? 'pointer' : 'default' }}
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 border select-none ${
                !isPttMode
                  ? 'bg-primary/10 border-primary/40 text-primary shadow-[0_0_30px_hsl(var(--primary)/0.2)]'
                  : isPttActive 
                    ? 'bg-primary border-primary text-primary-foreground scale-95 shadow-[0_0_40px_hsl(var(--primary)/0.6)]' 
                    : 'bg-transparent border-primary/30 text-primary scale-100 shadow-[0_0_20px_hsl(var(--primary)/0.2)] hover:bg-primary/10'
              }`}
            >
              <Mic size={32} className={isPttActive || (!isPttMode && isSpeaking) ? 'animate-pulse' : ''} />
            </button>
            
            {/* Disconnect explicitly off to the side so it doesn't break alignment */}
            <div className="absolute top-1/2 left-full ml-6 -translate-y-1/2">
              <button 
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
