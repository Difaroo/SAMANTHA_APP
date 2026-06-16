import { create } from 'zustand';

export type ViewState = 'voice' | 'backlog' | 'projects' | 'timer';

interface NavigationState {
  currentView: ViewState;
  setCurrentView: (view: ViewState) => void;
  activeEpicId: string | null;
  setActiveEpicId: (id: string | null) => void;
  selectedEpicDetailId: string | null;
  setSelectedEpicDetailId: (id: string | null) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  currentView: 'backlog', // Start on backlog by default
  setCurrentView: (view) => set({ currentView: view }),
  activeEpicId: null,
  setActiveEpicId: (id) => set({ activeEpicId: id, currentView: 'timer' }), // Auto-switch to timer
  selectedEpicDetailId: null,
  setSelectedEpicDetailId: (id) => set({ selectedEpicDetailId: id }),
}));
