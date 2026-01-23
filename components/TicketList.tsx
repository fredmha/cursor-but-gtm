
import React from 'react';
import { Ticket, TicketStatus, User, Channel, Project } from '../types';
import { Icons, PRIORITIES } from '../constants';

interface TicketListProps {
    tickets: Ticket[];
    users: User[];
    channels: Channel[];
    projects: Project[];
    onTicketClick: (ticket: Ticket) => void;
    onToggleStatus: (e: React.MouseEvent, ticket: Ticket) => void;
}

const STATUS_CONFIG = {
    [TicketStatus.Backlog]: { icon: Icons.Circle, color: 'text-zinc-300', bg: 'bg-zinc-50' },
    [TicketStatus.Todo]: { icon: Icons.Circle, color: 'text-zinc-400', bg: 'bg-zinc-50' },
    [TicketStatus.InProgress]: { icon: Icons.Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
    [TicketStatus.Done]: { icon: Icons.CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    [TicketStatus.Canceled]: { icon: Icons.XCircle, color: 'text-red-400', bg: 'bg-red-50' },
};

export const TicketList: React.FC<TicketListProps> = ({ tickets, users, channels, projects, onTicketClick, onToggleStatus }) => {
    if (tickets.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                <Icons.CheckCircle className="w-10 h-10 mb-4 opacity-10"/>
                <p className="text-sm">No tickets found.</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto custom-scrollbar pb-10">
            <table className="w-full text-left border-separate border-spacing-y-1">
                <thead className="text-[10px] uppercase font-bold text-zinc-400 sticky top-0 bg-white z-10 shadow-sm">
                    <tr>
                        <th className="px-4 py-3 w-24">ID</th>
                        <th className="px-4 py-3">Title</th>
                        <th className="px-4 py-3 w-32">Status</th>
                        <th className="px-4 py-3 w-24">Priority</th>
                        <th className="px-4 py-3 w-16 text-right">Assignee</th>
                    </tr>
                </thead>
                <tbody className="bg-white">
                    {tickets.map(ticket => {
                        const StatusIcon = STATUS_CONFIG[ticket.status].icon;
                        const PriorityConfig = PRIORITIES.find(p => p.value === ticket.priority) || PRIORITIES[4];
                        const assignee = users.find(u => u.id === ticket.assigneeId);
                        
                        return (
                            <tr 
                                key={ticket.id} 
                                onClick={() => onTicketClick(ticket)}
                                className="group cursor-pointer hover:bg-zinc-50 transition-colors rounded-lg"
                            >
                                <td className="px-4 py-3 text-xs font-mono text-zinc-400 rounded-l-lg">{ticket.shortId}</td>
                                <td className="px-4 py-3 text-sm text-zinc-800 font-medium">
                                    {ticket.title}
                                    {ticket.channelId && <span className="ml-2 text-xs text-zinc-400 font-normal">in {channels.find(c => c.id === ticket.channelId)?.name}</span>}
                                    {ticket.projectId && <span className="ml-2 text-xs text-zinc-400 font-normal">in {projects.find(p => p.id === ticket.projectId)?.name}</span>}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={(e) => onToggleStatus(e, ticket)}
                                            className="p-1 -ml-1 rounded hover:bg-zinc-200 transition-colors"
                                        >
                                            <StatusIcon className={`w-3.5 h-3.5 ${STATUS_CONFIG[ticket.status].color}`} />
                                        </button>
                                        <span className="text-xs text-zinc-500 font-medium">{ticket.status}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-1.5">
                                        <Icons.Flag className={`w-3 h-3 ${PriorityConfig.color}`} />
                                        <span className={`text-xs font-medium ${PriorityConfig.color}`}>{ticket.priority !== 'None' ? ticket.priority : ''}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 rounded-r-lg text-right">
                                    {assignee && (
                                        <div className={`w-6 h-6 rounded-full ${assignee.color} text-[8px] text-white flex items-center justify-center font-bold inline-block ring-2 ring-white shadow-sm`}>
                                            {assignee.initials}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
