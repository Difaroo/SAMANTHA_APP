import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  EpicSchema,
  ProjectSchema,
  epicToPrism,
  normalizeEpic,
  prismTaskToEpic,
  projectToPrism,
  rankForIndex,
  snapshotToEntities,
  stableValue,
  type Epic,
  type PrismTask,
  type Project,
  type SyncMutation,
  type SyncResponse,
} from '../sync/contract';
import { indexedDbStorage } from '../sync/indexedDbStorage';

export { EpicSchema, ProjectSchema };
export type { Epic, Project };

export type SyncPhase = 'idle' | 'offline' | 'pending' | 'syncing' | 'synced' | 'conflict' | 'error';

interface EntityState {
  projects: Project[];
  epics: Epic[];
  outbox: SyncMutation[];
  serverRevision: number;
  syncPhase: SyncPhase;
  syncMessage: string;
  lastSyncedAt: string | null;
  _hasHydrated: boolean;
  setProjects: (projects: Project[]) => void;
  setEpics: (epics: Epic[]) => void;
  addEpic: (epic: Epic) => void;
  updateEpic: (epic: Epic) => void;
  deleteEpic: (id: string) => void;
  applySyncResponse: (response: SyncResponse, sent: SyncMutation[]) => void;
  setSyncStatus: (phase: SyncPhase, message?: string) => void;
}

function mutationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function queueMutation(outbox: SyncMutation[], mutation: SyncMutation) {
  const next = [...outbox];
  const index = next.findIndex((item) =>
    item.entityType === mutation.entityType && item.entityId === mutation.entityId,
  );
  if (index === -1) next.push(mutation);
  else next[index] = { ...mutation, id: next[index].id, baseVersion: next[index].baseVersion };
  return next;
}

function projectMutation(project: Project, operation: 'upsert' | 'delete' = 'upsert'): SyncMutation {
  return {
    id: mutationId(),
    entityType: 'project',
    entityId: project.id,
    operation,
    baseVersion: project.version || 0,
    value: operation === 'upsert' ? projectToPrism(project) : undefined,
  };
}

function epicMutation(epic: Epic, operation: 'upsert' | 'delete' = 'upsert'): SyncMutation {
  return {
    id: mutationId(),
    entityType: 'task',
    entityId: epic.id,
    operation,
    baseVersion: epic.version || 0,
    projectId: epic.projectId,
    value: operation === 'upsert' ? epicToPrism(epic) : undefined,
  };
}

function normalizeProjects(projects: Project[]) {
  return projects.map((project, index) => ({ ...project, rank: rankForIndex(index) }));
}

function normalizeEpics(epics: Epic[]) {
  const projectIndexes = new Map<string, number>();
  return epics.map((epic) => {
    const index = projectIndexes.get(epic.projectId) || 0;
    projectIndexes.set(epic.projectId, index + 1);
    return normalizeEpic({ ...epic, rank: rankForIndex(index) });
  });
}

function mutationsForProjects(current: Project[], nextProjects: Project[], outbox: SyncMutation[]) {
  let nextOutbox = outbox;
  const currentById = new Map(current.map((project) => [project.id, project]));
  const nextById = new Map(nextProjects.map((project) => [project.id, project]));
  nextProjects.forEach((project) => {
    const previous = currentById.get(project.id);
    if (!previous || stableValue(projectToPrism(previous)) !== stableValue(projectToPrism(project))) {
      nextOutbox = queueMutation(nextOutbox, projectMutation({ ...project, version: previous?.version || 0 }));
    }
  });
  current.forEach((project) => {
    if (!nextById.has(project.id)) nextOutbox = queueMutation(nextOutbox, projectMutation(project, 'delete'));
  });
  return nextOutbox;
}

function mutationsForEpics(current: Epic[], nextEpics: Epic[], outbox: SyncMutation[]) {
  let nextOutbox = outbox;
  const currentById = new Map(current.map((epic) => [epic.id, epic]));
  const nextById = new Map(nextEpics.map((epic) => [epic.id, epic]));
  nextEpics.forEach((epic) => {
    const previous = currentById.get(epic.id);
    if (!previous || stableValue(epicToPrism(previous)) !== stableValue(epicToPrism(epic))) {
      nextOutbox = queueMutation(nextOutbox, epicMutation({ ...epic, version: previous?.version || 0 }));
    }
  });
  current.forEach((epic) => {
    if (!nextById.has(epic.id)) nextOutbox = queueMutation(nextOutbox, epicMutation(epic, 'delete'));
  });
  return nextOutbox;
}

function applyMutations(projects: Project[], epics: Epic[], mutations: SyncMutation[]) {
  let nextProjects = [...projects];
  let nextEpics = [...epics];
  mutations.forEach((mutation) => {
    if (mutation.entityType === 'project') {
      const index = nextProjects.findIndex((project) => project.id === mutation.entityId);
      if (mutation.operation === 'delete') {
        nextProjects = nextProjects.filter((project) => project.id !== mutation.entityId);
        nextEpics = nextEpics.filter((epic) => epic.projectId !== mutation.entityId);
      } else if (mutation.value) {
        const value = mutation.value;
        const project: Project = {
          id: mutation.entityId,
          name: String(value.name || 'Untitled project'),
          description: String(value.abstract || ''),
          rank: typeof value.rank === 'string' ? value.rank : undefined,
          version: mutation.baseVersion,
        };
        if (index >= 0) nextProjects[index] = { ...nextProjects[index], ...project };
        else nextProjects.push(project);
      }
      return;
    }

    if (mutation.operation === 'delete') {
      nextEpics = nextEpics.filter((epic) => epic.id !== mutation.entityId);
      return;
    }
    if (!mutation.value || !mutation.projectId) return;
    const index = nextEpics.findIndex((epic) => epic.id === mutation.entityId);
    const epic = prismTaskToEpic(mutation.value as PrismTask, mutation.projectId, Math.max(index, 0));
    epic.version = mutation.baseVersion;
    if (index >= 0) nextEpics[index] = { ...nextEpics[index], ...epic };
    else nextEpics.push(epic);
  });
  return { projects: nextProjects, epics: nextEpics };
}

export const useEntityStore = create<EntityState>()(
  persist(
    (set) => ({
      projects: [],
      epics: [],
      outbox: [],
      serverRevision: 0,
      syncPhase: 'idle',
      syncMessage: '',
      lastSyncedAt: null,
      _hasHydrated: false,

      setProjects: (projects) => set((state) => {
        const normalized = normalizeProjects(projects);
        return {
          projects: normalized,
          outbox: mutationsForProjects(state.projects, normalized, state.outbox),
          syncPhase: 'pending',
        };
      }),

      setEpics: (epics) => set((state) => {
        const normalized = normalizeEpics(epics);
        return {
          epics: normalized,
          outbox: mutationsForEpics(state.epics, normalized, state.outbox),
          syncPhase: 'pending',
        };
      }),

      addEpic: (epic) => set((state) => {
        const normalized = normalizeEpic({ ...epic, rank: epic.rank || rankForIndex(state.epics.length) });
        return {
          epics: [...state.epics, normalized],
          outbox: queueMutation(state.outbox, epicMutation(normalized)),
          syncPhase: 'pending',
        };
      }),

      updateEpic: (epic) => set((state) => {
        const current = state.epics.find((item) => item.id === epic.id);
        const normalized = normalizeEpic({ ...epic, version: current?.version || epic.version || 0 });
        return {
          epics: state.epics.map((item) => item.id === epic.id ? normalized : item),
          outbox: queueMutation(state.outbox, epicMutation(normalized)),
          syncPhase: 'pending',
        };
      }),

      deleteEpic: (id) => set((state) => {
        const current = state.epics.find((epic) => epic.id === id);
        if (!current) return state;
        return {
          epics: state.epics.filter((epic) => epic.id !== id),
          outbox: queueMutation(state.outbox, epicMutation(current, 'delete')),
          syncPhase: 'pending',
        };
      }),

      applySyncResponse: (response, sent) => set((state) => {
        const server = snapshotToEntities(response.streams);
        const acknowledgementById = new Map(response.acknowledgements.map((ack) => [ack.id, ack]));
        const sentById = new Map(sent.map((mutation) => [mutation.id, mutation]));
        const serverProjects = new Map(server.projects.map((project) => [project.id, project]));
        const serverEpics = new Map(server.epics.map((epic) => [epic.id, epic]));

        const remaining = state.outbox.flatMap((mutation) => {
          const acknowledgement = acknowledgementById.get(mutation.id);
          if (!acknowledgement) return [mutation];
          if (acknowledgement.status === 'conflict') return [];
          const sentMutation = sentById.get(mutation.id);
          if (!sentMutation || stableValue(sentMutation) === stableValue(mutation)) return [];
          const serverEntity = mutation.entityType === 'project'
            ? serverProjects.get(mutation.entityId)
            : serverEpics.get(mutation.entityId);
          return [{
            ...mutation,
            id: mutationId(),
            baseVersion: serverEntity?.version || 0,
          }];
        });
        const visible = applyMutations(server.projects, server.epics, remaining);
        return {
          ...visible,
          outbox: remaining,
          serverRevision: response.revision,
          syncPhase: response.conflicts.length ? 'conflict' : remaining.length ? 'pending' : 'synced',
          syncMessage: response.conflicts.length
            ? 'A newer server edit was kept'
            : remaining.length ? `${remaining.length} change(s) pending` : 'Up to date',
          lastSyncedAt: new Date().toISOString(),
        };
      }),

      setSyncStatus: (syncPhase, syncMessage = '') => set({ syncPhase, syncMessage }),
    }),
    {
      name: 'samantha-entity-storage',
      version: 2,
      storage: createJSONStorage(() => indexedDbStorage),
      partialize: (state) => ({
        projects: state.projects,
        epics: state.epics,
        outbox: state.outbox,
        serverRevision: state.serverRevision,
        lastSyncedAt: state.lastSyncedAt,
      }),
      migrate: (persisted, version) => {
        const state = persisted as Partial<EntityState>;
        if (version < 2) {
          const epics = (state.epics || []).map((epic, index) => normalizeEpic({
            ...epic,
            nextRank: epic.nextRank ?? (epic.inGlobalBacklog ? rankForIndex(index) : null),
          }));
          return { ...state, epics, outbox: [], serverRevision: 0 };
        }
        return state;
      },
      onRehydrateStorage: () => () => {
        useEntityStore.setState({ _hasHydrated: true });
      },
    },
  ),
);
