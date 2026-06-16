import React, { useEffect, useRef, useState } from 'react';
import { useNavigationStore, type ViewState } from './stores/navigationStore';
import { useVoiceStore } from './stores/voiceStore';
import { BottomNav } from './components/BottomNav';
import { VoiceControlView } from './views/VoiceControlView';
import { BacklogView } from './views/BacklogView';
import { ProjectsView } from './views/ProjectsView';
import { SprintTimerView } from './views/SprintTimerView';
import { EpicDetailView } from './views/EpicDetailView';

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

const views: ViewState[] = ['voice', 'projects', 'backlog', 'timer'];

const ViewContainer: React.FC = () => {
  const { currentView, setCurrentView } = useNavigationStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Add a ref to avoid infinite loops during programmatic scrolling
  const isProgrammaticScroll = useRef(false);
  
  // Programmatic scroll when BottomNav changes currentView
  useEffect(() => {
    if (scrollContainerRef.current && !isProgrammaticScroll.current) {
      const idx = views.indexOf(currentView);
      if (idx !== -1) {
        const width = scrollContainerRef.current.clientWidth;
        isProgrammaticScroll.current = true;
        scrollContainerRef.current.scrollTo({
          left: idx * width,
          behavior: 'smooth'
        });
        
        // Reset flag after animation
        setTimeout(() => {
          isProgrammaticScroll.current = false;
        }, 500);
      }
    }
  }, [currentView]);

  // Sync scroll position back to currentView when user swipes manually
  const handleScroll = () => {
    if (isProgrammaticScroll.current) return;
    
    if (scrollContainerRef.current) {
      const width = scrollContainerRef.current.clientWidth;
      const scrollLeft = scrollContainerRef.current.scrollLeft;
      const idx = Math.round(scrollLeft / width);
      if (idx >= 0 && idx < views.length && views[idx] !== currentView) {
        // Prevent useEffect from re-triggering programmatic scroll
        isProgrammaticScroll.current = true;
        setCurrentView(views[idx]);
        setTimeout(() => {
          isProgrammaticScroll.current = false;
        }, 100);
      }
    }
  };

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#0a0a0a] text-foreground relative z-0">
      <div className="absolute bottom-0 left-0 right-0 h-[30%] pointer-events-none z-0 bg-gradient-to-t from-primary/15 to-transparent"></div>

      <GlobalVoiceIndicator />

      {/* Snap Container */}
      <div className="fixed top-2 right-4 text-[10px] font-mono text-muted-foreground/50 z-[100] pointer-events-none tracking-widest">
        v2.3.0
      </div>

      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="absolute inset-0 z-10 flex overflow-x-auto snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="w-screen h-full shrink-0 snap-center overflow-y-auto no-scrollbar">
          <VoiceControlView />
        </div>
        <div className="w-screen h-full shrink-0 snap-center overflow-y-auto no-scrollbar">
          <ProjectsView />
        </div>
        <div className="w-screen h-full shrink-0 snap-center overflow-y-auto no-scrollbar">
          <BacklogView />
        </div>
        <div className="w-screen h-full shrink-0 snap-center overflow-y-auto no-scrollbar">
          <SprintTimerView />
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
  return <ViewContainer />;
}
