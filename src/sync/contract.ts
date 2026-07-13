import { z } from 'zod';

export const SYNC_SCHEMA_VERSION = 1;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  rank: z.string().optional(),
  version: z.number().int().nonnegative().optional(),
  updatedAt: z.string().optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const EpicSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  description: z.string(),
  objectives: z.array(z.string()),
  inGlobalBacklog: z.boolean(),
  nextRank: z.string().nullable().optional(),
  rank: z.string().optional(),
  prompt: z.string().optional(),
  done: z.boolean().optional(),
  status: z.string().optional(),
  impact: z.number().optional(),
  effort: z.number().optional(),
  created: z.string().optional(),
  version: z.number().int().nonnegative().optional(),
  updatedAt: z.string().optional(),
});
export type Epic = z.infer<typeof EpicSchema>;

export const PrismTaskSchema = z.object({
  id: z.string(),
  text: z.string().optional(),
  abstract: z.string().optional(),
  prompt: z.string().optional(),
  done: z.boolean().optional(),
  status: z.string().optional(),
  impact: z.number().optional(),
  effort: z.number().optional(),
  created: z.string().optional(),
  nextRank: z.string().nullable().optional(),
  inGlobalBacklog: z.boolean().optional(),
  rank: z.string().optional(),
  version: z.number().int().nonnegative().optional(),
  updatedAt: z.string().optional(),
}).passthrough();
export type PrismTask = z.infer<typeof PrismTaskSchema>;

export const PrismStreamSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().optional(),
  status: z.string().optional(),
  abstract: z.string().optional(),
  rank: z.string().optional(),
  version: z.number().int().nonnegative().optional(),
  updatedAt: z.string().optional(),
  children: z.array(PrismTaskSchema).optional(),
  tasks: z.array(PrismTaskSchema).optional(),
}).passthrough();
export type PrismStream = z.infer<typeof PrismStreamSchema>;

export const SyncMutationSchema = z.object({
  id: z.string(),
  entityType: z.enum(['project', 'task']),
  entityId: z.string(),
  operation: z.enum(['upsert', 'delete']),
  baseVersion: z.number().int().nonnegative(),
  projectId: z.string().optional(),
  value: z.record(z.string(), z.unknown()).optional(),
});
export type SyncMutation = z.infer<typeof SyncMutationSchema>;

const AcknowledgementSchema = z.object({
  id: z.string(),
  status: z.enum(['applied', 'conflict']),
  entityType: z.enum(['project', 'task']),
  entityId: z.string(),
  version: z.number().optional(),
  serverVersion: z.number().optional(),
}).passthrough();

export const SyncResponseSchema = z.object({
  schemaVersion: z.literal(SYNC_SCHEMA_VERSION),
  revision: z.number().int().nonnegative(),
  streams: z.array(PrismStreamSchema),
  acknowledgements: z.array(AcknowledgementSchema).default([]),
  conflicts: z.array(AcknowledgementSchema).default([]),
  cursor: z.number().int().nonnegative().optional(),
  hasMore: z.boolean().optional(),
});
export type SyncResponse = z.infer<typeof SyncResponseSchema>;

export function rankForIndex(index: number) {
  return String((index + 1) * 1000).padStart(12, '0');
}

export function isEpicInNext(epic: Pick<Epic, 'nextRank'>) {
  return typeof epic.nextRank === 'string' && epic.nextRank.length > 0;
}

export function normalizeEpic(epic: Epic): Epic {
  const nextRank = typeof epic.nextRank === 'string' && epic.nextRank ? epic.nextRank : null;
  return { ...epic, nextRank, inGlobalBacklog: nextRank !== null };
}

export function prismTaskToEpic(task: PrismTask, projectId: string, index: number): Epic {
  const fallbackId = `${projectId}-task-${index}-${String(task.text || 'untitled')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
  const nextRank = typeof task.nextRank === 'string' && task.nextRank ? task.nextRank : null;
  return {
    id: task.id || fallbackId,
    projectId,
    title: task.text || 'Untitled',
    description: task.abstract || '',
    prompt: task.prompt || '',
    objectives: task.prompt
      ? task.prompt.split('\n').map((line) => line.replace(/^- /, '').trim()).filter(Boolean)
      : [],
    done: Boolean(task.done),
    status: task.status || 'draft',
    impact: task.impact ?? 5,
    effort: task.effort ?? 5,
    created: task.created,
    rank: task.rank || rankForIndex(index),
    nextRank,
    inGlobalBacklog: nextRank !== null,
    version: task.version || 0,
    updatedAt: task.updatedAt,
  };
}

export function snapshotToEntities(streams: PrismStream[]) {
  const projects: Project[] = [];
  const epics: Epic[] = [];
  streams.forEach((stream, projectIndex) => {
    projects.push({
      id: stream.id,
      name: stream.name,
      description: stream.abstract || '',
      rank: stream.rank || rankForIndex(projectIndex),
      version: stream.version || 0,
      updatedAt: stream.updatedAt,
    });
    (stream.children || stream.tasks || []).forEach((task, taskIndex) => {
      epics.push(prismTaskToEpic(task, stream.id, taskIndex));
    });
  });
  return { projects, epics };
}

export function projectToPrism(project: Project) {
  return {
    id: project.id,
    name: project.name,
    type: 'Project',
    status: 'Active',
    abstract: project.description,
    rank: project.rank,
  };
}

export function epicToPrism(epic: Epic) {
  const normalized = normalizeEpic(epic);
  return {
    id: normalized.id,
    projectId: normalized.projectId,
    text: normalized.title,
    abstract: normalized.description,
    prompt: normalized.prompt || normalized.objectives.map((objective) => `- ${objective}`).join('\n'),
    done: Boolean(normalized.done),
    status: normalized.status || 'draft',
    impact: normalized.impact ?? 5,
    effort: normalized.effort ?? 5,
    created: normalized.created,
    rank: normalized.rank,
    nextRank: normalized.nextRank ?? null,
    inGlobalBacklog: normalized.nextRank !== null,
  };
}

export function stableValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableValue(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
