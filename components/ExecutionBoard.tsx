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
      <div className="h-14 border-b border-zinc-100 px-4 lg:px-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icons.Database className="w-4 h-4 text-zinc-500" />
          <h2 className="text-sm font-bold">Execution Table</h2>
        </div>
        <span className="text-xs text-zinc-500">{rows.length} rows</span>
      </div>

      <div className="flex-1 overflow-auto p-3 lg:p-4">
        <div className="w-full border border-zinc-200 rounded-xl overflow-x-auto overflow-y-hidden">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="bg-zinc-50 border-b border-zinc-200">
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="text-left text-[11px] uppercase tracking-wider text-zinc-500 px-2.5 py-2 font-semibold">
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
                    <td key={cell.id} className="px-2.5 py-2 align-top text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-2.5 py-2 bg-zinc-50 border-t border-zinc-200 relative">
            <button
              onClick={handleAddRow}
              className="inline-flex items-center gap-2 px-2 py-1 rounded text-sm text-zinc-600 hover:bg-zinc-100"
            >
              <Icons.Plus className="w-4 h-4" />
              Add task row
            </button>
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
