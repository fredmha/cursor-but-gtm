
import React, { useState, useMemo, useEffect } from 'react';
import { useStore, generateId } from '../store';
import { Icons, PRIORITIES } from '../constants';
import { Status, ProjectHealth, Priority, TicketStatus, Ticket, Channel } from '../types';
import { TicketBoard } from './TicketBoard';
import { TicketModal } from './TicketModal';

interface ProjectDashboardProps {
    projectId: string;
    isModal?: boolean;
    onClose?: () => void;
    onNavigateToBet?: (betId: string) => void;
    onDelete?: () => void;
}

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({
    projectId,
    isModal = false,
    onClose,
    onNavigateToBet,
    onDelete
}) => {
    const {
        campaign, users, currentUser,
        updateProject, addProjectUpdate,
        addTicket, addProjectTicket,
        updateTicket, updateProjectTicket,
        deleteTicket, deleteProjectTicket
    } = useStore();

    const [newUpdate, setNewUpdate] = useState('');
    const [showNewTicketModal, setShowNewTicketModal] = useState(false);
    const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);

    const project = campaign?.projects.find(p => p.id === projectId);
    const channels = campaign?.channels || [];
    const projects = campaign?.projects || [];

    if (!project) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                <Icons.XCircle className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm">Project not found or deleted.</p>
            </div>
        )
    }

    // Merged Live Tickets for this Project (Channel Tickets + Independent Project Tickets)
    const projectTickets = useMemo(() => {
        return project.tickets || [];
    }, [project.tickets]);

    const projectLead = users.find(u => u.id === project.ownerId);

    const handlePostUpdate = () => {
        if (!newUpdate.trim()) return;
        addProjectUpdate(projectId, {
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            authorId: currentUser.id,
            status: project.status || 'On Track',
            text: newUpdate
        });
        setNewUpdate('');
    };

    const handleTicketClick = (ticket: Ticket) => {
        setEditingTicket(ticket);
        setShowNewTicketModal(true);
    };

    const handleSaveTicket = (data: any) => {
        // Reconstruct Ticket Object from generic Modal Data
        const ticketData: Ticket = {
            id: data.id || generateId(),
            shortId: editingTicket?.shortId || `T-${Math.floor(Math.random() * 10000)}`,
            title: data.title,
            description: data.description,
            status: editingTicket?.status || TicketStatus.Todo,
            priority: data.priority,
            assigneeId: data.assigneeId,
            channelId: data.channelId,
            projectId: projectId,
            createdAt: editingTicket?.createdAt || new Date().toISOString()
        };

        ticketData.projectId = data.projectId || projectId;

        // HANDLE EDIT (If we are editing an existing ticket)
        if (editingTicket) {
            const isLocationChanged =
                (editingTicket.channelId !== ticketData.channelId) ||
                (editingTicket.projectId !== ticketData.projectId);

            if (isLocationChanged) {
                // 1. Delete from old location
                if (editingTicket.channelId) {
                    deleteTicket(editingTicket.channelId, editingTicket.id);
                } else {
                    deleteProjectTicket(projectId, editingTicket.id);
                }

                // 2. Add to new location
                if (ticketData.channelId) {
                    addTicket(ticketData.channelId, ticketData);
                } else {
                    addProjectTicket(ticketData.projectId || projectId, ticketData);
                }
            } else {
                // Just Update in place
                if (ticketData.channelId) {
                    updateTicket(ticketData.channelId, ticketData.id, ticketData);
                } else {
                    updateProjectTicket(projectId, ticketData.id, ticketData);
                }
            }
        }
        // HANDLE CREATE (New Ticket)
        else {
            if (ticketData.channelId) {
                addTicket(ticketData.channelId, ticketData);
            } else {
                addProjectTicket(projectId, ticketData);
            }
        }

        setShowNewTicketModal(false);
        setEditingTicket(null);
    };

    const handleStatusChange = (ticketId: string, newStatus: TicketStatus) => {
        // Find ticket to get channel context
        const ticket = projectTickets.find(t => t.id === ticketId);
        if (ticket) {
            if (ticket.channelId) {
                updateTicket(ticket.channelId, ticketId, { status: newStatus });
            } else {
                updateProjectTicket(projectId, ticketId, { status: newStatus });
            }
        }
    };

    return (
        <div className={`flex flex-col bg-white h-full ${isModal ? 'rounded-xl overflow-hidden' : ''}`}>

            {/* Header */}
            <div className={`p-8 border-b border-zinc-200 bg-white flex justify-between items-start shrink-0`}>
                <div className="flex gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border bg-emerald-50 border-emerald-200 text-emerald-600`}>
                        <Icons.Target className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-zinc-900 mb-1">{project.name}</h2>
                        <p className="text-zinc-500 text-sm max-w-xl leading-relaxed">{project.description || "No description provided."}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {onDelete && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm('Delete this project? This action cannot be undone.')) onDelete();
                            }}
                            className="p-2 hover:bg-red-50 rounded-full text-zinc-400 hover:text-red-500 transition-colors"
                            title="Delete Project"
                        >
                            <Icons.Trash className="w-5 h-5" />
                        </button>
                    )}
                    {isModal && onClose && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                            className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-900 transition-colors"
                        >
                            <Icons.XCircle className="w-6 h-6" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">

                {/* Main Content */}
                <div className="flex-1 overflow-hidden flex flex-col border-r border-zinc-200">

                    {/* Toolbar / Tabs */}
                    <div className="px-8 py-4 border-b border-zinc-200 flex items-center justify-between shrink-0 bg-zinc-50/50">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2 text-sm font-bold text-zinc-900 border-b-2 border-indigo-500 pb-0.5">
                                <Icons.Kanban className="w-4 h-4" /> Live Execution
                            </div>
                        </div>
                        <button
                            onClick={() => { setEditingTicket(null); setShowNewTicketModal(true); }}
                            className="px-4 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded hover:bg-zinc-800 transition-colors flex items-center gap-2"
                        >
                            <Icons.Plus className="w-3.5 h-3.5" />
                            New Ticket
                        </button>
                    </div>

                    {/* Kanban Board Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-white">
                        <TicketBoard
                            tickets={projectTickets}
                            channels={campaign?.channels || []}
                            users={users}
                            onTicketClick={handleTicketClick}
                            onStatusChange={handleStatusChange}
                            groupByChannel={true}
                        />
                    </div>

                </div>

                {/* Right Sidebar (Properties & Context) */}
                <div className="w-80 bg-zinc-50/50 flex flex-col overflow-hidden shrink-0 border-l border-zinc-200">
                    <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar flex-1">

                        {/* Status & Updates */}
                        <div>
                            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Project Health</h3>
                            <div className="bg-white rounded-lg p-3 border border-zinc-200 space-y-3 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${project.status === 'On Track' ? 'bg-emerald-500' :
                                            project.status === 'At Risk' ? 'bg-amber-500' : 'bg-red-500'
                                            }`}></div>
                                        <select
                                            value={project.status || 'On Track'}
                                            onChange={e => updateProject(projectId, { status: e.target.value as ProjectHealth })}
                                            className="bg-transparent text-xs font-bold text-zinc-800 focus:outline-none uppercase"
                                        >
                                            <option value="On Track">On Track</option>
                                            <option value="At Risk">At Risk</option>
                                            <option value="Off Track">Off Track</option>
                                            <option value="Completed">Completed</option>
                                        </select>
                                    </div>
                                    <span className="text-[10px] text-zinc-400">{project.updates?.length || 0} updates</span>
                                </div>

                                {/* Mini Update Input */}
                                <div className="relative">
                                    <input
                                        value={newUpdate}
                                        onChange={e => setNewUpdate(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handlePostUpdate()}
                                        placeholder="Post status update..."
                                        className="w-full bg-zinc-50 border border-zinc-200 rounded px-2 py-1.5 text-xs text-zinc-900 focus:border-zinc-400 focus:outline-none"
                                    />
                                    <button
                                        onClick={handlePostUpdate}
                                        disabled={!newUpdate}
                                        className="absolute right-1 top-1 p-0.5 text-indigo-600 disabled:opacity-0 transition-opacity"
                                    >
                                        <Icons.ChevronRight className="w-3 h-3" />
                                    </button>
                                </div>

                                {/* Latest Update */}
                                {project.updates && project.updates.length > 0 && (
                                    <div className="pt-2 border-t border-zinc-100">
                                        <div className="flex items-center gap-1 mb-1">
                                            <div className="w-4 h-4 rounded-full bg-zinc-200 flex items-center justify-center text-[8px] text-zinc-600">
                                                {users.find(u => u.id === project.updates![0].authorId)?.initials}
                                            </div>
                                            <span className="text-[9px] text-zinc-500">{new Date(project.updates![0].date).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-xs text-zinc-600 line-clamp-3">{project.updates![0].text}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Metadata Form */}
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Project Lead</label>
                                <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded p-2">
                                    {projectLead ? (
                                        <div className={`w-5 h-5 rounded-full ${projectLead.color} flex items-center justify-center text-[8px] text-white font-bold`}>{projectLead.initials}</div>
                                    ) : (
                                        <div className="w-5 h-5 rounded-full border border-dashed border-zinc-300"></div>
                                    )}
                                    <select
                                        value={project.ownerId || ''}
                                        onChange={e => updateProject(projectId, { ownerId: e.target.value })}
                                        className="bg-transparent text-xs font-medium text-zinc-800 focus:outline-none flex-1"
                                    >
                                        <option value="">Unassigned</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Timeline</label>
                                <div className="bg-white border border-zinc-200 rounded p-3 space-y-2">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-zinc-500">Start</span>
                                        <input
                                            type="date"
                                            value={project.startDate?.split('T')[0] || ''}
                                            onChange={e => updateProject(projectId, { startDate: e.target.value })}
                                            className="bg-transparent text-zinc-800 font-mono text-right focus:outline-none w-24"
                                        />
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-zinc-500">Target</span>
                                        <input
                                            type="date"
                                            value={project.targetDate?.split('T')[0] || ''}
                                            onChange={e => updateProject(projectId, { targetDate: e.target.value })}
                                            className="bg-transparent text-zinc-800 font-mono text-right focus:outline-none w-24"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {showNewTicketModal && (
                <TicketModal
                    initialData={editingTicket ? {
                        id: editingTicket.id,
                        title: editingTicket.title,
                        description: editingTicket.description,
                        priority: editingTicket.priority,
                        assigneeId: editingTicket.assigneeId,
                        channelId: editingTicket.channelId,
                        projectId: editingTicket.projectId || projectId,
                    } : { projectId }}
                    context={{ channels, projects, users }}
                    onClose={() => { setShowNewTicketModal(false); setEditingTicket(null); }}
                    onSave={handleSaveTicket}
                    onDelete={editingTicket ? () => {
                        if (editingTicket.channelId) {
                            deleteTicket(editingTicket.channelId, editingTicket.id);
                        } else {
                            deleteProjectTicket(projectId, editingTicket.id);
                        }
                        setShowNewTicketModal(false);
                    } : undefined}
                />
            )}
        </div>
    );
};
