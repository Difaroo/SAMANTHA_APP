import React from 'react';
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
import { useEntityStore, type Epic } from '../stores/entityStore';
import { isEpicInNext, rankForIndex } from '../sync/contract';
import { useNavigationStore } from '../stores/navigationStore';
import { Play, GripVertical } from 'lucide-react';
import { restrictToVerticalAxis } from '../dnd/modifiers';

const SortableEpicCard: React.FC<{ epic: Epic; projectName: string; projectColor: string; onGo: (id: string) => void; onSelect: (id: string) => void }> = ({ epic, projectName, projectColor, onGo, onSelect }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    setActivatorNodeRef,
  } = useSortable({ id: epic.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      data-task-id={epic.id}
      style={style}
      onClick={() => onSelect(epic.id)}
      className={`relative flex items-stretch p-4 mb-3 rounded-xl border cursor-pointer ${
        isDragging ? 'border-primary shadow-[0_0_15px_hsl(var(--primary)/0.3)] bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
      } backdrop-blur-sm group transition-colors`}
    >
      {/* Color bar */}
      <div className="w-1 self-stretch rounded-full mr-3 flex-shrink-0" style={{ backgroundColor: projectColor }} />

      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes} 
        {...listeners}
        aria-label={`Drag ${epic.title}`}
        data-drag-handle="true"
        onClick={(e) => e.stopPropagation()}
        style={{ touchAction: 'none' }}
        className="flex min-h-11 min-w-11 items-center justify-center px-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-white"
      >
        <GripVertical size={20} />
      </button>
      
      <div className="flex-1 px-4">
        <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: projectColor }}>
          {projectName}
        </div>
        <h3 className="text-lg font-medium text-white mb-1 leading-tight">{epic.title}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2">{epic.description}</p>
      </div>

      <div className="flex items-center justify-center pl-4 border-l border-white/10">
        <button
          aria-label={`Start ${epic.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onGo(epic.id);
          }}
          className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 text-primary hover:bg-primary hover:text-white transition-all glow-border hover:shadow-[0_0_15px_hsl(var(--primary)/0.6)]"
        >
          <Play size={20} className="ml-1" />
        </button>
      </div>
    </div>
  );
};

export const BacklogView: React.FC = () => {
  const { epics, setEpics, projects, _hasHydrated } = useEntityStore();
  const { setActiveEpicId, setSelectedEpicDetailId, setCardDragActive } = useNavigationStore();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (!_hasHydrated) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mb-4" />
        <p className="text-sm">Loading&hellip;</p>
      </div>
    );
  }

  const nextTasks = epics
    .filter(isEpicInNext)
    .sort((a, b) => String(a.nextRank).localeCompare(String(b.nextRank)));

  const handleDragEnd = (event: DragEndEvent) => {
    setCardDragActive(false);
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = nextTasks.findIndex(i => i.id === active.id);
      const newIndex = nextTasks.findIndex(i => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      
      const reordered = arrayMove(nextTasks, oldIndex, newIndex);
      const nextRanks = new Map(reordered.map((epic, index) => [epic.id, rankForIndex(index)]));
      setEpics(epics.map((epic) => nextRanks.has(epic.id)
        ? { ...epic, nextRank: nextRanks.get(epic.id), inGlobalBacklog: true }
        : epic));
    }
  };

  return (
    <div data-testid="next-view" className="flex flex-col h-full p-6 pb-24 max-w-3xl mx-auto w-full">
      <header className="mb-8 pt-4">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Next</h1>
        <p className="text-muted-foreground">Drag to prioritize. Click for task detail. Press Play to initiate.</p>
      </header>
      
      <div className="flex-1 overflow-y-auto pb-20 no-scrollbar">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={() => setCardDragActive(true)}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setCardDragActive(false)}
        >
          <SortableContext 
            items={nextTasks.map(e => e.id)}
            strategy={verticalListSortingStrategy}
          >
            {nextTasks.map(epic => {
              const project = projects.find(p => p.id === epic.projectId);
              return (
                <SortableEpicCard
                  key={epic.id}
                  epic={epic}
                  projectName={project?.name || 'Unknown Project'}
                  projectColor={project?.color || '#6b7280'}
                  onGo={setActiveEpicId}
                  onSelect={setSelectedEpicDetailId}
                />
              );
            })}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};
