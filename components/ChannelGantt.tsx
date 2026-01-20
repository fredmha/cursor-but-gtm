
import React from 'react';
import { Bet, Ticket, TicketStatus } from '../types';
import { Icons } from '../constants';

interface ChannelGanttProps {
  bets: Bet[];
  tickets: Ticket[];
  weekCount?: number;
}

const WEEK_WIDTH = 120;
const HEADER_HEIGHT = 40;
const ROW_HEIGHT = 40;

export const ChannelGantt: React.FC<ChannelGanttProps> = ({ bets, tickets, weekCount = 12 }) => {
    // We assume the campaign starts "now" for this simple view, or use ticket dates
    // For simplicity, we'll map dates to weeks if available, or just list them.
    // Given the lack of strict date enforcement on tickets, we will use a relative timeline
    // based on created date or due date relative to "Now".
    
    const now = new Date();
    const startOfView = new Date(now);
    startOfView.setDate(startOfView.getDate() - (startOfView.getDay() === 0 ? 6 : startOfView.getDay() - 1)); // Start of this week
    
    const weeks = Array.from({ length: weekCount }).map((_, i) => {
        const d = new Date(startOfView);
        d.setDate(d.getDate() + (i * 7));
        return d;
    });

    const getPosition = (dateStr?: string) => {
        if (!dateStr) return { left: 0, width: WEEK_WIDTH }; // Default to week 1 duration
        const date = new Date(dateStr);
        const diffTime = date.getTime() - startOfView.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const left = (diffDays / 7) * WEEK_WIDTH;
        return { left: Math.max(0, left), width: WEEK_WIDTH }; // Default 1 week duration for point-in-time
    };
    
    const getDurationPos = (startStr: string, endStr?: string) => {
        const start = new Date(startStr);
        const end = endStr ? new Date(endStr) : new Date(start.getTime() + (7 * 24 * 60 * 60 * 1000));
        
        const startDiff = start.getTime() - startOfView.getTime();
        const startDays = startDiff / (1000 * 60 * 60 * 24);
        const left = (startDays / 7) * WEEK_WIDTH;
        
        const durationDiff = end.getTime() - start.getTime();
        const durationDays = durationDiff / (1000 * 60 * 60 * 24);
        const width = (durationDays / 7) * WEEK_WIDTH;
        
        return { left: Math.max(0, left), width: Math.max(20, width) };
    };

    return (
        <div className="flex flex-col h-full bg-[#09090b] overflow-hidden">
            {/* Header */}
            <div className="flex border-b border-zinc-800 bg-zinc-950 shrink-0">
                <div className="w-64 shrink-0 border-r border-zinc-800 p-3 text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-end">
                    Initiative / Task
                </div>
                <div className="flex-1 overflow-hidden relative" style={{ height: HEADER_HEIGHT }}>
                     <div className="flex absolute inset-0">
                        {weeks.map((w, i) => (
                            <div key={i} className="shrink-0 border-r border-zinc-800/50 flex flex-col justify-center px-2" style={{ width: WEEK_WIDTH }}>
                                <span className="text-[10px] text-zinc-500 font-mono">W{i + 1}</span>
                                <span className="text-[10px] font-bold text-zinc-300">{w.toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}</span>
                            </div>
                        ))}
                     </div>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto custom-scrollbar relative">
                <div className="flex flex-col min-w-max">
                    {/* Grid Background */}
                    <div className="absolute inset-0 left-64 flex pointer-events-none z-0">
                         {weeks.map((_, i) => (
                             <div key={i} className="shrink-0 border-r border-zinc-800/30 h-full" style={{ width: WEEK_WIDTH }}></div>
                         ))}
                    </div>

                    {bets.map(bet => {
                        const betTickets = tickets.filter(t => t.betId === bet.id);
                        if (betTickets.length === 0) return null;

                        return (
                            <div key={bet.id} className="relative z-10 border-b border-zinc-800/50">
                                {/* Bet Row */}
                                <div className="flex h-10 bg-zinc-900/30">
                                    <div className="w-64 shrink-0 border-r border-zinc-800 p-2 flex items-center gap-2 truncate sticky left-0 bg-zinc-900 z-20">
                                        <div className={`w-1.5 h-1.5 rounded-full ${bet.status === 'Active' ? 'bg-indigo-500' : 'bg-zinc-600'}`}></div>
                                        <span className="text-xs font-bold text-zinc-300 truncate">{bet.description}</span>
                                    </div>
                                    <div className="flex-1 relative">
                                        {/* Bet Duration Bar (Hypothetical or strictly visual container) */}
                                    </div>
                                </div>

                                {/* Ticket Rows */}
                                {betTickets.map(ticket => {
                                    // Use dueDate for positioning. If no due date, use createdAt.
                                    // ideally we have start/end.
                                    const pos = ticket.dueDate 
                                        ? getDurationPos(ticket.createdAt, ticket.dueDate) 
                                        : getPosition(ticket.createdAt);

                                    return (
                                        <div key={ticket.id} className="flex h-8 hover:bg-zinc-800/20 group">
                                            <div className="w-64 shrink-0 border-r border-zinc-800 pl-6 pr-2 py-1 flex items-center gap-2 truncate sticky left-0 bg-[#09090b] group-hover:bg-zinc-900 z-20">
                                                <div className={`w-1 h-1 rounded-full ${ticket.status === TicketStatus.Done ? 'bg-emerald-500' : 'bg-zinc-500'}`}></div>
                                                <span className="text-[11px] text-zinc-400 truncate">{ticket.title}</span>
                                            </div>
                                            <div className="flex-1 relative">
                                                <div 
                                                    className={`absolute top-1.5 h-5 rounded-sm border text-[9px] flex items-center px-1 truncate
                                                        ${ticket.status === TicketStatus.Done 
                                                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                                                            : 'bg-zinc-700 border-zinc-600 text-zinc-300'}`}
                                                    style={{ left: pos.left, width: pos.width }}
                                                >
                                                    {ticket.title}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
