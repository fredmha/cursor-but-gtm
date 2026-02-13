import React from 'react';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Icons } from '../constants';
import { ExecutionComponentsModal } from './execution/ExecutionComponentsModal';
import { useExecutionController } from './execution/useExecutionController';

/**
 * Purpose:
 * - Thin orchestration shell for the Execution workspace.
 *
 * Why this file stays thin:
 * - Runtime behavior/state lives in `useExecutionController`.
 * - Cell rendering logic lives in `execution-columns`.
 * - This boundary keeps future execution UI changes decoupled from edit/store logic.
 */
export const ExecutionBoard: React.FC = () => {
  const {
    rows,
    columns,
    showAddMenu,
    setShowAddMenu,
    handleAddRow,
    canvasElementOptions,
    componentsEditorTicket,
    closeComponentsEditor,
    saveComponentsLinks
  } = useExecutionController();

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  return (
    <div className="h-full flex flex-col bg-white text-zinc-900">
      <div className="h-14 border-b border-zinc-100 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icons.Database className="w-4 h-4 text-zinc-500" />
          <h2 className="text-sm font-bold">Execution Table</h2>
        </div>
        <span className="text-xs text-zinc-500">{rows.length} rows</span>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="border border-zinc-200 rounded-xl overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="bg-zinc-50 border-b border-zinc-200">
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="text-left text-[11px] uppercase tracking-wider text-zinc-500 px-3 py-2 font-semibold">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr key={row.id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-3 py-2 align-top text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-3 py-2 bg-zinc-50 border-t border-zinc-200 relative">
            <button
              onClick={() => setShowAddMenu(value => !value)}
              className="inline-flex items-center gap-2 px-2 py-1 rounded text-sm text-zinc-600 hover:bg-zinc-100"
            >
              <Icons.Plus className="w-4 h-4" />
              Add row
            </button>
            {showAddMenu && (
              <div className="absolute left-3 bottom-11 z-10 w-44 bg-white border border-zinc-200 rounded-lg shadow-lg p-1">
                <button
                  onClick={() => handleAddRow('TASK')}
                  className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-zinc-100"
                >
                  Task row
                </button>
                <button
                  onClick={() => handleAddRow('TEXT')}
                  className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-zinc-100"
                >
                  Text row
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {componentsEditorTicket && (
        <ExecutionComponentsModal
          ticket={componentsEditorTicket}
          elementOptions={canvasElementOptions}
          initialSelected={componentsEditorTicket.canvasItemIds || []}
          onClose={closeComponentsEditor}
          onSave={ids => saveComponentsLinks(componentsEditorTicket.id, ids)}
        />
      )}
    </div>
  );
};
