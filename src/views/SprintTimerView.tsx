import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useEntityStore } from '../stores/entityStore';
import { useNavigationStore } from '../stores/navigationStore';
import { Settings, Play, Square } from 'lucide-react';

interface Phase {
  id: number;
  name: string;
  durationSeconds: number;
  instruction: string;
}

const ULTRADIAN_PRESET: Phase[] = [
  {
    id: 1,
    name: 'Grounding',
    durationSeconds: 5 * 60,
    instruction: 'Close your eyes. Notice the noise and let it dissolve. State the goal with cold precision. Feel the source code. Let it load into biological RAM.'
  },
  {
    id: 2,
    name: 'The Burn',
    durationSeconds: 90 * 60,
    instruction: 'Engage the membrane. You have 90 minutes of peak acetylcholine. Forge the strategy. Challenge the Avatar. Construct the AEBS. Dispatch the Swarm.'
  },
  {
    id: 3,
    name: 'The Release',
    durationSeconds: 12 * 60,
    instruction: 'Step away from the glass. The drones are executing. Drop the context entirely. Correct your physical spine. Rehydrate. Reconnect to the Higher Self.'
  }
];

export const SprintTimerView: React.FC = () => {
  const { epics, projects } = useEntityStore();
  const { activeEpicId } = useNavigationStore();
  const activeEpic = epics.find(e => e.id === activeEpicId) || null;
  const projectName = activeEpic ? (projects.find(p => p.id === activeEpic.projectId)?.name || 'Unknown') : '';

  const [phases, setPhases] = useState<Phase[]>(ULTRADIAN_PRESET);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ULTRADIAN_PRESET[0].durationSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [visualFlash, setVisualFlash] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio('https://cdn.freesound.org/previews/169/169383_311243-lq.mp3'); // Fallback placeholder gong
    audioRef.current.load();
  }, []);

  const currentPhase = phases[currentPhaseIndex];

  // Timer tick — only depends on isRunning, uses functional setState
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Phase transition — triggered when timeLeft hits 0
  const triggerPhaseTransition = useCallback(() => {
    // Attempt audio playback (fire-and-forget, don't block phase transition)
    if (audioRef.current) {
      audioRef.current.play().catch(() => triggerVisualFlash());
    } else {
      triggerVisualFlash();
    }

    // Move to next phase
    if (currentPhaseIndex < phases.length - 1) {
      const nextIndex = currentPhaseIndex + 1;
      const nextPhase = phases[nextIndex];
      if (nextPhase) {
        setCurrentPhaseIndex(nextIndex);
        setTimeLeft(nextPhase.durationSeconds);
      }
    } else {
      // Cycle complete
      setIsRunning(false);
      setCurrentPhaseIndex(0);
      setTimeLeft(phases[0].durationSeconds);
      setHasStarted(false);
    }
  }, [currentPhaseIndex, phases]);

  // Watch for phase transition
  useEffect(() => {
    if (isRunning && timeLeft === 0) {
      triggerPhaseTransition();
    }
  }, [isRunning, timeLeft, triggerPhaseTransition]);

  const triggerVisualFlash = () => {
    setVisualFlash(true);
    setTimeout(() => setVisualFlash(false), 1500);
  };

  const handleStart = () => {
    // Unlock audio context by playing empty/silent sound on initial interaction
    if (!hasStarted && audioRef.current) {
      audioRef.current.play().then(() => {
        audioRef.current?.pause();
        audioRef.current!.currentTime = 0;
      }).catch(e => console.log('Audio init caught:', e));
    }
    
    setHasStarted(true);
    setIsRunning(true);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className={`flex flex-col h-full transition-colors duration-1000 ${visualFlash ? 'bg-primary/50' : ''}`}>
      <header className="p-4 flex justify-between items-center z-10 pt-8">
        <div>
          {activeEpic ? (
            <>
              <h2 className="text-sm font-mono tracking-widest text-primary uppercase">{projectName}</h2>
              <h1 className="text-xl font-bold text-white">{activeEpic.title}</h1>
            </>
          ) : (
            <h1 className="text-xl font-bold text-white">Psionic Membrane</h1>
          )}
        </div>
        <button 
          onClick={() => setShowConfig(!showConfig)}
          className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
        >
          <Settings size={20} />
        </button>
      </header>

      {showConfig && (
        <div className="absolute top-20 right-4 p-4 rounded-xl border border-white/10 bg-black/80 backdrop-blur-xl z-20 w-64 shadow-2xl">
          <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-widest">Cycle Config</h3>
          {phases.map((p, idx) => (
            <div key={p.id} className="mb-4">
              <label className="text-xs text-muted-foreground">{p.name} (mins)</label>
              <input 
                type="number" 
                value={Math.floor(p.durationSeconds / 60)} 
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (isNaN(val) || val < 1) return;
                  const newPhases = phases.map((p, i) => 
                    i === idx ? { ...p, durationSeconds: val * 60 } : p
                  );
                  setPhases(newPhases);
                  if (idx === currentPhaseIndex && !isRunning) {
                    setTimeLeft(val * 60);
                  }
                }}
                className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-6 pb-24 text-center z-0 relative">
        
        <div className="mb-12 relative">
          <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full -z-10"></div>
          
          <h2 className="text-primary font-mono text-sm md:text-xl tracking-[0.2em] mb-6 uppercase">
            Phase {currentPhase.id}: {currentPhase.name}
          </h2>
          
          <div className="text-7xl md:text-9xl font-light tracking-tighter tabular-nums glow-border p-8 md:p-12 rounded-3xl bg-black/40 backdrop-blur-md">
            {formatTime(timeLeft)}
          </div>
        </div>
        
        <div className="max-w-2xl mb-12 h-32 flex items-center justify-center">
          <p className="text-lg md:text-2xl font-light leading-relaxed text-foreground/90 transition-opacity duration-500">
            "{currentPhase.instruction}"
          </p>
        </div>

        {activeEpic && (
          <div className="max-w-xl w-full text-left bg-white/5 border border-white/10 p-4 rounded-xl mb-12">
            <h4 className="text-xs font-mono text-primary uppercase tracking-widest mb-2">Active Objectives</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              {activeEpic.objectives.map((obj, i) => (
                <li key={i}>{obj}</li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="flex gap-4">
          {!isRunning ? (
            <button 
              onClick={handleStart}
              className="flex items-center px-8 py-4 rounded-full bg-primary text-primary-foreground font-semibold tracking-wide hover:bg-primary/90 transition-all glow-border hover:shadow-[0_0_20px_rgba(168,85,247,0.6)]"
            >
              <Play className="mr-2" size={20} />
              {hasStarted ? 'RESUME SEQUENCE' : 'INITIATE SEQUENCE'}
            </button>
          ) : (
            <button 
              onClick={() => setIsRunning(false)}
              className="flex items-center px-8 py-4 rounded-full bg-white/10 border border-white/20 text-white font-semibold tracking-wide hover:bg-white/20 transition-all"
            >
              <Square className="mr-2" size={20} />
              PAUSE
            </button>
          )}
          
          <button 
            onClick={() => {
              triggerPhaseTransition();
            }}
            className="px-4 py-4 rounded-full bg-white/5 border border-white/10 text-muted-foreground hover:text-white transition-all text-xs font-mono"
            title="Dev Skip"
          >
            SKIP
          </button>
        </div>
      </div>
    </div>
  );
};
