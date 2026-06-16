import React, { useState } from 'react';
import { useEntityStore, type Project, type Epic } from '../stores/entityStore';
import { useNavigationStore } from '../stores/navigationStore';
import { ArrowLeft, GripVertical, Plus, CheckCircle2 } from 'lucide-react';
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

const SortableProjectCard: React.FC<{ project: Project; onSelect: (id: string) => void; epicCount: number }> = ({ project, onSelect, epicCount }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(project.id)}
      className={`relative flex items-center p-4 mb-3 rounded-xl border cursor-pointer ${
        isDragging ? 'border-primary shadow-[0_0_15px_hsl(var(--primary)/0.3)] bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
      } transition-colors group`}
    >
      <div 
        {...attributes} 
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="px-2 text-muted-foreground hover:text-white cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={20} />
      </div>
      <div className="flex-1 px-4">
        <h3 className="text-xl font-medium text-white mb-1 group-hover:text-primary transition-colors">{project.name}</h3>
        <p className="text-sm text-muted-foreground">{epicCount} Epics</p>
      </div>
    </div>
  );
};

const SortableProjectEpic: React.FC<{ epic: Epic; onSelect: (id: string) => void; onAdd: (id: string) => void }> = ({ epic, onSelect, onAdd }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: epic.id });
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
      <div {...attributes} {...listeners} onClick={e => e.stopPropagation()} className="px-2 text-muted-foreground hover:text-white cursor-grab active:cursor-grabbing">
        <GripVertical size={16} />
      </div>
      <div className="flex-1 px-2">
        <h4 className="text-sm font-medium text-white">{epic.title}</h4>
      </div>
      <div className="px-2">
        {epic.inGlobalBacklog ? (
          <div className="flex items-center text-xs text-green-400 font-mono" title="In Global Backlog">
            <CheckCircle2 size={16} className="mr-1" />
            BACKLOG
          </div>
        ) : (
          <button 
            onClick={(e) => { e.stopPropagation(); onAdd(epic.id); }}
            className="flex items-center px-3 py-1 rounded bg-white/10 hover:bg-primary/20 hover:text-primary text-xs text-white transition-colors border border-white/10 hover:border-primary/50"
          >
            <Plus size={14} className="mr-1" /> Add to Backlog
          </button>
        )}
      </div>
    </div>
  );
};

export const ProjectsView: React.FC = () => {
  const { projects, setProjects, epics, setEpics } = useEntityStore();
  const { setSelectedEpicDetailId } = useNavigationStore();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const addToGlobalBacklog = (id: string) => {
    setEpics(epics.map(e => e.id === id ? { ...e, inGlobalBacklog: true } : e));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleProjectDragEnd = (event: DragEndEvent) => {
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
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setEpics((() => {
        const oldIndex = epics.findIndex(i => i.id === active.id);
        const newIndex = epics.findIndex(i => i.id === over.id);
        return arrayMove(epics, oldIndex, newIndex);
      })());
    }
  };

  if (selectedProjectId) {
    const project = projects.find(p => p.id === selectedProjectId);
    const projectEpics = epics.filter(e => e.projectId === selectedProjectId);

    return (
      <div className="flex flex-col h-full w-full max-w-3xl mx-auto p-6">
        <header className="mb-6 flex items-center pt-4">
          <button onClick={() => setSelectedProjectId(null)} className="p-2 mr-2 rounded-full hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white leading-tight">{project?.name}</h2>
            <p className="text-xs text-muted-foreground mt-1">{project?.description}</p>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto pb-24 no-scrollbar">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleEpicDragEnd}>
            <SortableContext items={projectEpics.map(e => e.id)} strategy={verticalListSortingStrategy}>
              {projectEpics.map(epic => (
                <SortableProjectEpic 
                  key={epic.id} 
                  epic={epic} 
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
        <p className="text-muted-foreground">Reorder projects or select one to manage its To-Do Epics.</p>
      </header>
      
      <div className="flex-1 overflow-y-auto pr-2 no-scrollbar">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleProjectDragEnd}>
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
