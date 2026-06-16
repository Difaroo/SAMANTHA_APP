import React from 'react';
import { useNavigationStore, type ViewState } from '../stores/navigationStore';
import { Flame, Box, Rocket, Hourglass } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const { currentView, setCurrentView } = useNavigationStore();

  const navItems: { id: ViewState; icon: React.ElementType }[] = [
    { id: 'voice', icon: Flame },
    { id: 'projects', icon: Box },
    { id: 'backlog', icon: Rocket },
    { id: 'timer', icon: Hourglass },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-transparent flex justify-around items-center px-6 z-50" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)', height: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentView === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`flex flex-col items-center justify-center w-14 h-14 rounded-full transition-all duration-300 ease-in-out ${
              isActive 
                ? 'text-primary scale-110 drop-shadow-[0_0_15px_hsl(var(--primary)/0.6)]' 
                : 'text-primary/50 hover:text-primary/80'
            }`}
          >
            <Icon 
              className={`w-7 h-7 ${item.id === 'backlog' ? '-rotate-45 transform mt-1' : ''} ${isActive ? 'drop-shadow-[0_0_8px_hsl(var(--primary)/0.8)]' : ''}`} 
              strokeWidth={isActive ? 2 : 1.5} 
            />
          </button>
        );
      })}
    </div>
  );
};
