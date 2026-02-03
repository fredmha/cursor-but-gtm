import React, { useMemo } from 'react';
import { Ticket, TicketStatus, User, Channel, Project, Priority } from '../types';
import { Icons } from '../constants';

interface SimpleTicketListProps {
    tickets: Ticket[];
    users: User[];
    channels: Channel[];
    projects: Project[];
    onTicketClick: (ticket: Ticket) => void;
    onToggleStatus: (e: React.MouseEvent, ticket: Ticket) => void;
}

const STATUS_CONFIG = {
    [TicketStatus.Backlog]: { icon: Icons.Circle, color: 'text-zinc-300' },
    [TicketStatus.Todo]: { icon: Icons.Circle, color: 'text-zinc-400' },
    [TicketStatus.InProgress]: { icon: Icons.Clock, color: 'text-zinc-600' },
    [TicketStatus.Done]: { icon: Icons.CheckCircle, color: 'text-zinc-700' },
    [TicketStatus.Canceled]: { icon: Icons.XCircle, color: 'text-zinc-400' },
};

const PRIORITY_ORDER: Priority[] = ['Urgent', 'High', 'Medium', 'Low', 'None'];

// Convert a date string to a sortable numeric timestamp. Missing/invalid dates sort last.
const getDateTimestamp = (dateString?: string) => {
    if (!dateString) return Number.POSITIVE_INFINITY;
    const parsedDate = new Date(dateString);
    const timeValue = parsedDate.getTime();
    return Number.isNaN(timeValue) ? Number.POSITIVE_INFINITY : timeValue;
};

// Map priority to a numeric rank for sorting (lower is higher priority).
const getPriorityRank = (priority: Priority) => {
    const priorityIndex = PRIORITY_ORDER.indexOf(priority);
    return priorityIndex === -1 ? PRIORITY_ORDER.length : priorityIndex;
};

// Format the due date for display; fall back to a friendly placeholder.
const formatDueDateLabel = (dueDate?: string) => {
    if (!dueDate) return 'No due date';
    const parsedDate = new Date(dueDate);
    if (Number.isNaN(parsedDate.getTime())) return 'No due date';
    return parsedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// Sort by due date, then priority, then title for a stable list order.
const compareTickets = (left: Ticket, right: Ticket) => {
    const leftDue = getDateTimestamp(left.dueDate);
    const rightDue = getDateTimestamp(right.dueDate);
    if (leftDue !== rightDue) return leftDue - rightDue;

    const leftPriority = getPriorityRank(left.priority);
    const rightPriority = getPriorityRank(right.priority);
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;

    return left.title.localeCompare(right.title);
};

// Resolve a ticket's contextual label (project or team) for display.
const getContextLabel = (ticket: Ticket, projects: Project[], channels: Channel[]) => {
    const projectMatch = projects.find(p => p.id === ticket.projectId);
    if (projectMatch) return `Project · ${projectMatch.name}`;
    const channelMatch = channels.find(c => c.id === ticket.channelId);
    if (channelMatch) return `Team · ${channelMatch.name}`;
    return null;
};

// Determine whether a ticket's due date is in the past.
const isTicketOverdue = (ticket: Ticket) => {
    if (!ticket.dueDate) return false;
    const dueTimestamp = getDateTimestamp(ticket.dueDate);
    return dueTimestamp < Date.now();
};

export const SimpleTicketList: React.FC<SimpleTicketListProps> = ({
    tickets,
    users,
    channels,
    projects,
    onTicketClick,
    onToggleStatus
}) => {
    // Compute a deterministic order without mutating the input array.
    const sortedTickets = useMemo(() => (
        [...tickets].sort(compareTickets)
    ), [tickets]);

    if (sortedTickets.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 py-16">
                <Icons.CheckCircle className="w-10 h-10 mb-4 opacity-10" />
                <p className="text-sm">No tickets found.</p>
            </div>
        );
    }

    return (
        <ul className="divide-y divide-zinc-100">
            {sortedTickets.map(ticket => {
                const StatusIcon = STATUS_CONFIG[ticket.status].icon;
                const assignee = users.find(u => u.id === ticket.assigneeId);
                const contextLabel = getContextLabel(ticket, projects, channels);
                const dueLabel = formatDueDateLabel(ticket.dueDate);
                const isOverdue = isTicketOverdue(ticket);

                return (
                    <li
                        key={ticket.id}
                        className="group flex items-center gap-4 py-3 px-2 rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer"
                        onClick={() => onTicketClick(ticket)}
                    >
                        <button
                            onClick={(e) => onToggleStatus(e, ticket)}
                            className="p-1 -ml-1 rounded hover:bg-zinc-200 transition-colors"
                            aria-label="Toggle status"
                        >
                            <StatusIcon className={`w-4 h-4 ${STATUS_CONFIG[ticket.status].color}`} />
                        </button>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-zinc-900 truncate">{ticket.title}</span>
                                {contextLabel && (
                                    <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
                                        {contextLabel}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                                <span className="font-mono">{ticket.shortId}</span>
                                <span className="text-zinc-400">·</span>
                                <span className="uppercase tracking-[0.18em]">{ticket.status}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                                <span className="uppercase tracking-[0.18em]">
                                    {ticket.priority !== 'None' ? ticket.priority : 'No Priority'}
                                </span>
                            </div>
                            <span className={`text-xs tabular-nums ${isOverdue ? 'text-zinc-900' : 'text-zinc-500'}`}>
                                {dueLabel}
                            </span>
                            {assignee && (
                                <div className={`w-7 h-7 rounded-full ${assignee.color} text-[9px] text-white flex items-center justify-center font-bold ring-1 ring-white shadow-sm`}>
                                    {assignee.initials}
                                </div>
                            )}
                        </div>
                    </li>
                );
            })}
        </ul>
    );
};
