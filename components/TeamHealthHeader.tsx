
import React from 'react';
import { User, Ticket, TicketStatus } from '../types';

interface TeamHealthHeaderProps {
    users: User[];
    tickets: Ticket[];
}

export const TeamHealthHeader: React.FC<TeamHealthHeaderProps> = ({ users, tickets }) => {
    return (
        <div className="flex flex-row gap-12 min-w-max pr-10">
            {users.map(user => {
                const userTickets = tickets.filter(t => t.assigneeId === user.id && t.status !== TicketStatus.Backlog && t.status !== TicketStatus.Canceled);
                const done = userTickets.filter(t => t.status === TicketStatus.Done).length;
                const inProgress = userTickets.filter(t => t.status === TicketStatus.InProgress).length;
                const total = userTickets.length;

                const donePct = total > 0 ? (done / total) * 100 : 0;
                const progressPct = total > 0 ? (inProgress / total) * 100 : 0;

                return (
                    <div
                        key={user.id}
                        className="flex flex-col transition-all duration-300 group min-w-[220px] w-[220px]"
                    >
                        <div className="flex items-start justify-between mb-5">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <div className={`w-10 h-10 rounded-none ${user.color} flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-1 ring-zinc-900/10`}>
                                        {user.initials}
                                    </div>
                                    <div className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-none border border-zinc-50 ${total > 5 ? 'bg-zinc-900' : 'bg-zinc-300'}`} title="Capacity Status" />
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[11px] font-bold text-zinc-900 uppercase tracking-[0.15em]">{user.name}</div>
                                    <div className="text-[9px] text-zinc-400 font-bold uppercase tracking-[0.2em]">{user.role}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[11px] font-bold text-zinc-900 tabular-nums tracking-widest">
                                    {done} <span className="text-zinc-200">/</span> {total}
                                </div>
                                <div className="text-[8px] text-zinc-400 font-bold uppercase tracking-[0.2em] pt-0.5">Efficiency</div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="relative h-[2px] w-full bg-zinc-200/50 rounded-none overflow-hidden">
                                <div
                                    className="absolute inset-y-0 left-0 bg-zinc-900 transition-all duration-700 ease-out z-10"
                                    style={{ width: `${donePct}%` }}
                                />
                                <div
                                    className="absolute inset-y-0 left-0 bg-zinc-300 transition-all duration-700 ease-out"
                                    style={{ width: `${donePct + progressPct}%` }}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-1 bg-zinc-900" />
                                        <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-[0.2em]">Done</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-1 bg-zinc-300" />
                                        <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-[0.2em]">WIP</span>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold text-zinc-900 tabular-nums tracking-widest">{Math.round(donePct)}%</span>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    );
};
