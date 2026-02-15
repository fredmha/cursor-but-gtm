import React from 'react';
import { Icons } from '../../constants';
import { TicketRef } from './canvas-core';

type CanvasTicketLinkModalProps = {
  open: boolean;
  hasSelectedLinkOwner: boolean;
  search: string;
  tickets: TicketRef[];
  draftLinkedTicketIds: string[];
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onToggleTicket: (ticketId: string, checked: boolean) => void;
  onSave: () => void;
};

/**
 * Ticket linking modal for the selected container owner.
 * Inputs: open state, filtered ticket list, selection draft, handlers.
 * Output: modal UI or null.
 * Invariant: emits changes through callbacks only.
 */
export const CanvasTicketLinkModal: React.FC<CanvasTicketLinkModalProps> = ({
  open,
  hasSelectedLinkOwner,
  search,
  tickets,
  draftLinkedTicketIds,
  onClose,
  onSearchChange,
  onToggleTicket,
  onSave
}) => {
  if (!open || !hasSelectedLinkOwner) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-[520px] max-h-[70vh] bg-white border border-zinc-200 rounded-xl shadow-2xl p-4 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-900">Link Selected Container to Tickets</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <Icons.XCircle className="w-4 h-4" />
          </button>
        </div>

        <input
          autoFocus
          value={search}
          placeholder="Search tickets..."
          className="w-full rounded border border-zinc-200 px-3 py-2 text-sm mb-3"
          onChange={event => onSearchChange(event.target.value)}
        />

        <div className="flex-1 overflow-y-auto custom-scrollbar border border-zinc-100 rounded-lg">
          {tickets.map(ticket => {
            const checked = draftLinkedTicketIds.includes(ticket.id);
            return (
              <label key={ticket.id} className="flex items-center gap-3 px-3 py-2 border-b border-zinc-50 hover:bg-zinc-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={event => onToggleTicket(ticket.id, event.target.checked)}
                />
                <span className="text-xs font-mono text-zinc-400">{ticket.shortId}</span>
                <span className="text-sm text-zinc-700 flex-1 truncate">{ticket.title}</span>
                <span className="text-[10px] uppercase tracking-wider text-zinc-400">{ticket.parentType}</span>
              </label>
            );
          })}

          {tickets.length === 0 && (
            <div className="p-4 text-sm text-zinc-400 text-center">No matching tickets.</div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-800">Cancel</button>
          <button onClick={onSave} className="px-4 py-1.5 rounded bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800">Save Links</button>
        </div>
      </div>
    </div>
  );
};
