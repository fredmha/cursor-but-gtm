
import React from 'react';
import { User, Ticket, TicketStatus } from '../types';

interface TeamHealthHeaderProps {
    users: User[];
    tickets: Ticket[];
}

export const TeamHealthHeader: React.FC<TeamHealthHeaderProps> = ({ users, tickets }) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
                        className="bg-white border border-zinc-200/60 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-zinc-300/80 transition-all duration-300 group"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className={`w-10 h-10 rounded-full ${user.color} flex items-center justify-center text-xs font-bold text-white shadow-inner ring-2 ring-white`}>
                                        {user.initials}
                                    </div>
                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${total > 5 ? 'bg-amber-400' : 'bg-emerald-500'}`} title="Capacity Status" />
                                </div>
                                <div className="space-y-0.5">
                                    <div className="text-sm font-semibold text-zinc-900 tracking-tight">{user.name}</div>
                                    <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{user.role}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-bold text-zinc-900 tabular-nums">
                                    {done} <span className="text-zinc-300 font-medium">/</span> {total}
                                </div>
                                <div className="text-[10px] text-zinc-400 font-medium pt-0.5 italic">completed</div>
                            </div>
                        </div>

                        <div className="space-y-3 mt-auto">
                            <div className="relative h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
                                <div
                                    className="absolute inset-y-0 left-0 bg-zinc-900 transition-all duration-700 ease-out z-10"
                                    style={{ width: `${donePct}%` }}
                                />
                                <div
                                    className="absolute inset-y-0 left-0 bg-zinc-400/30 transition-all duration-700 ease-out"
                                    style={{ width: `${donePct + progressPct}%` }}
                                />
                            </div>

                            <div className="flex items-center justify-between text-[10px]">
                                <div className="flex gap-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1 h-1 rounded-full bg-zinc-900" />
                                        <span className="text-zinc-500 font-medium uppercase tracking-wider">Done</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1 h-1 rounded-full bg-zinc-300" />
                                        <span className="text-zinc-500 font-medium uppercase tracking-wider">WIP</span>
                                    </div>
                                </div>
                                <span className="font-bold text-zinc-900 tabular-nums">{Math.round(donePct)}%</span>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    );
};
