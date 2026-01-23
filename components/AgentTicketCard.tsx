
import React from 'react';
import { Icons, PRIORITIES } from '../constants';
import { User, Channel, Project } from '../types';

interface AgentTicketCardProps {
  actionId: string;
  args: {
    title: string;
    description?: string;
    priority?: string;
    channelId?: string;
    projectId?: string;
    assigneeId?: string;
  };
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  users: User[];
  channels: Channel[];
  projects: Project[];
  onUpdate: (updates: any) => void;
  onApprove: () => void;
  onReject: () => void;
}

const COLOR_MAP: Record<string, string> = {
  'Urgent': 'text-red-600 bg-red-50 border-red-100',
  'High': 'text-orange-600 bg-orange-50 border-orange-100',
  'Medium': 'text-blue-600 bg-blue-50 border-blue-100',
  'Low': 'text-zinc-600 bg-zinc-50 border-zinc-100',
  'None': 'text-zinc-400 bg-zinc-50 border-zinc-100'
};

export const AgentTicketCard: React.FC<AgentTicketCardProps> = ({
  args,
  status,
  users,
  channels,
  projects,
  onUpdate,
  onApprove,
  onReject
}) => {
  const isPending = status === 'PENDING';
  
  // Resolve current values
  const currentContextId = args.projectId || args.channelId || '';
  const currentAssignee = users.find(u => u.id === args.assigneeId);

  const handleContextChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      const isProject = projects.some(p => p.id === val);
      if (isProject) {
          onUpdate({ projectId: val, channelId: undefined });
      } else {
          onUpdate({ channelId: val, projectId: undefined });
      }
  };

  return (
    <div className="w-full my-6 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
      {/* Micro-Modal Container */}
      <div className={`bg-white border border-zinc-200 shadow-lg shadow-zinc-100 rounded-xl overflow-hidden relative transition-all ${!isPending ? 'opacity-70 grayscale-[0.5]' : ''}`}>
        
        {/* Header: Label */}
        <div className="px-4 py-2 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-white border border-zinc-200 flex items-center justify-center text-zinc-400 shadow-sm">
              <Icons.Sparkles className="w-3 h-3" />
            </div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Proposed Ticket
            </span>
          </div>
        </div>

        {/* Body: Inputs */}
        <div className="p-4 space-y-3">
           <input 
              disabled={!isPending}
              value={args.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              className="w-full text-sm font-bold text-zinc-900 placeholder-zinc-300 border-none p-0 focus:ring-0 bg-transparent"
              placeholder="Task Title"
           />
           <textarea
              disabled={!isPending}
              value={args.description || ''}
              onChange={(e) => onUpdate({ description: e.target.value })}
              className="w-full text-xs text-zinc-500 placeholder-zinc-300 border-none p-0 focus:ring-0 bg-transparent resize-none leading-relaxed"
              placeholder="Add details..."
              rows={2}
           />
        </div>

        {/* Control Bar (Context | Assignee | Priority) */}
        <div className="px-4 py-3 bg-zinc-50 border-t border-zinc-100 flex items-center gap-2">
            
            {/* Context Selector */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 bg-white border border-zinc-200 rounded-md px-2 py-1 shadow-sm">
                    <Icons.Target className="w-3 h-3 text-zinc-400 shrink-0" />
                    <select
                        disabled={!isPending}
                        value={currentContextId}
                        onChange={handleContextChange}
                        className="bg-transparent text-[10px] font-medium text-zinc-600 focus:outline-none w-full cursor-pointer disabled:cursor-default"
                    >
                        <option value="" disabled>Select Context</option>
                        <optgroup label="Projects">
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </optgroup>
                        <optgroup label="Channels">
                            {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </optgroup>
                    </select>
                </div>
            </div>

            {/* Assignee Selector */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 bg-white border border-zinc-200 rounded-md px-2 py-1 shadow-sm">
                    {currentAssignee ? (
                        <div className={`w-3 h-3 rounded-full ${currentAssignee.color} shrink-0`} />
                    ) : (
                        <div className="w-3 h-3 rounded-full bg-zinc-200 shrink-0" />
                    )}
                    <select
                        disabled={!isPending}
                        value={args.assigneeId || ''}
                        onChange={(e) => onUpdate({ assigneeId: e.target.value })}
                        className="bg-transparent text-[10px] font-medium text-zinc-600 focus:outline-none w-full cursor-pointer disabled:cursor-default"
                    >
                        <option value="">Unassigned</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Priority Selector */}
            <div className="shrink-0">
                 {isPending ? (
                     <div className="flex bg-white border border-zinc-200 rounded-md p-0.5 shadow-sm">
                        {PRIORITIES.map(p => (
                            <button
                                key={p.value}
                                onClick={() => onUpdate({ priority: p.value })}
                                className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                                    args.priority === p.value 
                                    ? `${p.color.replace('text-', 'bg-')} text-white shadow-sm` 
                                    : 'text-zinc-300 hover:text-zinc-400 hover:bg-zinc-50'
                                }`}
                                title={p.value}
                            >
                                <div className={`w-1.5 h-1.5 rounded-full ${args.priority === p.value ? 'bg-white' : 'bg-current'}`} />
                            </button>
                        ))}
                     </div>
                 ) : (
                    <div className={`px-2 py-1 rounded-md border text-[10px] font-bold uppercase shadow-sm ${COLOR_MAP[args.priority || 'Medium']}`}>
                        {args.priority}
                    </div>
                 )}
            </div>
        </div>

        {/* Footer: Actions */}
        {isPending ? (
            <div className="px-4 py-3 border-t border-zinc-100 bg-white flex justify-end gap-3">
                <button 
                    onClick={onReject}
                    className="px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                    Dismiss
                </button>
                <button 
                    onClick={onApprove}
                    disabled={!currentContextId}
                    className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-lg shadow-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                    Approve Ticket
                </button>
            </div>
        ) : (
            <div className="absolute top-3 right-4 pointer-events-none">
                {status === 'APPROVED' ? (
                     <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 text-[10px] font-bold uppercase tracking-wider">
                        <Icons.CheckCircle className="w-3 h-3" /> Approved
                     </div>
                ) : (
                    <div className="flex items-center gap-1.5 text-zinc-400 bg-zinc-100 px-2 py-1 rounded-md border border-zinc-200 text-[10px] font-bold uppercase tracking-wider">
                        Rejected
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};
