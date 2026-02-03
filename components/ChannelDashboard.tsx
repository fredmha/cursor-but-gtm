
import React, { useState, useMemo } from 'react';
import { useStore, generateId } from '../store';
import { Icons } from '../constants';
import { TicketStatus, Ticket } from '../types';
import { TicketBoard } from './TicketBoard';
import { TicketModal } from './TicketModal';
import { SimpleTicketList } from './SimpleTicketList';

interface ChannelDashboardProps {
    channelId: string;
    isModal?: boolean;
    onClose?: () => void;
    onNavigateToBet?: (betId: string) => void; // Kept for interface compatibility but unused
    onDelete?: () => void;
}

export const ChannelDashboard: React.FC<ChannelDashboardProps> = ({
    channelId,
    isModal = false,
    onClose,
    onDelete
}) => {
    const {
        campaign, users, currentUser,
        addChannelPrinciple, deleteChannelPrinciple,
        addChannelLink, removeChannelLink,
        addChannelNote, deleteChannelNote,
        addTicket, updateTicket, deleteTicket,
        addChannelMember, removeChannelMember
    } = useStore();

    const [activeTab, setActiveTab] = useState<'TASK' | 'KANBAN'>('TASK');
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);

    const [newPrinciple, setNewPrinciple] = useState('');
    const [newNote, setNewNote] = useState('');
    const [isAddingLink, setIsAddingLink] = useState(false);
    const [newLinkData, setNewLinkData] = useState({ title: '', url: '' });

    const channel = campaign?.channels.find(c => c.id === channelId);
    const projects = campaign?.projects || [];
    const channelDocs = (campaign?.docs || []).filter(d => d.channelId === channelId);

    if (!channel) return null;

    const allTickets = useMemo(() => {
        return (channel.tickets || []).sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });
    }, [channel.tickets]);

    // --- Handlers ---

    const handleAddPrinciple = () => {
        if (!newPrinciple.trim()) return;
        addChannelPrinciple(channelId, newPrinciple);
        setNewPrinciple('');
    };

    const handleAddLink = () => {
        if (!newLinkData.title || !newLinkData.url) return;
        addChannelLink(channelId, {
            id: crypto.randomUUID(),
            title: newLinkData.title,
            url: newLinkData.url,
            icon: 'link'
        });
        setIsAddingLink(false);
        setNewLinkData({ title: '', url: '' });
    };

    const handleAddNote = () => {
        if (!newNote.trim()) return;
        addChannelNote(channelId, {
            id: crypto.randomUUID(),
            authorId: currentUser.id,
            date: new Date().toISOString(),
            text: newNote
        });
        setNewNote('');
    };

    const handleTicketClick = (ticket: Ticket) => {
        setEditingTicket(ticket);
        setShowTicketModal(true);
    };

    const handleStatusChange = (ticketId: string, newStatus: TicketStatus) => {
        updateTicket(channelId, ticketId, { status: newStatus });
    };

    const handleToggleStatus = (e: React.MouseEvent, ticket: Ticket) => {
        e.stopPropagation();
        const newStatus = ticket.status === TicketStatus.Done ? TicketStatus.Todo : TicketStatus.Done;
        handleStatusChange(ticket.id, newStatus);
    };

    const handleSaveTicket = (data: any) => {
        const ticketData: Ticket = {
            id: data.id || generateId(),
            shortId: editingTicket?.shortId || `T-${Math.floor(Math.random() * 10000)}`,
            title: data.title,
            description: data.description,
            status: editingTicket?.status || TicketStatus.Todo,
            priority: data.priority,
            assigneeId: data.assigneeId,
            channelId: channelId,
            projectId: data.projectId,
            createdAt: editingTicket?.createdAt || new Date().toISOString(),
            linkedDocIds: data.linkedDocIds,
            startDate: data.startDate,
            dueDate: data.endDate
        };

        if (editingTicket) {
            updateTicket(channelId, ticketData.id, ticketData);
        } else {
            addTicket(channelId, ticketData);
        }
        setShowTicketModal(false);
        setEditingTicket(null);
    };

    const handleDeleteTicket = (id: string) => {
        deleteTicket(channelId, id);
        setShowTicketModal(false);
    };



    return (
        <div className={`flex flex-col bg-white h-full ${isModal ? 'rounded-sm shadow-2xl overflow-hidden' : ''}`}>

            {/* Header Section */}
            <div className="px-10 py-10 border-b border-zinc-100/80 bg-white flex justify-between items-end shrink-0">
                <div className="flex gap-6 items-center">
                    <div className="w-12 h-12 rounded-none flex items-center justify-center border border-zinc-900 bg-white shadow-sm">
                        <Icons.Zap className="w-6 h-6 text-zinc-900" />
                    </div>
                    <div className="space-y-1.5">
                        <h2 className="text-xl font-bold text-zinc-900 tracking-[0.1em] uppercase leading-none">{channel.name}</h2>
                        <div className="flex gap-2">
                            {channel.tags?.map(tag => (
                                <span
                                    key={tag}
                                    className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 border border-zinc-100 px-2 py-0.5 rounded-none"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="h-8 w-px bg-zinc-100 mx-2" />
                    {onDelete && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm('Delete this channel?')) onDelete();
                            }}
                            className="p-2.5 hover:bg-zinc-50 rounded-none text-zinc-400 hover:text-red-500 transition-all duration-200"
                            title="Delete Channel"
                        >
                            <Icons.Trash className="w-5 h-5" />
                        </button>
                    )}
                    {isModal && onClose && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                            className="p-2.5 hover:bg-zinc-50 rounded-none text-zinc-400 hover:text-zinc-900 transition-all duration-200"
                        >
                            <Icons.XCircle className="w-6 h-6" />
                        </button>
                    )}
                </div>
            </div>

            {/* Triple-Pane Workspace */}
            <div className="flex-1 flex overflow-hidden">

                {/* COLUMN 1: STRATEGY (Principles) - 24% */}
                <div className="w-[24%] border-r border-zinc-100 flex flex-col overflow-hidden bg-white">
                    <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">

                        {/* Team Members */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Deployment Team</h3>
                            <div className="space-y-2">
                                {(channel.memberIds || []).map(mid => {
                                    const u = users.find(user => user.id === mid);
                                    if (!u) return null;
                                    return (
                                        <div key={mid} className="group flex items-center justify-between p-2 hover:bg-zinc-50 rounded-none transition-all duration-200 border border-transparent">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-6 h-6 rounded-none ${u.color} text-[9px] flex items-center justify-center text-white font-bold ring-2 ring-white shadow-sm`}>{u.initials}</div>
                                                <span className="text-xs font-semibold text-zinc-700">{u.name}</span>
                                            </div>
                                            <button
                                                onClick={() => removeChannelMember(channelId, mid)}
                                                className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-all"
                                            >
                                                <Icons.XCircle className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )
                                })}
                                {(channel.memberIds || []).length === 0 && <div className="text-xs text-zinc-400 italic py-2">No members assigned.</div>}
                            </div>

                            <div className="relative group/add">
                                <button className="text-[10px] font-bold text-zinc-900 uppercase tracking-widest hover:opacity-70 transition-opacity flex items-center gap-2 px-2">
                                    <Icons.Plus className="w-3 h-3" /> Add Member
                                </button>
                                <div className="absolute top-full left-0 mt-3 w-56 bg-white border border-zinc-200 rounded-none shadow-2xl hidden group-hover/add:block z-50 overflow-hidden ring-1 ring-black/5">
                                    {users.filter(u => !(channel.memberIds || []).includes(u.id)).map(u => (
                                        <button
                                            key={u.id}
                                            onClick={() => addChannelMember(channelId, u.id)}
                                            className="w-full text-left px-4 py-3 text-xs text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors flex items-center gap-3"
                                        >
                                            <div className={`w-2.5 h-2.5 rounded-full ${u.color}`}></div>
                                            <span className="font-medium">{u.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Channel Mandates */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Channel Mandates</h3>
                            <div className="space-y-3">
                                {(channel.principles || []).map(p => (
                                    <div key={p.id} className="group relative bg-white border border-zinc-200/60 rounded-none p-4 hover:border-zinc-300 transition-all shadow-sm">
                                        <p className="text-xs text-zinc-600 leading-relaxed font-medium">{p.text}</p>
                                        <button
                                            onClick={() => deleteChannelPrinciple(channelId, p.id)}
                                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-all"
                                        >
                                            <Icons.Trash className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <input
                                className="w-full bg-zinc-50/50 border border-zinc-200/80 rounded-none px-4 py-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-zinc-400 focus:outline-none transition-all"
                                placeholder="Add strategic mandate..."
                                value={newPrinciple}
                                onChange={e => setNewPrinciple(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddPrinciple()}
                            />
                        </div>

                    </div>
                </div>

                {/* COLUMN 2: EXECUTION FLOW - 52% */}
                <div className="w-[52%] flex flex-col overflow-hidden bg-zinc-50/50 border-r border-zinc-100">
                    {/* Workspace Controls */}
                    <div className="px-8 py-6 flex items-center justify-between shrink-0">
                        <div className="flex gap-px bg-zinc-200 p-0 border border-zinc-200">
                            {(['TASK', 'KANBAN'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`text-[9px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-none transition-all ${activeTab === tab ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:text-zinc-900'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="w-px h-6 bg-zinc-200 mx-1" />
                            <button
                                onClick={() => { setEditingTicket(null); setShowTicketModal(true); }}
                                className="px-5 py-2 bg-zinc-900 text-white text-[9px] font-bold uppercase tracking-[0.2em] rounded-none hover:bg-black transition-all flex items-center gap-2"
                            >
                                <Icons.Plus className="w-3.5 h-3.5" /> New Ticket
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden relative">
                        {activeTab === 'TASK' && (
                            <div className="h-full overflow-y-auto custom-scrollbar px-8 pb-10">
                                <SimpleTicketList
                                    tickets={allTickets}
                                    users={users}
                                    channels={campaign?.channels || []}
                                    projects={projects}
                                    onTicketClick={handleTicketClick}
                                    onToggleStatus={handleToggleStatus}
                                />
                            </div>
                        )}

                        {activeTab === 'KANBAN' && (
                            <div className="h-full overflow-y-auto custom-scrollbar bg-white">
                                <TicketBoard
                                    tickets={allTickets}
                                    channels={campaign?.channels || []}
                                    users={users}
                                    onTicketClick={handleTicketClick}
                                    onStatusChange={handleStatusChange}
                                    groupByChannel={false}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* COLUMN 3: ENGINE ASSETS - 24% */}
                <div className="w-[24%] border-l border-zinc-100 flex flex-col overflow-hidden bg-white">
                    <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">

                        {/* Strategic Docs */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Core Documents</h3>
                            <div className="space-y-2">
                                {channelDocs.map(doc => (
                                    <div key={doc.id} className="flex items-center justify-between p-3 bg-white border border-zinc-200 rounded-none group hover:shadow-sm transition-all duration-300">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-8 h-8 bg-zinc-50 rounded-none flex items-center justify-center text-zinc-400 shadow-inner group-hover:text-zinc-900 transition-colors">
                                                <Icons.FileText className="w-4 h-4" />
                                            </div>
                                            <div className="flex flex-col truncate">
                                                <span className="text-xs font-bold text-zinc-800 truncate">{doc.title}</span>
                                                <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">{new Date(doc.lastUpdated).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        {doc.isAiGenerated && <Icons.Sparkles className="w-3.5 h-3.5 text-zinc-300 group-hover:text-indigo-400 transition-colors" />}
                                    </div>
                                ))}
                                {channelDocs.length === 0 && <p className="text-xs text-zinc-300 italic py-2">No documents linked.</p>}
                            </div>
                        </div>

                        {/* Resources & Links */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Resource Stack</h3>
                                <button onClick={() => setIsAddingLink(!isAddingLink)} className="text-[10px] text-zinc-900 font-bold uppercase tracking-widest hover:opacity-70 transition-opacity">+ Link</button>
                            </div>

                            {isAddingLink && (
                                <div className="bg-zinc-50 p-4 rounded-none space-y-3 border border-zinc-200 shadow-inner animate-in slide-in-from-top-2 duration-300">
                                    <input
                                        className="w-full bg-white px-3 py-2 text-xs text-zinc-900 border border-zinc-200 rounded-none focus:border-zinc-400 focus:outline-none shadow-sm"
                                        placeholder="Resource Title"
                                        value={newLinkData.title}
                                        onChange={e => setNewLinkData({ ...newLinkData, title: e.target.value })}
                                    />
                                    <input
                                        className="w-full bg-white px-3 py-2 text-xs text-zinc-900 border border-zinc-200 rounded-none focus:border-zinc-400 focus:outline-none shadow-sm"
                                        placeholder="URL"
                                        value={newLinkData.url}
                                        onChange={e => setNewLinkData({ ...newLinkData, url: e.target.value })}
                                    />
                                    <div className="flex justify-end gap-2 pt-1">
                                        <button onClick={() => setIsAddingLink(false)} className="text-[10px] font-bold uppercase text-zinc-400 hover:text-zinc-600">Cancel</button>
                                        <button onClick={handleAddLink} className="text-[10px] font-bold uppercase text-indigo-600">Add Link</button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1">
                                {(channel.links || []).map(l => (
                                    <div key={l.id} className="flex items-center justify-between group p-2 hover:bg-zinc-50 rounded-none transition-colors border border-transparent">
                                        <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-xs font-semibold text-zinc-600 hover:text-zinc-900 truncate">
                                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-200 group-hover:bg-zinc-900 transition-colors" />
                                            {l.title}
                                        </a>
                                        <button onClick={() => removeChannelLink(channelId, l.id)} className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-all">
                                            <Icons.Trash className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                {(!channel.links || channel.links.length === 0) && <p className="text-xs text-zinc-300 italic py-2">No resource stack defined.</p>}
                            </div>
                        </div>

                        {/* Project Feed / Notes */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Context Feed</h3>
                            <div className="space-y-6 max-h-[400px] overflow-y-auto custom-scrollbar pr-2 pb-4">
                                {(channel.notes || []).map(n => {
                                    const author = users.find(u => u.id === n.authorId);
                                    return (
                                        <div key={n.id} className="relative pl-6 border-l border-zinc-100 group">
                                            <div className="absolute top-0 -left-1 w-2 h-2 rounded-full bg-zinc-100 border border-white group-hover:bg-zinc-900 transition-colors duration-300" />
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-800">{author?.initials}</span>
                                                <span className="text-[10px] text-zinc-300 tabular-nums">{new Date(n.date).toLocaleDateString()}</span>
                                                <button onClick={() => deleteChannelNote(channelId, n.id)} className="opacity-0 group-hover:opacity-100 ml-auto text-zinc-400 hover:text-red-500 transition-all"><Icons.Trash className="w-3 h-3" /></button>
                                            </div>
                                            <p className="text-xs text-zinc-600 leading-relaxed font-medium">{n.text}</p>
                                        </div>
                                    )
                                })}
                                {(channel.notes || []).length === 0 && <p className="text-xs text-zinc-300 italic">Feed is empty.</p>}
                            </div>
                            <input
                                className="w-full bg-zinc-50/50 border border-zinc-200/80 rounded-none px-4 py-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-zinc-400 focus:outline-none transition-all"
                                placeholder="Snapshot context..."
                                value={newNote}
                                onChange={e => setNewNote(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                            />
                        </div>

                    </div>
                </div>

            </div>

            {showTicketModal && (
                <TicketModal
                    initialData={editingTicket ? {
                        id: editingTicket.id,
                        title: editingTicket.title,
                        description: editingTicket.description,
                        priority: editingTicket.priority,
                        assigneeId: editingTicket.assigneeId,
                        channelId: editingTicket.channelId,
                        projectId: editingTicket.projectId,
                        linkedDocIds: editingTicket.linkedDocIds,
                        startDate: editingTicket.startDate,
                        endDate: editingTicket.dueDate
                    } : { channelId }}
                    context={{ channels: campaign?.channels || [], projects, users, docs: campaign?.docs || [] }}
                    onClose={() => { setShowTicketModal(false); setEditingTicket(null); }}
                    onSave={handleSaveTicket}
                    onDelete={editingTicket ? () => handleDeleteTicket(editingTicket.id) : undefined}
                />
            )}
        </div>
    );
};
