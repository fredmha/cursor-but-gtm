import React, { useEffect, useMemo, useState } from 'react';
import { Channel, Project, Priority, User } from '../types';
import { Icons } from '../constants';

export interface BulkDraftTask {
  id: string;
  title: string;
  description?: string;
  assigneeId?: string;
  priority?: Priority;
  channelId?: string;
  projectId?: string;
}

interface BulkTaskCalloutProps {
  origin: string;
  initialTasks: BulkDraftTask[];
  users: User[];
  channels: Channel[];
  projects: Project[];
  onApprove: (tasks: BulkDraftTask[]) => void;
  onDiscard: () => void;
  isLoading?: boolean;
}

const PRIORITY_OPTIONS: Priority[] = ['Urgent', 'High', 'Medium', 'Low', 'None'];

export const BulkTaskCallout: React.FC<BulkTaskCalloutProps> = ({
  origin,
  initialTasks,
  users,
  channels,
  projects,
  onApprove,
  onDiscard,
  isLoading
}) => {
  const [draftTasks, setDraftTasks] = useState<BulkDraftTask[]>(() => initialTasks);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(initialTasks.map(t => t.id)));
  const [isCommitted, setIsCommitted] = useState(false);

  useEffect(() => {
    setDraftTasks(initialTasks);
    setSelectedIds(new Set(initialTasks.map(t => t.id)));
    setIsCommitted(false);
  }, [initialTasks]);

  const selectedCount = selectedIds.size;
  const totalCount = draftTasks.length;
  const allSelected = totalCount > 0 && selectedCount === totalCount;

  const contextOptions = useMemo(() => {
    const projectOptions = projects.map(project => ({
      label: project.name,
      value: `project:${project.id}`
    }));
    const channelOptions = channels.map(channel => ({
      label: channel.name,
      value: `channel:${channel.id}`
    }));
    return { projectOptions, channelOptions };
  }, [channels, projects]);

  const handleToggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(draftTasks.map(t => t.id)));
  };

  const handleRowToggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUpdateTask = (id: string, updates: Partial<BulkDraftTask>) => {
    setDraftTasks(prev => prev.map(task => task.id === id ? { ...task, ...updates } : task));
  };

  const handleApprove = () => {
    if (isCommitted || isLoading) return;
    const selectedTasks = draftTasks.filter(task => selectedIds.has(task.id));
    if (selectedTasks.length === 0) return;
    setIsCommitted(true);
    onApprove(selectedTasks);
  };

  const handleDiscard = () => {
    if (isCommitted || isLoading) return;
    setIsCommitted(true);
    onDiscard();
  };

  return (
    <div className="my-6 border border-zinc-200 bg-white shadow-xl rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg border border-zinc-900 bg-white flex items-center justify-center shadow-sm">
            <Icons.Rows className="w-4 h-4 text-zinc-900" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Bulk Draft</span>
            <span className="text-sm font-serif font-medium text-zinc-900 tracking-tight">{origin || 'Transcript'}</span>
          </div>
        </div>
        <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-[0.2em]">{totalCount} items</span>
      </div>

      {isLoading ? (
        <div className="px-6 py-8 text-sm text-zinc-500 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-zinc-300 animate-bounce"></div>
          <div className="w-2 h-2 rounded-full bg-zinc-300 animate-bounce delay-75"></div>
          <div className="w-2 h-2 rounded-full bg-zinc-300 animate-bounce delay-150"></div>
          <span className="text-xs font-medium">Reading notes and extracting tasks...</span>
        </div>
      ) : (
        <>
          <div className="px-6 py-3 border-b border-zinc-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleToggleAll}
              className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-900"
            >
              {allSelected ? 'Clear Selection' : 'Select All'}
            </button>
            <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-[0.2em]">{selectedCount} selected</span>
          </div>

          <div className="divide-y divide-zinc-100">
            {draftTasks.map(task => {
              const isSelected = selectedIds.has(task.id);
              const contextValue = task.projectId
                ? `project:${task.projectId}`
                : task.channelId
                  ? `channel:${task.channelId}`
                  : '';
              return (
                <div key={task.id} className="px-6 py-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-zinc-500">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleRowToggle(task.id)}
                          className="accent-zinc-900"
                        />
                      </label>
                      <input
                        value={task.title}
                        onChange={(e) => handleUpdateTask(task.id, { title: e.target.value })}
                        className="flex-1 min-w-[200px] bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="Task title"
                      />
                      <select
                        value={task.assigneeId || ''}
                        onChange={(e) => handleUpdateTask(task.id, { assigneeId: e.target.value || undefined })}
                        className="min-w-[140px] bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="">Unassigned</option>
                        {users.map(user => (
                          <option key={user.id} value={user.id}>{user.name}</option>
                        ))}
                      </select>
                      <select
                        value={task.priority || 'Medium'}
                        onChange={(e) => handleUpdateTask(task.id, { priority: e.target.value as Priority })}
                        className="min-w-[110px] bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        {PRIORITY_OPTIONS.map(priority => (
                          <option key={priority} value={priority}>{priority}</option>
                        ))}
                      </select>
                      <select
                        value={contextValue}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (!value) {
                            handleUpdateTask(task.id, { channelId: undefined, projectId: undefined });
                            return;
                          }
                          const [type, id] = value.split(':');
                          if (type === 'project') {
                            handleUpdateTask(task.id, { projectId: id, channelId: undefined });
                          } else {
                            handleUpdateTask(task.id, { channelId: id, projectId: undefined });
                          }
                        }}
                        className="min-w-[160px] bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="">Select context</option>
                        {contextOptions.projectOptions.length > 0 && (
                          <optgroup label="Projects">
                            {contextOptions.projectOptions.map(option => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </optgroup>
                        )}
                        {contextOptions.channelOptions.length > 0 && (
                          <optgroup label="Channels">
                            {contextOptions.channelOptions.map(option => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                    <textarea
                      value={task.description || ''}
                      onChange={(e) => handleUpdateTask(task.id, { description: e.target.value })}
                      placeholder="Notes or details (optional)"
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-6 py-4 border-t border-zinc-100 bg-white flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              Tip: use /plan to turn notes into tasks faster next time.
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDiscard}
                className="px-3 py-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-900 bg-zinc-100 rounded-md"
              >
                Discard
              </button>
              <button
                onClick={handleApprove}
                disabled={selectedCount === 0 || isCommitted}
                className="px-4 py-1.5 text-xs font-bold text-white bg-zinc-900 rounded-md shadow-sm hover:bg-zinc-800 disabled:opacity-50"
              >
                Approve Selected
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
