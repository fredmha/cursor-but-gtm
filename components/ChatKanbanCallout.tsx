import React from 'react';
import { Ticket, User, Channel, TicketStatus } from '../types';
import { Icons } from '../constants';
import { TicketBoard } from './TicketBoard';

interface ChatKanbanCalloutProps {
  title?: string;
  tickets: Ticket[];
  channels: Channel[];
  users: User[];
  onTicketClick: (ticket: Ticket) => void;
  onStatusChange: (ticketId: string, newStatus: TicketStatus) => void;
}

export const ChatKanbanCallout: React.FC<ChatKanbanCalloutProps> = ({
  title,
  tickets,
  channels,
  users,
  onTicketClick,
  onStatusChange
}) => {
  return (
    <div className="my-6 border border-zinc-200 bg-white shadow-sm rounded-none overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-none flex items-center justify-center border border-zinc-900 bg-white shadow-sm">
            <Icons.Kanban className="w-4 h-4 text-zinc-900" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Task Board</span>
            <span className="text-sm font-serif font-medium text-zinc-900 tracking-tight">{title || 'Tasks'}</span>
          </div>
        </div>
        <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-[0.2em]">{tickets.length} items</span>
      </div>
      <div className="h-[420px] bg-white">
        <TicketBoard
          tickets={tickets}
          channels={channels}
          users={users}
          onTicketClick={onTicketClick}
          onStatusChange={onStatusChange}
          groupByChannel={false}
        />
      </div>
    </div>
  );
};
