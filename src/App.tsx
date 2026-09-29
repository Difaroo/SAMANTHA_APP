import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigationStore, type ViewState } from './stores/navigationStore';
import { useVoiceStore } from './stores/voiceStore';
import { BottomNav } from './components/BottomNav';
import { VoiceControlView } from './views/VoiceControlView';
import { BacklogView } from './views/BacklogView';
import { ProjectsView } from './views/ProjectsView';
import { SprintTimerView } from './views/SprintTimerView';
import { EpicDetailView } from './views/EpicDetailView';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useEntityStore } from './stores/entityStore';
import { SyncManager } from './services/syncManager';

// Helper component for the indicator
const GlobalVoiceIndicator: React.FC = () => {
  const { isVoiceConnected, voiceSessionStart, statusText } = useVoiceStore();
  const { currentView } = useNavigationStore();
  const [elapsed, setElapsed] = useState('00:00');

  useEffect(() => {
    if (!isVoiceConnected || !voiceSessionStart) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - voiceSessionStart) / 1000);
      const m = Math.floor(diff / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      setElapsed(`${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [isVoiceConnected, voiceSessionStart]);

  if (!isVoiceConnected || currentView === 'voice') return null;

  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-primary/20 backdrop-blur-md border border-primary/40 text-primary px-4 py-1.5 rounded-full flex items-center gap-3 shadow-[0_0_15px_hsl(var(--primary)/0.3)] animate-fade-in-up pointer-events-none">
      <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
      <span className="text-xs font-semibold tracking-widest uppercase">{statusText || 'Active'}</span>
      <span className="text-xs font-mono">{elapsed}</span>
    </div>
  );
};

const SyncStatusIndicator: React.FC = () => {
  const { syncPhase, syncMessage, outbox } = useEntityStore();
  const offline = syncPhase === 'offline' || syncPhase === 'error' || syncPhase === 'conflict';
  const label = syncPhase === 'synced' ? 'Synced' :
    syncPhase === 'syncing' ? 'Syncing' :
    offline ? 'Offline' :
    outbox.length ? `${outbox.length} pending` : 'Connecting';
  const Icon = offline ? CloudOff : syncPhase === 'syncing' ? RefreshCw : Cloud;

  return (
    <button
      type="button"
      aria-label="Sync with PRISM"
      title={syncMessage || label}
      onClick={() => void SyncManager.syncNow()}
      className={`fixed top-2 left-4 z-[100] flex h-7 items-center gap-1.5 text-[10px] font-mono ${
        offline ? 'text-red-300' : syncPhase === 'synced' ? 'text-emerald-300' : 'text-amber-200'
      }`}
    >
      <Icon size={13} className={syncPhase === 'syncing' ? 'animate-spin' : ''} />
      <span>{label}</span>
    </button>
  );
};

const views: ViewState[] = ['voice', 'projects', 'backlog', 'timer'];
const SWIPE_AXIS_SLOP = 10;
const SWIPE_COMMIT_DISTANCE = 64;

type SwipeGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  axis: 'pending' | 'horizontal' | 'vertical';
};

const ViewContainer: React.FC = () => {
  const { currentView, setCurrentView, cardDragActive } = useNavigationStore();
  const currentViewIndex = Math.max(0, views.indexOf(currentView));
  const swipeGestureRef = useRef<SwipeGesture | null>(null);
  const suppressClickRef = useRef(false);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const resetSwipe = useCallback(() => {
    swipeGestureRef.current = null;
    setSwipeOffset(0);
  }, []);

  const handleSwipeStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch' || cardDragActive) return;
    const target = event.target as HTMLElement;
    if (target.closest('[data-drag-handle="true"], button, a, input, textarea, select')) return;

    suppressClickRef.current = false;
    swipeGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      axis: 'pending',
    };
  }, [cardDragActive]);

  const handleSwipeMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = swipeGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || cardDragActive) return;

    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    if (gesture.axis === 'pending' && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= SWIPE_AXIS_SLOP) {
      gesture.axis = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
    }
    if (gesture.axis !== 'horizontal') return;

    if (event.cancelable) event.preventDefault();
    const atStart = currentViewIndex === 0 && deltaX > 0;
    const atEnd = currentViewIndex === views.length - 1 && deltaX < 0;
    setSwipeOffset((atStart || atEnd) ? deltaX * 0.2 : deltaX);
  }, [cardDragActive, currentViewIndex]);

  const handleSwipeEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = swipeGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - gesture.startX;
    if (gesture.axis === 'horizontal' && Math.abs(deltaX) >= SWIPE_COMMIT_DISTANCE && !cardDragActive) {
      const nextIndex = deltaX < 0 ? currentViewIndex + 1 : currentViewIndex - 1;
      const nextView = views[nextIndex];
      if (nextView) {
        suppressClickRef.current = true;
        window.setTimeout(() => { suppressClickRef.current = false; }, 0);
        setCurrentView(nextView);
      }
    }
    resetSwipe();
  }, [cardDragActive, currentViewIndex, resetSwipe, setCurrentView]);

  const handleClickCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  }, []);

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#0a0a0a] text-foreground relative z-0">
      <div className="absolute bottom-0 left-0 right-0 h-[30%] pointer-events-none z-0 bg-gradient-to-t from-primary/15 to-transparent"></div>

      <GlobalVoiceIndicator />
      <SyncStatusIndicator />

      <div className="fixed top-2 right-4 text-[10px] font-mono text-muted-foreground/50 z-[100] pointer-events-none tracking-widest">
        v2.4.13
      </div>

      <div
        data-testid="view-viewport"
        className="absolute inset-0 z-10 overflow-hidden"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={handleSwipeStart}
        onPointerMove={handleSwipeMove}
        onPointerUp={handleSwipeEnd}
        onPointerCancel={resetSwipe}
        onClickCapture={handleClickCapture}
      >
        <div
          className={`flex h-full ease-out ${swipeOffset === 0 ? 'transition-transform duration-300' : ''}`}
          style={{ transform: `translate3d(calc(-${currentViewIndex * 100}vw + ${swipeOffset}px), 0, 0)` }}
        >
          <div className="h-full w-screen shrink-0 overflow-y-auto no-scrollbar" style={{ touchAction: 'pan-y' }}>
            <VoiceControlView />
          </div>
          <div className="h-full w-screen shrink-0 overflow-y-auto no-scrollbar" style={{ touchAction: 'pan-y' }}>
            <ProjectsView />
          </div>
          <div className="h-full w-screen shrink-0 overflow-y-auto no-scrollbar" style={{ touchAction: 'pan-y' }}>
            <BacklogView />
          </div>
          <div className="h-full w-screen shrink-0 overflow-y-auto no-scrollbar" style={{ touchAction: 'pan-y' }}>
            <SprintTimerView />
          </div>
        </div>
      </div>
      
      {/* Global Overlays */}
      <EpicDetailView />
      
      {/* Navigation */}
      <BottomNav />
    </main>
  );
};

export default function App() {
  useEffect(() => {
    SyncManager.init();
  }, []);

  useEffect(() => {
    const launchCover = document.getElementById('launch-cover');
    if (!launchCover) return;

    let secondFrame = 0;
    let removalTimer = 0;
    const removeLaunchCover = () => launchCover.remove();
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        launchCover.addEventListener('transitionend', removeLaunchCover, { once: true });
        launchCover.classList.add('launch-cover--ready');
        removalTimer = window.setTimeout(removeLaunchCover, 700);
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      window.clearTimeout(removalTimer);
      launchCover.removeEventListener('transitionend', removeLaunchCover);
    };
  }, []);

  return <ViewContainer />;
}
