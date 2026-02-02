
import React, { useMemo } from 'react';
import { Ticket, TicketStatus, User, Channel, Project, Priority } from '../types';
import { Icons, PRIORITIES } from '../constants';

export type TicketListGroupMode = 'WEEK_ASSIGNEE' | 'ASSIGNEE_PRIORITY' | 'CONTEXT_WEEK';
export type TicketListWeekStart = 'MON' | 'SUN';

interface TicketListProps {
    tickets: Ticket[];
    users: User[];
    channels: Channel[];
    projects: Project[];
    onTicketClick: (ticket: Ticket) => void;
    onToggleStatus: (e: React.MouseEvent, ticket: Ticket) => void;
    groupMode: TicketListGroupMode;
    weekStart: TicketListWeekStart;
}

const STATUS_CONFIG = {
    [TicketStatus.Backlog]: { icon: Icons.Circle, color: 'text-zinc-300', bg: 'bg-zinc-50' },
    [TicketStatus.Todo]: { icon: Icons.Circle, color: 'text-zinc-400', bg: 'bg-zinc-50' },
    [TicketStatus.InProgress]: { icon: Icons.Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
    [TicketStatus.Done]: { icon: Icons.CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    [TicketStatus.Canceled]: { icon: Icons.XCircle, color: 'text-red-400', bg: 'bg-red-50' },
};

type GroupRow =
    | { type: 'group'; id: string; label: string; count: number }
    | { type: 'subgroup'; id: string; label: string; count: number }
    | { type: 'ticket'; ticket: Ticket; shade: boolean };

const WEEK_BUCKETS = ['Overdue', 'This Week', 'Next Week', 'Later', 'No Date'] as const;
const PRIORITY_ORDER: Priority[] = ['Urgent', 'High', 'Medium', 'Low', 'None'];

const getPriorityRank = (priority: Priority) => {
    const idx = PRIORITY_ORDER.indexOf(priority);
    return idx === -1 ? PRIORITY_ORDER.length : idx;
};

const startOfDay = (date: Date) => {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
};

const startOfWeek = (date: Date, weekStart: TicketListWeekStart) => {
    const next = startOfDay(date);
    const day = next.getDay();
    const diffToStart = weekStart === 'MON' ? (day + 6) % 7 : day;
    next.setDate(next.getDate() - diffToStart);
    return next;
};

export const TicketList: React.FC<TicketListProps> = ({
    tickets,
    users,
    channels,
    projects,
    onTicketClick,
    onToggleStatus,
    groupMode,
    weekStart
}) => {
    if (tickets.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                <Icons.CheckCircle className="w-10 h-10 mb-4 opacity-10"/>
                <p className="text-sm">No tickets found.</p>
            </div>
        );
    }

    const now = Date.now();
    const todayStart = startOfDay(new Date(now));
    const weekStartDate = startOfWeek(todayStart, weekStart);
    const nextWeekStart = new Date(weekStartDate);
    nextWeekStart.setDate(weekStartDate.getDate() + 7);
    const weekAfterNextStart = new Date(weekStartDate);
    weekAfterNextStart.setDate(weekStartDate.getDate() + 14);
    const todayStartMs = todayStart.getTime();
    const nextWeekStartMs = nextWeekStart.getTime();
    const weekAfterNextStartMs = weekAfterNextStart.getTime();

    const getWeekBucket = (dueDate?: string) => {
        if (!dueDate) return 'No Date';
        const due = new Date(dueDate);
        const dueMs = due.getTime();
        if (Number.isNaN(dueMs)) return 'No Date';
        if (dueMs < todayStartMs) return 'Overdue';
        if (dueMs < nextWeekStartMs) return 'This Week';
        if (dueMs < weekAfterNextStartMs) return 'Next Week';
        return 'Later';
    };

    const sortByPriorityThenDue = (items: Ticket[]) => (
        [...items].sort((a, b) => {
            const priorityDelta = getPriorityRank(a.priority) - getPriorityRank(b.priority);
            if (priorityDelta !== 0) return priorityDelta;
            const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
            const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
            if (aDue !== bDue) return aDue - bDue;
            return a.title.localeCompare(b.title);
        })
    );

    const sortByDueThenTitle = (items: Ticket[]) => (
        [...items].sort((a, b) => {
            const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
            const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
            if (aDue !== bDue) return aDue - bDue;
            return a.title.localeCompare(b.title);
        })
    );

    const rows = useMemo<GroupRow[]>(() => {
        const data: GroupRow[] = [];

        const appendGroup = (id: string, label: string, groupTickets: Ticket[], buildSubgroups: (source: Ticket[]) => void) => {
            if (groupTickets.length === 0) return;
            data.push({ type: 'group', id, label, count: groupTickets.length });
            buildSubgroups(groupTickets);
        };

        const appendSubgroup = (id: string, label: string, subgroupTickets: Ticket[], sorter: (items: Ticket[]) => Ticket[]) => {
            if (subgroupTickets.length === 0) return;
            data.push({ type: 'subgroup', id, label, count: subgroupTickets.length });
            sorter(subgroupTickets).forEach((ticket, index) => data.push({ type: 'ticket', ticket, shade: index % 2 === 1 }));
        };

        if (groupMode === 'WEEK_ASSIGNEE') {
            WEEK_BUCKETS.forEach(bucket => {
                const bucketTickets = tickets.filter(t => getWeekBucket(t.dueDate) === bucket);
                appendGroup(`week-${bucket}`, bucket, bucketTickets, (source) => {
                    const knownAssignees = new Set(users.map(user => user.id));
                    users.forEach(user => {
                        const userTickets = source.filter(t => t.assigneeId === user.id);
                        appendSubgroup(`week-${bucket}-user-${user.id}`, user.name, userTickets, sortByPriorityThenDue);
                    });
                    const unassigned = source.filter(t => !t.assigneeId);
                    appendSubgroup(`week-${bucket}-unassigned`, 'Unassigned', unassigned, sortByPriorityThenDue);
                    const unknown = source.filter(t => t.assigneeId && !knownAssignees.has(t.assigneeId));
                    appendSubgroup(`week-${bucket}-unknown`, 'Unknown Assignee', unknown, sortByPriorityThenDue);
                });
            });
            return data;
        }

        if (groupMode === 'ASSIGNEE_PRIORITY') {
            const knownAssignees = new Set(users.map(user => user.id));
            const assigneeGroups = [...users.map(user => ({ id: user.id, label: user.name, tickets: tickets.filter(t => t.assigneeId === user.id) }))];
            const unassignedTickets = tickets.filter(t => !t.assigneeId);
            if (unassignedTickets.length > 0) {
                assigneeGroups.push({ id: 'unassigned', label: 'Unassigned', tickets: unassignedTickets });
            }
            const unknownTickets = tickets.filter(t => t.assigneeId && !knownAssignees.has(t.assigneeId));
            if (unknownTickets.length > 0) {
                assigneeGroups.push({ id: 'unknown', label: 'Unknown Assignee', tickets: unknownTickets });
            }

            assigneeGroups.forEach(group => {
                appendGroup(`assignee-${group.id}`, group.label, group.tickets, (source) => {
                    PRIORITY_ORDER.forEach(priority => {
                        const priorityTickets = source.filter(t => t.priority === priority);
                        const label = priority === 'None' ? 'No Priority' : priority;
                        appendSubgroup(`assignee-${group.id}-priority-${priority}`, label, priorityTickets, sortByDueThenTitle);
                    });
                });
            });
            return data;
        }

        const contextGroups = [
            ...projects.map(project => ({
                id: `project-${project.id}`,
                label: `Project · ${project.name}`,
                tickets: tickets.filter(t => t.projectId === project.id)
            })),
            ...channels.map(channel => ({
                id: `channel-${channel.id}`,
                label: `Channel · ${channel.name}`,
                tickets: tickets.filter(t => t.channelId === channel.id)
            }))
        ].filter(group => group.tickets.length > 0)
            .sort((a, b) => a.label.localeCompare(b.label));

        const unknownProjectTickets = tickets.filter(t => t.projectId && !projects.some(p => p.id === t.projectId));
        const unknownChannelTickets = tickets.filter(t => t.channelId && !channels.some(c => c.id === t.channelId));
        const unassignedContext = tickets.filter(t => !t.projectId && !t.channelId);

        const orderedContextGroups = [
            ...contextGroups
        ];

        if (unknownProjectTickets.length > 0) {
            orderedContextGroups.push({
                id: 'project-unknown',
                label: 'Project · Unknown',
                tickets: unknownProjectTickets
            });
        }

        if (unknownChannelTickets.length > 0) {
            orderedContextGroups.push({
                id: 'channel-unknown',
                label: 'Channel · Unknown',
                tickets: unknownChannelTickets
            });
        }

        if (unassignedContext.length > 0) {
            orderedContextGroups.push({
                id: 'context-unassigned',
                label: 'Unassigned Context',
                tickets: unassignedContext
            });
        }

        orderedContextGroups.forEach(group => {
            appendGroup(`context-${group.id}`, group.label, group.tickets, (source) => {
                WEEK_BUCKETS.forEach(bucket => {
                    const bucketTickets = source.filter(t => getWeekBucket(t.dueDate) === bucket);
                    appendSubgroup(`context-${group.id}-week-${bucket}`, bucket, bucketTickets, sortByPriorityThenDue);
                });
            });
        });

        return data;
    }, [groupMode, tickets, users, channels, projects, todayStartMs, nextWeekStartMs, weekAfterNextStartMs]);

    const renderTicketRow = (ticket: Ticket, shade: boolean) => {
        const StatusIcon = STATUS_CONFIG[ticket.status].icon;
        const PriorityConfig = PRIORITIES.find(p => p.value === ticket.priority) || PRIORITIES[4];
        const assignee = users.find(u => u.id === ticket.assigneeId);
        const dueDate = ticket.dueDate ? new Date(ticket.dueDate) : null;
        const isOverdue = dueDate ? dueDate.getTime() < todayStartMs : false;

        return (
            <tr
                key={ticket.id}
                onClick={() => onTicketClick(ticket)}
                className={`group cursor-pointer transition-colors rounded-lg ${shade ? 'bg-zinc-50/50' : 'bg-white'} hover:bg-zinc-50`}
            >
                <td className="pl-10 pr-4 py-3 text-xs font-mono text-zinc-400 rounded-l-lg border-l-2 border-zinc-100">{ticket.shortId}</td>
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
                <td className="px-4 py-3">
                    <span className={`text-xs font-medium tabular-nums ${isOverdue ? 'text-red-500' : 'text-zinc-500'}`}>
                        {dueDate ? dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '--'}
                    </span>
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
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar pb-10">
            <table className="w-full text-left border-separate border-spacing-y-1">
                <thead className="text-[10px] uppercase font-bold text-zinc-400 sticky top-0 bg-white z-10 shadow-sm">
                    <tr>
                        <th className="px-4 py-3 w-24">ID</th>
                        <th className="px-4 py-3">Title</th>
                        <th className="px-4 py-3 w-32">Status</th>
                        <th className="px-4 py-3 w-24">Priority</th>
                        <th className="px-4 py-3 w-20">Due</th>
                        <th className="px-4 py-3 w-16 text-right">Assignee</th>
                    </tr>
                </thead>
                <tbody className="bg-white">
                    {rows.map(row => {
                        if (row.type === 'group') {
                            const isOverdueGroup = row.label === 'Overdue';
                            return (
                                <tr key={row.id} className="bg-white">
                                    <td colSpan={6} className="px-4 pt-6 pb-2">
                                        <div className={`flex items-center justify-between px-4 py-3 border border-zinc-100 rounded-lg ${isOverdueGroup ? 'bg-red-50/60' : 'bg-zinc-50/80'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-1.5 h-6 ${isOverdueGroup ? 'bg-red-400' : 'bg-zinc-300'}`} />
                                                <span className={`text-[12px] uppercase tracking-[0.22em] font-bold ${isOverdueGroup ? 'text-red-600' : 'text-zinc-700'}`}>{row.label}</span>
                                            </div>
                                            <span className={`text-[10px] font-bold tabular-nums bg-white border border-zinc-100 px-2 py-0.5 rounded-full ${isOverdueGroup ? 'text-red-500' : 'text-zinc-500'}`}>{row.count} items</span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        }
                        if (row.type === 'subgroup') {
                            const isOverdueGroup = row.label === 'Overdue';
                            return (
                                <tr key={row.id} className="bg-white">
                                    <td colSpan={6} className="px-4 pt-3 pb-2">
                                        <div className="flex items-center justify-between ml-4 pl-6 pr-3 py-2 border-l-2 border-zinc-100">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-4 h-4 rounded-full border ${isOverdueGroup ? 'border-red-200 bg-red-100' : 'border-zinc-200 bg-white'}`} />
                                                <span className={`text-[11px] uppercase tracking-[0.2em] font-semibold ${isOverdueGroup ? 'text-red-600' : 'text-zinc-600'}`}>{row.label}</span>
                                            </div>
                                            <span className={`text-[9px] font-bold tabular-nums ${isOverdueGroup ? 'text-red-400' : 'text-zinc-400'}`}>{row.count}</span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        }
                        return renderTicketRow(row.ticket, row.shade);
                    })}
                </tbody>
            </table>
        </div>
    );
};
