
import React, { useMemo } from 'react';
import { Ticket, TicketStatus, User, Channel } from '../types';
import { Icons } from '../constants';

interface TicketBoardProps {
  tickets: Ticket[];
  channels: Channel[];
  users: User[];
  onTicketClick: (ticket: Ticket) => void;
  onStatusChange?: (ticketId: string, newStatus: TicketStatus) => void;
  groupByChannel?: boolean;
  groupByUser?: boolean;
}

const STATUS_COLUMNS = [
  { id: TicketStatus.Todo, label: 'To Do', color: 'bg-zinc-900' },
  { id: TicketStatus.InProgress, label: 'In Progress', color: 'bg-zinc-400' },
  { id: TicketStatus.Done, label: 'Done', color: 'bg-zinc-200' },
];

export const TicketBoard: React.FC<TicketBoardProps> = ({
  tickets,
  channels,
  users,
  onTicketClick,
  onStatusChange,
  groupByChannel = false,
  groupByUser = false
}) => {

  const handleDragStart = (e: React.DragEvent, ticketId: string) => {
    e.dataTransfer.setData('ticketId', ticketId);
  };

  const handleDrop = (e: React.DragEvent, status: TicketStatus) => {
    e.preventDefault();
    const ticketId = e.dataTransfer.getData('ticketId');
    if (ticketId && onStatusChange) {
      onStatusChange(ticketId, status);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };


  const renderCard = (ticket: Ticket) => {
    const assignee = users.find(u => u.id === ticket.assigneeId);
    return (
      <div
        key={ticket.id}
        draggable
        onDragStart={(e) => handleDragStart(e, ticket.id)}
        onClick={() => onTicketClick(ticket)}
        className="bg-white border border-zinc-200/60 p-5 rounded-none hover:border-zinc-300 hover:shadow-sm cursor-pointer transition-all duration-200 group active:cursor-grabbing"
      >
        <div className="flex justify-between items-start mb-4">
          <span className="text-[9px] font-mono text-zinc-400 tabular-nums uppercase tracking-widest">{ticket.shortId}</span>
          {ticket.priority !== 'None' && (
            <div className={`text-[8px] font-bold uppercase tracking-[0.2em] ${ticket.priority === 'Urgent' ? 'text-red-500' :
              ticket.priority === 'High' ? 'text-amber-600' : 'text-zinc-400'
              }`}>
              {ticket.priority}
            </div>
          )}
        </div>
        <h4 className="text-sm font-medium text-zinc-900 mb-6 leading-relaxed tracking-tight line-clamp-2">{ticket.title}</h4>
        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-2">
            {assignee ? (
              <div className="w-5 h-5 rounded-none bg-zinc-900 flex items-center justify-center text-[9px] text-white font-bold shadow-sm" title={assignee.name}>
                {assignee.initials}
              </div>
            ) : (
              <div className="w-5 h-5 rounded-none border border-dashed border-zinc-200" />
            )}
            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">{assignee?.name.split(' ')[0]}</span>
          </div>
          {ticket.dueDate && (
            <span className={`text-[9px] font-bold tabular-nums tracking-widest ${new Date(ticket.dueDate) < new Date() ? 'text-red-500/80' : 'text-zinc-400'}`}>
              {new Date(ticket.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase()}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderSwimlane = (title: string, icon: React.ReactNode, laneTickets: Ticket[], key: string, count: number) => (
    <div key={key} className="bg-white border-b border-zinc-100 overflow-hidden shrink-0">
      {/* Swimlane Header */}
      <div className="px-8 py-6 flex items-center justify-between bg-white">
        <div className="flex items-center gap-4">
          <div className="text-zinc-900">{icon}</div>
          <h3 className="text-sm font-serif font-medium text-zinc-900 tracking-tight">{title}</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-zinc-300 tabular-nums uppercase tracking-[0.2em]">{count} items</span>
        </div>
      </div>

      {/* Columns */}
      <div className="grid grid-cols-3 divide-x divide-zinc-200 border-t border-zinc-100 bg-zinc-50/40">
        {STATUS_COLUMNS.map(col => {
          const colTickets = laneTickets.filter(t => {
            if (col.id === TicketStatus.Todo) return t.status === TicketStatus.Todo || t.status === TicketStatus.Backlog;
            if (col.id === TicketStatus.Done) return t.status === TicketStatus.Done || t.status === TicketStatus.Canceled;
            return t.status === col.id;
          });

          return (
            <div
              key={col.id}
              className="flex flex-col min-h-[300px]"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <div className="px-8 py-4 flex items-center justify-between bg-white/50 border-b border-zinc-100">
                <span className="text-[9px] uppercase font-bold tracking-[0.25em] text-zinc-400">{col.label}</span>
                <span className="text-[9px] font-bold text-zinc-300 tabular-nums">{colTickets.length}</span>
              </div>
              <div className="flex-1 p-4 space-y-3">
                {colTickets.map(renderCard)}
                {colTickets.length === 0 && (
                  <div className="h-32 border border-dashed border-zinc-200 flex items-center justify-center group/drop transition-all hover:bg-zinc-100/30">
                    <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-zinc-300 group-hover/drop:text-zinc-400">Release to Move</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );

  if (groupByUser) {
    const unassignedTickets = tickets.filter(t => !t.assigneeId);

    return (
      <div className="flex flex-col h-full overflow-y-auto custom-scrollbar bg-white">
        {users.map(user => {
          const userTickets = tickets.filter(t => t.assigneeId === user.id);
          return renderSwimlane(
            user.name,
            <div className="w-5 h-5 bg-zinc-900 flex items-center justify-center text-[9px] text-white font-bold">{user.initials}</div>,
            userTickets,
            user.id,
            userTickets.length
          );
        })}

        {unassignedTickets.length > 0 && renderSwimlane(
          "Unassigned",
          <Icons.User className="w-4 h-4" />,
          unassignedTickets,
          "unassigned",
          unassignedTickets.length
        )}
      </div>
    );
  }

  if (groupByChannel) {
    const channelsWithTickets = channels.filter(c => tickets.some(t => t.channelId === c.id));

    if (channelsWithTickets.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-40 text-zinc-400 bg-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-30">No Active Flows</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full overflow-y-auto custom-scrollbar bg-white">
        {channelsWithTickets.map(channel => {
          const channelTickets = tickets.filter(t => t.channelId === channel.id);
          return renderSwimlane(
            channel.name,
            <Icons.Zap className="w-4 h-4" />,
            channelTickets,
            channel.id,
            channelTickets.length
          );
        })}
      </div>
    );
  }

  // Standard Column View (Fallback)
  return (
    <div className="grid grid-cols-3 h-full overflow-y-auto custom-scrollbar bg-zinc-50/50">
      {STATUS_COLUMNS.map((col, idx) => (
        <div key={col.id} className={`flex flex-col ${idx !== 2 ? 'border-r border-zinc-200/60' : ''}`}>
          <div className="px-8 py-6 border-b border-zinc-200/60 flex items-center justify-between sticky top-0 bg-white z-20">
            <span className="text-[10px] uppercase font-bold tracking-[0.3em] text-zinc-900">{col.label}</span>
            <span className="text-[10px] font-bold text-zinc-300 tabular-nums">
              {tickets.filter(t => {
                if (col.id === TicketStatus.Todo) return t.status === TicketStatus.Todo || t.status === TicketStatus.Backlog;
                if (col.id === TicketStatus.Done) return t.status === TicketStatus.Done || t.status === TicketStatus.Canceled;
                return t.status === col.id;
              }).length}
            </span>
          </div>
          <div
            className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            {tickets.filter(t => {
              if (col.id === TicketStatus.Todo) return t.status === TicketStatus.Todo || t.status === TicketStatus.Backlog;
              if (col.id === TicketStatus.Done) return t.status === TicketStatus.Done || t.status === TicketStatus.Canceled;
              return t.status === col.id;
            }).map(renderCard)}
            {tickets.filter(t => {
              if (col.id === TicketStatus.Todo) return t.status === TicketStatus.Todo || t.status === TicketStatus.Backlog;
              if (col.id === TicketStatus.Done) return t.status === TicketStatus.Done || t.status === TicketStatus.Canceled;
              return t.status === col.id;
            }).length === 0 && (
                <div className="h-full min-h-[200px] border border-dashed border-zinc-200 flex items-center justify-center group/drop transition-all hover:bg-zinc-100/30">
                  <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-zinc-300 group-hover/drop:text-zinc-400">Empty State</span>
                </div>
              )}
          </div>
        </div>
      ))}
    </div>
  );
};
