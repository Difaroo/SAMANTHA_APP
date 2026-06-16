import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const EpicSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  description: z.string(),
  objectives: z.array(z.string()),
  inGlobalBacklog: z.boolean(),
});
export type Epic = z.infer<typeof EpicSchema>;

interface EntityState {
  projects: Project[];
  epics: Epic[];
  setProjects: (projects: Project[]) => void;
  setEpics: (epics: Epic[]) => void;
  addEpic: (epic: Epic) => void;
  updateEpic: (epic: Epic) => void;
  deleteEpic: (id: string) => void;
}

const initialProjects: Project[] = [
  { id: 'proj-1', name: 'Samantha Audio Core', description: 'Core voice architecture and processing' },
  { id: 'proj-2', name: 'Prism Integration', description: 'Project management UI integration' }
];

const initialEpics: Epic[] = [
  {
    id: 'epic-1',
    projectId: 'proj-1',
    title: 'Implement WebRTC Bridge',
    description: 'Establish a low-latency connection between the browser and the LiveKit server.',
    objectives: ['Connect to LiveKit', 'Stream audio track', 'Handle network disconnects'],
    inGlobalBacklog: true
  },
  {
    id: 'epic-2',
    projectId: 'proj-1',
    title: 'VAD & Silence Detection',
    description: 'Ensure Samantha only speaks when the user has finished their sentence.',
    objectives: ['Implement Silero VAD', 'Tune threshold to 500ms', 'Emit turn_complete event'],
    inGlobalBacklog: true
  },
  {
    id: 'epic-3',
    projectId: 'proj-2',
    title: 'Drag and Drop Backlog',
    description: 'Build the fluid UI for prioritizing epics using @dnd-kit.',
    objectives: ['Install dnd-kit', 'Build SortableContext', 'Persist order in state'],
    inGlobalBacklog: true
  },
  {
    id: 'epic-4',
    projectId: 'proj-2',
    title: 'Projects Refactor',
    description: 'Refactor projects view into a list with nested to-do epics.',
    objectives: ['Add project reordering', 'Epic detail view', 'Add to backlog functionality'],
    inGlobalBacklog: false
  }
];

export const useEntityStore = create<EntityState>()(
  persist(
    (set) => ({
      projects: initialProjects,
      epics: initialEpics,
      setProjects: (projects) => set({ projects }),
      setEpics: (epics) => set({ epics }),
      addEpic: (epic) => set((state) => ({ epics: [...state.epics, epic] })),
      updateEpic: (epic) => set((state) => ({
        epics: state.epics.map((e) => (e.id === epic.id ? epic : e)),
      })),
      deleteEpic: (id) => set((state) => ({
        epics: state.epics.filter((e) => e.id !== id),
      })),
    }),
    {
      name: 'samantha-entity-storage', // key in localStorage
    }
  )
);
