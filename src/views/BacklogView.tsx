import React from 'react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
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
import { useNavigationStore } from '../stores/navigationStore';
import { Play, GripVertical } from 'lucide-react';

const SortableEpicCard: React.FC<{ epic: Epic; projectName: string; onGo: (id: string) => void; onSelect: (id: string) => void }> = ({ epic, projectName, onGo, onSelect }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: epic.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(epic.id)}
      className={`relative flex items-stretch p-4 mb-3 rounded-xl border cursor-pointer ${
        isDragging ? 'border-primary shadow-[0_0_15px_hsl(var(--primary)/0.3)] bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
      } backdrop-blur-sm group transition-colors`}
    >
      <div 
        {...attributes} 
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="flex items-center justify-center px-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-white"
      >
        <GripVertical size={20} />
      </div>
      
      <div className="flex-1 px-4">
        <div className="text-[10px] font-mono text-primary uppercase tracking-widest mb-1">
          {projectName}
        </div>
        <h3 className="text-lg font-medium text-white mb-1 leading-tight">{epic.title}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2">{epic.description}</p>
      </div>

      <div className="flex items-center justify-center pl-4 border-l border-white/10">
        <button 
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
  const { epics, setEpics, projects } = useEntityStore();
  const { setActiveEpicId, setSelectedEpicDetailId } = useNavigationStore();

  const backlogEpics = epics.filter(e => e.inGlobalBacklog);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      // Reorder only within backlog epics, then merge back into full array
      const oldIndex = backlogEpics.findIndex(i => i.id === active.id);
      const newIndex = backlogEpics.findIndex(i => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      
      const reordered = arrayMove(backlogEpics, oldIndex, newIndex);
      // Rebuild full epics: non-backlog epics stay in place, backlog epics use new order
      const nonBacklog = epics.filter(e => !e.inGlobalBacklog);
      setEpics([...nonBacklog, ...reordered]);
    }
  };

  return (
    <div className="flex flex-col h-full p-6 pb-24 max-w-3xl mx-auto w-full">
      <header className="mb-8 pt-4">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Global Backlog</h1>
        <p className="text-muted-foreground">Drag to prioritize. Click to view details. Press Play to initiate.</p>
      </header>
      
      <div className="flex-1 overflow-y-auto pr-2 pb-20 no-scrollbar">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={backlogEpics.map(e => e.id)}
            strategy={verticalListSortingStrategy}
          >
            {backlogEpics.map(epic => (
              <SortableEpicCard 
                key={epic.id} 
                epic={epic} 
                projectName={projects.find(p => p.id === epic.projectId)?.name || 'Unknown Project'}
                onGo={setActiveEpicId} 
                onSelect={setSelectedEpicDetailId} 
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};
