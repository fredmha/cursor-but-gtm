
import React from 'react';
import { User, Ticket, TicketStatus } from '../types';

interface TeamHealthHeaderProps {
    users: User[];
    tickets: Ticket[];
}

export const TeamHealthHeader: React.FC<TeamHealthHeaderProps> = ({ users, tickets }) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {users.map(user => {
                const userTickets = tickets.filter(t => t.assigneeId === user.id && t.status !== TicketStatus.Backlog && t.status !== TicketStatus.Canceled);
                const done = userTickets.filter(t => t.status === TicketStatus.Done).length;
                const inProgress = userTickets.filter(t => t.status === TicketStatus.InProgress).length;
                const todo = userTickets.filter(t => t.status === TicketStatus.Todo).length;
                const total = userTickets.length;
                
                // Calculate percentages
                const donePct = total > 0 ? (done / total) * 100 : 0;
                const progressPct = total > 0 ? (inProgress / total) * 100 : 0;
                
                return (
                    <div key={user.id} className="bg-white border border-zinc-100 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full ${user.color} flex items-center justify-center text-xs font-bold text-white shadow-sm`}>
                                    {user.initials}
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-zinc-900">{user.name}</div>
                                    <div className="text-[10px] text-zinc-500 font-medium">{total} active tasks</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-lg font-mono font-bold text-zinc-900 leading-none">{done}<span className="text-zinc-300 text-sm">/{total}</span></div>
                            </div>
                        </div>
                        
                        <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden flex">
                            <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${donePct}%` }} />
                            <div className="bg-amber-400 h-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                        </div>
                        
                        <div className="flex justify-between text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                            <span>To Do: {todo}</span>
                            <span>WIP: {inProgress}</span>
                            <span>Done: {done}</span>
                        </div>
                    </div>
                )
            })}
        </div>
    );
};
