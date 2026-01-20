
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
}

const STATUS_COLUMNS = [
  { id: TicketStatus.Todo, label: 'To Do', color: 'bg-zinc-500' },
  { id: TicketStatus.InProgress, label: 'In Progress', color: 'bg-amber-500' },
  { id: TicketStatus.Done, label: 'Done', color: 'bg-emerald-500' },
];

export const TicketBoard: React.FC<TicketBoardProps> = ({ 
  tickets, 
  channels, 
  users, 
  onTicketClick,
  onStatusChange,
  groupByChannel = false 
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
        className="bg-zinc-800 border border-zinc-700 p-3 rounded shadow-sm hover:border-zinc-500 hover:shadow-md cursor-pointer transition-all group active:cursor-grabbing"
      >
        <div className="flex justify-between items-start mb-2">
          <span className="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-400">{ticket.shortId}</span>
          {ticket.priority !== 'None' && (
             <div className={`w-1.5 h-1.5 rounded-full ${
                ticket.priority === 'Urgent' ? 'bg-red-500' : 
                ticket.priority === 'High' ? 'bg-orange-500' : 'bg-blue-500'
             }`}></div>
          )}
        </div>
        <h4 className="text-xs font-medium text-zinc-200 mb-2 leading-snug line-clamp-2">{ticket.title}</h4>
        <div className="flex items-center justify-between">
            <div className="flex -space-x-1">
                {assignee && (
                    <div className={`w-4 h-4 rounded-full ${assignee.color} flex items-center justify-center text-[6px] text-white font-bold ring-1 ring-zinc-800`} title={assignee.name}>
                        {assignee.initials}
                    </div>
                )}
            </div>
            {ticket.dueDate && (
                <span className={`text-[9px] font-mono ${new Date(ticket.dueDate) < new Date() ? 'text-red-400' : 'text-zinc-500'}`}>
                    {new Date(ticket.dueDate).toLocaleDateString(undefined, {month: 'numeric', day: 'numeric'})}
                </span>
            )}
        </div>
      </div>
    );
  };

  const renderSwimlane = (title: string, icon: React.ReactNode, laneTickets: Ticket[], key: string, count: number) => (
      <div key={key} className="bg-zinc-900/30 border border-zinc-800 rounded-xl overflow-hidden shrink-0">
          {/* Swimlane Header */}
          <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center gap-2">
              <div className="p-1 rounded bg-zinc-800 text-zinc-400">{icon}</div>
              <h3 className="text-xs font-bold text-zinc-300">{title}</h3>
              <span className="text-[10px] text-zinc-500 font-mono ml-auto">{count} tickets</span>
          </div>
          
          {/* Columns */}
          <div className="grid grid-cols-3 divide-x divide-zinc-800">
              {STATUS_COLUMNS.map(col => {
                  const colTickets = laneTickets.filter(t => {
                      if (col.id === TicketStatus.Todo) return t.status === TicketStatus.Todo || t.status === TicketStatus.Backlog;
                      if (col.id === TicketStatus.Done) return t.status === TicketStatus.Done || t.status === TicketStatus.Canceled;
                      return t.status === col.id;
                  });
                  
                  return (
                      <div 
                        key={col.id} 
                        className="p-3 min-h-[120px]"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, col.id)}
                      >
                          <div className="mb-2 flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${col.color}`}></div>
                              <span className="text-[10px] uppercase font-bold text-zinc-600">{col.label}</span>
                          </div>
                          <div className="space-y-2">
                              {colTickets.map(renderCard)}
                          </div>
                          {colTickets.length === 0 && (
                              <div className="h-full border-2 border-dashed border-zinc-800/50 rounded flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                  <span className="text-[9px] text-zinc-700">Drop here</span>
                              </div>
                          )}
                      </div>
                  )
              })}
          </div>
      </div>
  );

  if (groupByChannel) {
    // Separate tickets into those with a channel and those without (General/Project-Direct)
    const generalTickets = tickets.filter(t => !t.channelId);
    const channelsWithTickets = channels.filter(c => tickets.some(t => t.channelId === c.id));
    
    if (generalTickets.length === 0 && channelsWithTickets.length === 0) {
        return (
             <div className="text-center py-10 text-zinc-500 italic text-xs">No tickets found for this project.</div>
        );
    }

    return (
      <div className="flex flex-col h-full overflow-y-auto custom-scrollbar space-y-6 pb-10">
         
         {/* General Project Tasks Swimlane */}
         {generalTickets.length > 0 && renderSwimlane(
             "General Project Tasks", 
             <Icons.Target className="w-3 h-3" />, 
             generalTickets, 
             "general_lane", 
             generalTickets.length
         )}

         {/* Channel Swimlanes */}
         {channelsWithTickets.map(channel => {
             const channelTickets = tickets.filter(t => t.channelId === channel.id);
             return renderSwimlane(
                 channel.name,
                 <Icons.Zap className="w-3 h-3" />,
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
      <div className="grid grid-cols-3 gap-4 h-full overflow-y-auto p-1">
          {STATUS_COLUMNS.map(col => (
               <div key={col.id} className="flex flex-col bg-zinc-900/30 rounded-xl border border-zinc-800 h-full">
                    <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-400">{col.label}</span>
                        <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500">{tickets.filter(t => t.status === col.id).length}</span>
                    </div>
                    <div 
                        className="p-3 flex-1 space-y-2 overflow-y-auto custom-scrollbar"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, col.id)}
                    >
                        {tickets.filter(t => {
                             if (col.id === TicketStatus.Todo) return t.status === TicketStatus.Todo || t.status === TicketStatus.Backlog;
                             if (col.id === TicketStatus.Done) return t.status === TicketStatus.Done || t.status === TicketStatus.Canceled;
                             return t.status === col.id;
                        }).map(renderCard)}
                    </div>
               </div>
          ))}
      </div>
  );
};
