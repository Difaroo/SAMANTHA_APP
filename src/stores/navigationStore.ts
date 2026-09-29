import { create } from 'zustand';

export type ViewState = 'voice' | 'backlog' | 'projects' | 'timer';

interface NavigationState {
  currentView: ViewState;
  setCurrentView: (view: ViewState) => void;
  cardDragActive: boolean;
  setCardDragActive: (active: boolean) => void;
  activeEpicId: string | null;
  setActiveEpicId: (id: string | null) => void;
  selectedEpicDetailId: string | null;
  setSelectedEpicDetailId: (id: string | null) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  currentView: 'voice',
  setCurrentView: (view) => set({ currentView: view }),
  cardDragActive: false,
  setCardDragActive: (active) => set({ cardDragActive: active }),
  activeEpicId: null,
  setActiveEpicId: (id) => set(id ? { activeEpicId: id, currentView: 'timer' } : { activeEpicId: null }),
  selectedEpicDetailId: null,
  setSelectedEpicDetailId: (id) => set({ selectedEpicDetailId: id }),
}));
