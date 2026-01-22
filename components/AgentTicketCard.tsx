
import React from 'react';
import { Icons, PRIORITIES } from '../constants';

interface AgentTicketCardProps {
  actionId: string;
  args: {
    title: string;
    description?: string;
    priority?: string;
    channelId?: string;
    projectId?: string;
  };
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  contextName: string;
  onUpdate: (updates: any) => void;
  onApprove: () => void;
  onReject: () => void;
}

const COLOR_MAP: Record<string, string> = {
  'Urgent': 'bg-red-50 text-red-600 border-red-100',
  'High': 'bg-orange-50 text-orange-600 border-orange-100',
  'Medium': 'bg-blue-50 text-blue-600 border-blue-100',
  'Low': 'bg-zinc-50 text-zinc-600 border-zinc-100',
  'None': 'bg-zinc-50 text-zinc-400 border-zinc-100'
};

export const AgentTicketCard: React.FC<AgentTicketCardProps> = ({
  args,
  status,
  contextName,
  onUpdate,
  onApprove,
  onReject
}) => {
  const isPending = status === 'PENDING';

  return (
    <div className="w-full my-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Micro-Modal Container */}
      <div className={`bg-white border border-zinc-100 shadow-xl shadow-zinc-200/50 rounded-2xl overflow-hidden relative transition-all ${!isPending ? 'opacity-70 grayscale-[0.5]' : ''}`}>
        
        {/* Header: Meta Data */}
        <div className="px-5 py-3 border-b border-zinc-50 bg-zinc-50/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-white border border-zinc-200 flex items-center justify-center text-zinc-400 shadow-sm">
              <Icons.Sparkles className="w-3 h-3" />
            </div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Proposed Ticket
            </span>
          </div>

          {/* Context & Priority Badges */}
          <div className="flex items-center gap-2">
             <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white border border-zinc-100 shadow-sm">
                <Icons.Target className="w-3 h-3 text-zinc-400" />
                <span className="text-[10px] font-semibold text-zinc-600 truncate max-w-[100px]">
                    {contextName}
                </span>
             </div>
             
             {/* Priority Selector */}
             {isPending ? (
                 <div className="flex bg-white border border-zinc-100 rounded-md p-0.5 shadow-sm">
                    {PRIORITIES.map(p => (
                        <button
                            key={p.value}
                            onClick={() => onUpdate({ priority: p.value })}
                            className={`w-4 h-4 rounded flex items-center justify-center transition-all ${
                                args.priority === p.value 
                                ? `${p.color.replace('text-', 'bg-')} text-white shadow-sm` 
                                : 'text-zinc-300 hover:text-zinc-400'
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

        {/* Body: Content */}
        <div className="p-5">
           <input 
              disabled={!isPending}
              value={args.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              className="w-full text-lg font-semibold text-zinc-900 placeholder-zinc-300 border-none p-0 focus:ring-0 bg-transparent mb-2"
              placeholder="Task Title"
           />
           <textarea
              disabled={!isPending}
              value={args.description || ''}
              onChange={(e) => onUpdate({ description: e.target.value })}
              className="w-full text-sm text-zinc-500 placeholder-zinc-300 border-none p-0 focus:ring-0 bg-transparent resize-none leading-relaxed"
              placeholder="Add details..."
              rows={2}
           />
        </div>

        {/* Footer: Actions */}
        {isPending ? (
            <div className="px-5 py-4 border-t border-zinc-50 bg-zinc-50/30 flex justify-end gap-3">
                <button 
                    onClick={onReject}
                    className="px-4 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                    Dismiss
                </button>
                <button 
                    onClick={onApprove}
                    className="px-6 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-lg shadow-lg shadow-zinc-200 transition-all hover:scale-105 active:scale-95"
                >
                    Approve Ticket
                </button>
            </div>
        ) : (
            <div className="absolute top-1/2 right-5 -translate-y-1/2 pointer-events-none">
                {status === 'APPROVED' ? (
                     <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm animate-in zoom-in duration-300">
                        <Icons.CheckCircle className="w-6 h-6" />
                     </div>
                ) : (
                    <div className="px-3 py-1 bg-zinc-100 rounded-full text-[10px] font-bold text-zinc-400 border border-zinc-200">
                        REJECTED
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};
