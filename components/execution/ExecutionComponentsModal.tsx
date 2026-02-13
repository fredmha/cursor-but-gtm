import React, { useState } from 'react';
import { Icons } from '../../constants';
import { Ticket } from '../../types';
import { ExecutionElementOption } from './executionTable.types';
import { getTaskLabel } from './execution-core';

/**
 * Purpose:
 * - Presentational modal for linking execution rows to canvas elements.
 *
 * Contract:
 * - Parent owns source-of-truth persistence.
 * - This component only manages temporary checkbox state while open.
 *
 * Must not contain:
 * - store access
 * - ticket mutation logic
 */
export const ExecutionComponentsModal: React.FC<{
  ticket: Ticket;
  elementOptions: ExecutionElementOption[];
  initialSelected: string[];
  onClose: () => void;
  onSave: (ids: string[]) => void;
}> = ({ ticket, elementOptions, initialSelected, onClose, onSave }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelected);

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-[560px] max-h-[70vh] bg-white border border-zinc-200 rounded-xl shadow-2xl p-4 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-900">Link Components</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700">
            <Icons.XCircle className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-500 mb-3">{getTaskLabel(ticket) || 'Untitled row'}</p>

        <div className="flex-1 overflow-y-auto border border-zinc-100 rounded-lg">
          {elementOptions.length === 0 && (
            <div className="p-4 text-sm text-zinc-400 text-center">No canvas components available yet.</div>
          )}
          {elementOptions.map(option => {
            const checked = selectedIds.includes(option.id);
            return (
              <label key={option.id} className="flex items-center gap-3 px-3 py-2 border-b border-zinc-50 hover:bg-zinc-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={event => {
                    // Keep local draft immutable so cancel closes without side effects.
                    setSelectedIds(prev => {
                      if (event.target.checked) return [...prev, option.id];
                      return prev.filter(id => id !== option.id);
                    });
                  }}
                />
                <span className="text-sm text-zinc-700 flex-1 truncate">{option.label}</span>
                <span className="text-[10px] uppercase tracking-wider text-zinc-400">{option.kind}</span>
              </label>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-800">Cancel</button>
          <button
            onClick={() => onSave(selectedIds)}
            className="px-4 py-1.5 rounded bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
