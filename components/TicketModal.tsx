
import React, { useState, useMemo, useEffect } from 'react';
import { Icons, PRIORITIES } from '../constants';
import { User, Project, Channel, Priority, TicketStatus } from '../types';

interface TicketModalProps {
    initialData?: {
        id?: string;
        title?: string;
        description?: string;
        status?: string;
        priority?: Priority;
        assigneeId?: string;
        channelId?: string;
        betId?: string;
        projectId?: string;
        durationWeeks?: number;
    };
    context: {
        channels: Channel[];
        projects: Project[];
        users: User[];
    };
    onClose: () => void;
    onSave: (data: any) => void;
    onDelete?: (id: string) => void;
}

export const TicketModal: React.FC<TicketModalProps> = ({ initialData, context, onClose, onSave, onDelete }) => {
    const { channels, projects, users } = context;
    
    // Form State
    const [title, setTitle] = useState(initialData?.title || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [priority, setPriority] = useState<Priority>(initialData?.priority || 'Medium');
    const [assigneeId, setAssigneeId] = useState<string>(initialData?.assigneeId || '');
    
    // Context State
    const [channelId, setChannelId] = useState<string>(initialData?.channelId || '');
    const [betId, setBetId] = useState<string>(initialData?.betId || '');
    const [projectId, setProjectId] = useState<string>(initialData?.projectId || '');
    
    // Roadmap Specific
    const [durationWeeks, setDurationWeeks] = useState<number>(initialData?.durationWeeks || 1);

    // Derived State
    const availableBets = useMemo(() => {
        if (!channelId) return [];
        const channel = channels.find(c => c.id === channelId);
        return channel ? channel.bets : [];
    }, [channelId, channels]);

    // Handlers
    const handleChannelChange = (newChannelId: string) => {
        setChannelId(newChannelId);
        setBetId(''); // Clear bet when channel changes
        // Optionally clear project if it was inherited from a bet? No, keep project separate.
    };

    const handleBetChange = (newBetId: string) => {
        setBetId(newBetId);
        // Auto-inherit project from bet if available and project not manually set
        const bet = availableBets.find(b => b.id === newBetId);
        if (bet && bet.projectId) {
            setProjectId(bet.projectId);
        }
    };

    const isFormValid = () => {
        if (!title.trim()) return false;
        return true;
    };

    const handleSave = () => {
        const data = {
            id: initialData?.id,
            title,
            description,
            priority,
            assigneeId,
            channelId: channelId || undefined,
            betId: betId || undefined, // Normalize empty string to undefined
            projectId: projectId || undefined,
            durationWeeks
        };
        onSave(data);
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={onClose}></div>
            <div className="w-[600px] bg-[#09090b] border border-zinc-800 rounded-xl shadow-2xl flex flex-col relative overflow-hidden ring-1 ring-white/10 z-10 max-h-[90vh]">
                
                {/* Header */}
                <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 shrink-0">
                    <div className="flex items-center gap-2">
                        <Icons.Target className="w-4 h-4 text-indigo-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-white">Execution Task</span>
                    </div>
                    <button onClick={onClose}><Icons.XCircle className="w-5 h-5 text-zinc-500 hover:text-white transition-colors"/></button>
                </div>

                {/* Scrollable Body */}
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    
                    {/* Title */}
                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Task Title <span className="text-red-500">*</span></label>
                        <input 
                            autoFocus
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-lg font-bold text-white placeholder-zinc-700 focus:outline-none focus:border-zinc-600 transition-colors"
                            placeholder="What needs to happen?"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && isFormValid() && handleSave()}
                        />
                    </div>
                    
                    {/* Description */}
                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Description</label>
                        <textarea 
                            className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-zinc-600 resize-none leading-relaxed"
                            placeholder="Add context, details, or acceptance criteria..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    {/* Context Selection (Matrix) */}
                    <div className="bg-zinc-900/30 p-4 rounded-lg border border-zinc-800 space-y-4">
                        <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                            <Icons.Layers className="w-3.5 h-3.5" /> Context & Linkage
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-4">
                            {/* Channel */}
                            <div>
                                <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-1.5 block">Distribution Channel</label>
                                <select 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                                    value={channelId}
                                    onChange={(e) => handleChannelChange(e.target.value)}
                                >
                                    <option value="">No Channel (Project Direct)</option>
                                    {channels.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Bet */}
                            <div>
                                <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-1.5 block">
                                    Strategic Bet
                                </label>
                                <select 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    value={betId}
                                    onChange={(e) => handleBetChange(e.target.value)}
                                    disabled={!channelId}
                                >
                                    <option value="">
                                        {channelId ? 'No Bet (Channel Only)' : '---'}
                                    </option>
                                    {availableBets.map(b => (
                                        <option key={b.id} value={b.id}>{b.description}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Project Link */}
                        <div>
                            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-1.5 block">Project Initiative</label>
                            <select 
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                                value={projectId}
                                onChange={(e) => setProjectId(e.target.value)}
                            >
                                <option value="">No Project Link</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Properties (Assignee, Priority, Duration) */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Assigned Owner</label>
                            <div className="flex flex-wrap gap-2">
                                {users.map(u => (
                                    <button 
                                        key={u.id}
                                        onClick={() => setAssigneeId(assigneeId === u.id ? '' : u.id)}
                                        className={`h-8 px-3 rounded-full border flex items-center justify-center gap-2 transition-all ${assigneeId === u.id ? `border-white/20 bg-zinc-800 text-white shadow-sm` : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'}`}
                                    >
                                        <div className={`w-2 h-2 rounded-full ${u.color}`}></div>
                                        <span className="text-xs font-medium">{u.initials}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Priority Level</label>
                            <div className="grid grid-cols-3 gap-2">
                            {PRIORITIES.map(p => (
                                <button 
                                    key={p.value}
                                    onClick={() => setPriority(p.value)}
                                    className={`px-2 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider border transition-all ${priority === p.value ? `bg-zinc-800 border-zinc-600 text-white` : 'bg-zinc-950 border-zinc-800 text-zinc-600 hover:border-zinc-700'}`}
                                >
                                    {p.value}
                                </button>
                            ))}
                            </div>
                        </div>
                    </div>

                    {/* Duration Slider (Roadmap Context) */}
                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Timeline Estimation</label>
                        <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800 flex items-center gap-4">
                            <input 
                                type="range" min="1" max="8" 
                                value={durationWeeks}
                                onChange={(e) => setDurationWeeks(parseInt(e.target.value))}
                                className="flex-1 accent-indigo-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer hover:accent-indigo-400"
                            />
                            <div className="w-16 text-right">
                                <span className="text-sm font-mono text-white font-bold">{durationWeeks}</span>
                                <span className="text-[10px] text-zinc-500 font-mono ml-1">week{durationWeeks > 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-800 bg-zinc-900/30 flex justify-between items-center shrink-0">
                    {initialData?.id && onDelete ? (
                        <button onClick={() => onDelete(initialData.id!)} className="text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded transition-colors flex items-center gap-1.5">
                            <Icons.Trash className="w-3.5 h-3.5"/> Delete
                        </button>
                    ) : <div></div>}
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-xs text-zinc-400 hover:text-white font-medium">Cancel</button>
                        <button 
                            onClick={handleSave} 
                            disabled={!isFormValid()} 
                            className="px-6 py-2 bg-white text-black text-xs font-bold rounded hover:bg-zinc-200 disabled:opacity-50 transition-colors shadow-lg shadow-white/5"
                        >
                            Save Task
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
