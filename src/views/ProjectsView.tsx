import React, { useState, useEffect } from 'react';
import { useEntityStore, type Project, type Epic } from '../stores/entityStore';
import { useNavigationStore } from '../stores/navigationStore';
import { isEpicInNext, rankForIndex } from '../sync/contract';
import { ArrowLeft, GripVertical, Plus, CheckCircle2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '../dnd/modifiers';

const SortableProjectCard: React.FC<{ project: Project; onSelect: (id: string) => void; epicCount: number }> = ({ project, onSelect, epicCount }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });
  const projectColor = project.color || '#6b7280';

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      data-project-id={project.id}
      style={style}
      onClick={() => onSelect(project.id)}
      className={`relative flex items-center p-4 mb-3 rounded-xl border cursor-pointer ${
        isDragging ? 'border-primary shadow-[0_0_15px_hsl(var(--primary)/0.3)] bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
      } transition-colors group`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${project.name}`}
        data-drag-handle="true"
        onClick={(e) => e.stopPropagation()}
        style={{ touchAction: 'none' }}
        className="flex min-h-11 min-w-11 items-center justify-center px-2 text-muted-foreground hover:text-white cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={20} />
      </button>
      {/* Color bar */}
      <div className="w-1 h-10 rounded-full mr-3 flex-shrink-0" style={{ backgroundColor: projectColor }} />
      <div className="flex-1 px-2">
        <h3 className="text-xl font-medium mb-1 group-hover:opacity-80 transition-opacity" style={{ color: projectColor }}>{project.name}</h3>
        <p className="text-sm text-muted-foreground">{epicCount} Tasks</p>
      </div>
    </div>
  );
};

const SortableProjectEpic: React.FC<{ epic: Epic; projectColor: string; onSelect: (id: string) => void; onAdd: (id: string) => void }> = ({ epic, projectColor, onSelect, onAdd }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: epic.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(epic.id)}
      className={`relative flex items-center p-3 mb-2 rounded-lg border cursor-pointer ${
        isDragging ? 'border-primary bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
      } transition-colors`}
    >
      <div className="w-1 self-stretch rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: projectColor }} />
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${epic.title}`}
        data-drag-handle="true"
        onClick={e => e.stopPropagation()}
        style={{ touchAction: 'none' }}
        className="flex min-h-11 min-w-11 items-center justify-center px-2 text-muted-foreground hover:text-white cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={16} />
      </button>
      <div className="flex-1 px-2">
        <h4 className="text-sm font-medium text-white">{epic.title}</h4>
      </div>
      <div className="px-2">
        {isEpicInNext(epic) ? (
          <div className="flex items-center text-xs text-green-400 font-mono" title="In Next">
            <CheckCircle2 size={16} className="mr-1" />
            NEXT
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(epic.id); }}
            className="flex items-center px-3 py-1 rounded bg-white/10 hover:bg-primary/20 hover:text-primary text-xs text-white transition-colors border border-white/10 hover:border-primary/50"
          >
            <Plus size={14} className="mr-1" /> Add to Next
          </button>
        )}
      </div>
    </div>
  );
};

export const ProjectsView: React.FC = () => {
  const { projects, setProjects, epics, setEpics, _hasHydrated } = useEntityStore();
  const { setSelectedEpicDetailId, setCardDragActive } = useNavigationStore();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (_hasHydrated) {
      // Give SyncManager a tick to complete its fetch
      const timer = setTimeout(() => setIsReady(true), 300);
      return () => clearTimeout(timer);
    }
  }, [_hasHydrated]);

  if (_hasHydrated && !isReady) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mb-4" />
        <p className="text-sm">Syncing with Prism&hellip;</p>
      </div>
    );
  }

  if (!_hasHydrated) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mb-4" />
        <p className="text-sm">Loading&hellip;</p>
      </div>
    );
  }

  const addToGlobalBacklog = (id: string) => {
    const nextCount = epics.filter(isEpicInNext).length;
    setEpics(epics.map(e => e.id === id
      ? { ...e, nextRank: rankForIndex(nextCount), inGlobalBacklog: true }
      : e));
  };

  const handleProjectDragEnd = (event: DragEndEvent) => {
    setCardDragActive(false);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setProjects((() => {
        const oldIndex = projects.findIndex(i => i.id === active.id);
        const newIndex = projects.findIndex(i => i.id === over.id);
        return arrayMove(projects, oldIndex, newIndex);
      })());
    }
  };

  const handleEpicDragEnd = (event: DragEndEvent) => {
    setCardDragActive(false);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const projectEpics = epics.filter(e => e.projectId === selectedProjectId);
      const oldIndex = projectEpics.findIndex(i => i.id === active.id);
      const newIndex = projectEpics.findIndex(i => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reorderedProjectEpics = arrayMove(projectEpics, oldIndex, newIndex);
      let projectEpicIndex = 0;
      setEpics(epics.map((epic) => {
        if (epic.projectId !== selectedProjectId) return epic;
        const reordered = reorderedProjectEpics[projectEpicIndex];
        projectEpicIndex += 1;
        return reordered;
      }));
    }
  };

  if (selectedProjectId) {
    const project = projects.find(p => p.id === selectedProjectId);
    const projectEpics = epics.filter(e => e.projectId === selectedProjectId);

    return (
      <div className="flex flex-col h-full w-full max-w-3xl mx-auto p-6">
        <header className="mb-6 flex items-center justify-between pt-4">
          <div className="flex items-center">
            <button onClick={() => setSelectedProjectId(null)} className="p-2 mr-2 rounded-full hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-2xl font-bold leading-tight" style={{ color: project?.color || '#ffffff' }}>{project?.name}</h2>
              <p className="text-xs text-muted-foreground mt-1">{project?.description}</p>
            </div>
          </div>
          <button
            onClick={() => {
              const newId = `new-epic-${Date.now()}`;
              setEpics([...epics, {
                id: newId,
                projectId: selectedProjectId,
                title: 'New Task',
                description: '',
                prompt: '',
                objectives: [],
                done: false,
                status: 'draft',
                impact: 5,
                effort: 5,
                created: new Date().toISOString(),
                nextRank: null,
                inGlobalBacklog: false
              }]);
              setSelectedEpicDetailId(newId);
            }}
            className="flex items-center px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-colors"
          >
            <Plus size={18} className="mr-1" /> Add Task
          </button>
        </header>

        <div className="flex-1 overflow-y-auto pb-24 no-scrollbar">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragStart={() => setCardDragActive(true)}
            onDragEnd={handleEpicDragEnd}
            onDragCancel={() => setCardDragActive(false)}
          >
            <SortableContext items={projectEpics.map(e => e.id)} strategy={verticalListSortingStrategy}>
              {projectEpics.map(epic => (
                <SortableProjectEpic
                  key={epic.id}
                  epic={epic}
                  projectColor={project?.color || '#6b7280'}
                  onSelect={setSelectedEpicDetailId}
                  onAdd={addToGlobalBacklog}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6 pb-24 max-w-3xl mx-auto w-full">
      <header className="mb-8 pt-4">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Projects</h1>
        <p className="text-muted-foreground">Reorder projects or select one to manage its tasks.</p>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={() => setCardDragActive(true)}
          onDragEnd={handleProjectDragEnd}
          onDragCancel={() => setCardDragActive(false)}
        >
          <SortableContext items={projects.map(p => p.id)} strategy={verticalListSortingStrategy}>
            {projects.map((p) => (
              <SortableProjectCard
                key={p.id}
                project={p}
                onSelect={setSelectedProjectId}
                epicCount={epics.filter(e => e.projectId === p.id).length}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};
