import React, { useState } from 'react';
import { useEntityStore, type Epic, type Project } from '../stores/entityStore';
import { useNavigationStore } from '../stores/navigationStore';
import { X, Edit2, Save } from 'lucide-react';

type TaskDetailDialogProps = {
  epic: Epic;
  project: Project | undefined;
  onSave: (epic: Epic) => void;
  onClose: () => void;
};

const TaskDetailDialog: React.FC<TaskDetailDialogProps> = ({ epic, project, onSave, onClose }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedEpic, setEditedEpic] = useState(epic);
  const projectName = project?.name || 'Unknown Project';

  const handleSave = () => {
    onSave(editedEpic);
    setIsEditing(false);
  };

  const handleObjectivesChange = (text: string) => {
    const objectives = text.split('\n').filter(line => line.trim().length > 0);
    setEditedEpic({ ...editedEpic, objectives, prompt: objectives.map((objective) => `- ${objective}`).join('\n') });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Task detail"
      className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex flex-col p-6 animate-in fade-in slide-in-from-bottom-8 duration-300"
    >
      <div className="max-w-3xl w-full mx-auto flex flex-col h-full">
        <header className="flex justify-between items-start mb-8 pt-8">
          <div className="flex-1 mr-8">
            <div className="text-xs font-mono text-primary uppercase tracking-widest mb-2">
              Task detail · {projectName}
            </div>
            {isEditing ? (
              <input
                type="text"
                value={editedEpic.title}
                onChange={e => setEditedEpic({ ...editedEpic, title: e.target.value })}
                className="w-full text-3xl font-bold text-white leading-tight bg-white/5 border border-primary/50 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            ) : (
              <h1 className="text-3xl font-bold text-white leading-tight">{editedEpic.title}</h1>
            )}
          </div>

          <div className="flex gap-2">
            {isEditing ? (
              <button
                onClick={handleSave}
                className="flex items-center px-4 py-2 rounded-full bg-primary hover:bg-primary/90 text-white transition-colors glow-border shadow-[0_0_15px_hsl(var(--primary)/0.4)]"
              >
                <Save size={18} className="mr-2" /> Save
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <Edit2 size={18} className="mr-2" /> Edit
              </button>
            )}

            <button
              aria-label="Close task detail"
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto space-y-8 pb-20 no-scrollbar pr-2">
          <section>
            <h3 className="text-sm font-medium text-white mb-2 uppercase tracking-wide border-b border-white/10 pb-2">Abstract</h3>
            {isEditing ? (
              <textarea
                value={editedEpic.description}
                onChange={e => setEditedEpic({ ...editedEpic, description: e.target.value })}
                className="w-full h-32 text-lg text-white leading-relaxed bg-white/5 border border-primary/50 rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            ) : (
              <p className="text-muted-foreground leading-relaxed text-lg">
                {editedEpic.description}
              </p>
            )}
          </section>

          <section>
            <h3 className="text-sm font-medium text-white mb-4 uppercase tracking-wide border-b border-white/10 pb-2">Prompt & Outcomes</h3>
            {isEditing ? (
              <textarea
                value={editedEpic.objectives.join('\n')}
                onChange={e => handleObjectivesChange(e.target.value)}
                placeholder="Enter each outcome on a new line..."
                className="w-full h-48 font-mono text-sm text-white bg-white/5 border border-primary/50 rounded-xl p-4 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            ) : (
              <div className="p-6 bg-white/5 border border-white/10 rounded-xl font-mono text-sm shadow-inner">
                <ul className="space-y-4">
                  {editedEpic.objectives.map((obj, i) => (
                    <li key={i} className="flex items-start">
                      <span className="text-primary mr-3">{'>'}</span>
                      <span className="text-white/80">{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export const EpicDetailView: React.FC = () => {
  const { epics, updateEpic, projects } = useEntityStore();
  const { selectedEpicDetailId, setSelectedEpicDetailId } = useNavigationStore();
  const selectedEpicDetail = epics.find(e => e.id === selectedEpicDetailId);

  if (!selectedEpicDetail) return null;

  return (
    <TaskDetailDialog
      key={selectedEpicDetail.id}
      epic={selectedEpicDetail}
      project={projects.find(p => p.id === selectedEpicDetail.projectId)}
      onSave={updateEpic}
      onClose={() => setSelectedEpicDetailId(null)}
    />
  );
};
