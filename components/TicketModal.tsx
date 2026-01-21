
import React, { useState, useMemo } from 'react';
import { Icons, PRIORITIES } from '../constants';
import { User, Project, Channel, Priority, TicketStatus, ContextDoc } from '../types';

interface TicketModalProps {
    initialData?: {
        id?: string;
        title?: string;
        description?: string;
        status?: string;
        priority?: Priority;
        assigneeId?: string;
        channelId?: string;
        projectId?: string;
        durationWeeks?: number;
        linkedDocIds?: string[];
    };
    context: {
        channels: Channel[];
        projects: Project[];
        users: User[];
        docs?: ContextDoc[]; // Optional for now to support progressive migration
    };
    onClose: () => void;
    onSave: (data: any) => void;
    onDelete?: (id: string) => void;
}

export const TicketModal: React.FC<TicketModalProps> = ({ initialData, context, onClose, onSave, onDelete }) => {
    const { channels, projects, users, docs = [] } = context;
    
    // Form State
    const [title, setTitle] = useState(initialData?.title || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [priority, setPriority] = useState<Priority>(initialData?.priority || 'Medium');
    const [assigneeId, setAssigneeId] = useState<string>(initialData?.assigneeId || '');
    
    // Context State
    const [channelId, setChannelId] = useState<string>(initialData?.channelId || '');
    const [projectId, setProjectId] = useState<string>(initialData?.projectId || '');
    const [linkedDocIds, setLinkedDocIds] = useState<string[]>(initialData?.linkedDocIds || []);
    
    // Roadmap Specific
    const [durationWeeks, setDurationWeeks] = useState<number>(initialData?.durationWeeks || 1);

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
            projectId: projectId || undefined,
            durationWeeks,
            linkedDocIds
        };
        onSave(data);
    };
    
    const toggleDocLink = (docId: string) => {
        setLinkedDocIds(prev => 
            prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
        );
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={onClose}></div>
            <div className="w-[600px] bg-white border border-zinc-100 rounded-xl shadow-2xl flex flex-col relative overflow-hidden ring-1 ring-zinc-200 z-10 max-h-[90vh]">
                
                {/* Header */}
                <div className="h-14 border-b border-zinc-100 flex items-center justify-between px-6 bg-white shrink-0">
                    <div className="flex items-center gap-2">
                        <Icons.Target className="w-4 h-4 text-indigo-600" />
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-900">Execution Task</span>
                    </div>
                    <button onClick={onClose}><Icons.XCircle className="w-5 h-5 text-zinc-400 hover:text-zinc-600 transition-colors"/></button>
                </div>

                {/* Scrollable Body */}
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    
                    {/* Title */}
                    <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Task Title <span className="text-red-500">*</span></label>
                        <input 
                            autoFocus
                            className="w-full bg-white border border-zinc-200 rounded-lg p-4 text-lg font-bold text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
                            placeholder="What needs to happen?"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && isFormValid() && handleSave()}
                        />
                    </div>
                    
                    {/* Description */}
                    <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Description</label>
                        <textarea 
                            className="w-full h-32 bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-sm text-zinc-700 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 focus:bg-white resize-none leading-relaxed transition-all"
                            placeholder="Add context, details, or acceptance criteria..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    {/* Context Selection (Matrix) */}
                    <div className="bg-zinc-50/50 p-4 rounded-lg border border-zinc-100 space-y-4">
                        <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                            <Icons.Layers className="w-3.5 h-3.5" /> Context & Linkage
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-4">
                            {/* Channel */}
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Distribution Channel</label>
                                <select 
                                    className="w-full bg-white border border-zinc-200 rounded-lg p-2.5 text-zinc-900 text-xs focus:outline-none focus:border-indigo-500 shadow-sm"
                                    value={channelId}
                                    onChange={(e) => setChannelId(e.target.value)}
                                >
                                    <option value="">No Channel (Project Direct)</option>
                                    {channels.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Project Link */}
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Project Initiative</label>
                                <select 
                                    className="w-full bg-white border border-zinc-200 rounded-lg p-2.5 text-zinc-900 text-xs focus:outline-none focus:border-indigo-500 shadow-sm"
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
                    </div>

                    {/* Properties (Assignee, Priority, Duration) */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Assigned Owner</label>
                            <div className="flex flex-wrap gap-2">
                                {users.map(u => (
                                    <button 
                                        key={u.id}
                                        onClick={() => setAssigneeId(assigneeId === u.id ? '' : u.id)}
                                        className={`h-8 px-3 rounded-full border flex items-center justify-center gap-2 transition-all ${assigneeId === u.id ? `border-zinc-300 bg-white text-zinc-900 shadow-md ring-1 ring-zinc-200` : 'border-zinc-200 bg-zinc-50 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'}`}
                                    >
                                        <div className={`w-2 h-2 rounded-full ${u.color}`}></div>
                                        <span className="text-xs font-medium">{u.initials}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Priority Level</label>
                            <div className="grid grid-cols-3 gap-2">
                            {PRIORITIES.map(p => (
                                <button 
                                    key={p.value}
                                    onClick={() => setPriority(p.value)}
                                    className={`px-2 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider border transition-all ${priority === p.value ? `bg-white border-zinc-300 text-zinc-900 shadow-sm` : 'bg-zinc-50 border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}
                                >
                                    {p.value}
                                </button>
                            ))}
                            </div>
                        </div>
                    </div>
                    
                    {/* Docs Attachment */}
                    {docs.length > 0 && (
                        <div>
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Linked Documents</label>
                            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 max-h-32 overflow-y-auto custom-scrollbar space-y-1">
                                {docs.map(doc => (
                                    <div 
                                        key={doc.id}
                                        onClick={() => toggleDocLink(doc.id)}
                                        className={`flex items-center gap-2 p-2 rounded cursor-pointer text-xs transition-colors ${linkedDocIds.includes(doc.id) ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'hover:bg-zinc-100 text-zinc-600'}`}
                                    >
                                        <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${linkedDocIds.includes(doc.id) ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-zinc-300'}`}>
                                            {linkedDocIds.includes(doc.id) && <Icons.CheckCircle className="w-2.5 h-2.5 text-white" />}
                                        </div>
                                        <span className="truncate flex-1">{doc.title}</span>
                                        {doc.isAiGenerated && <Icons.Sparkles className="w-3 h-3 text-purple-400" />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Duration Slider (Roadmap Context) */}
                    <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Timeline Estimation</label>
                        <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200 flex items-center gap-4">
                            <input 
                                type="range" min="1" max="8" 
                                value={durationWeeks}
                                onChange={(e) => setDurationWeeks(parseInt(e.target.value))}
                                className="flex-1 accent-indigo-600 h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer hover:accent-indigo-500"
                            />
                            <div className="w-16 text-right">
                                <span className="text-sm font-mono text-zinc-900 font-bold">{durationWeeks}</span>
                                <span className="text-[10px] text-zinc-500 font-mono ml-1">week{durationWeeks > 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-between items-center shrink-0">
                    {initialData?.id && onDelete ? (
                        <button onClick={() => onDelete(initialData.id!)} className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded transition-colors flex items-center gap-1.5">
                            <Icons.Trash className="w-3.5 h-3.5"/> Delete
                        </button>
                    ) : <div></div>}
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-xs text-zinc-500 hover:text-zinc-900 font-medium">Cancel</button>
                        <button 
                            onClick={handleSave} 
                            disabled={!isFormValid()} 
                            className="px-6 py-2 bg-zinc-900 text-white text-xs font-bold rounded hover:bg-zinc-800 disabled:opacity-50 transition-colors shadow-lg shadow-zinc-200"
                        >
                            Save Task
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
