import React, { useEffect, useMemo, useState } from 'react';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useStore } from '../store';
import { Icons } from '../constants';
import { ExecutionRowType, Ticket, TicketStatus } from '../types';

type EditingCell = {
  rowId: string;
  columnId: 'task' | 'description' | 'deadline' | 'assigned' | 'status';
};

const STATUS_OPTIONS: TicketStatus[] = [
  TicketStatus.Todo,
  TicketStatus.InProgress,
  TicketStatus.Done
];

const getTaskLabel = (ticket: Ticket): string => {
  if (ticket.rowType === 'TEXT') {
    return ticket.executionText || ticket.title || '';
  }
  return ticket.title;
};

const ComponentsEditorModal: React.FC<{
  ticket: Ticket;
  elementOptions: { id: string; label: string; kind: string }[];
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

export const ExecutionBoard: React.FC = () => {
  const {
    campaign,
    users,
    getExecutionRows,
    addExecutionRow,
    updateExecutionRow,
    deleteExecutionRow
  } = useStore();

  const rows = useMemo(() => getExecutionRows(), [campaign, getExecutionRows]);

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [componentsEditorRowId, setComponentsEditorRowId] = useState<string | null>(null);
  const [pendingRowFocus, setPendingRowFocus] = useState(false);

  useEffect(() => {
    if (!pendingRowFocus || rows.length === 0) return;
    const newest = rows[rows.length - 1];
    setEditingCell({ rowId: newest.id, columnId: 'task' });
    setDraftValue(getTaskLabel(newest));
    setPendingRowFocus(false);
  }, [pendingRowFocus, rows]);

  const canvasElementOptions = useMemo(() => {
    return (campaign?.canvasScene?.elements || []).map(element => ({
      id: element.id,
      label: element.text || `${element.kind} ${element.id.slice(0, 6)}`,
      kind: element.kind
    }));
  }, [campaign?.canvasScene?.elements]);

  const componentsEditorTicket = useMemo(
    () => rows.find(row => row.id === componentsEditorRowId) || null,
    [componentsEditorRowId, rows]
  );

  const startEditing = (rowId: string, columnId: EditingCell['columnId'], value: string) => {
    setEditingCell({ rowId, columnId });
    setDraftValue(value);
  };

  const commitDraft = () => {
    if (!editingCell) return;
    const ticket = rows.find(row => row.id === editingCell.rowId);
    if (!ticket) {
      setEditingCell(null);
      setDraftValue('');
      return;
    }

    if (editingCell.columnId === 'task') {
      if (ticket.rowType === 'TEXT') {
        updateExecutionRow(ticket.id, {
          executionText: draftValue,
          title: draftValue.trim() || 'Note',
          rowType: 'TEXT'
        });
      } else {
        updateExecutionRow(ticket.id, { title: draftValue.trim() || 'Untitled Task', rowType: 'TASK' });
      }
    }

    if (editingCell.columnId === 'description' && ticket.rowType !== 'TEXT') {
      updateExecutionRow(ticket.id, { description: draftValue });
    }

    if (editingCell.columnId === 'deadline' && ticket.rowType !== 'TEXT') {
      updateExecutionRow(ticket.id, { dueDate: draftValue || undefined });
    }

    if (editingCell.columnId === 'assigned' && ticket.rowType !== 'TEXT') {
      updateExecutionRow(ticket.id, { assigneeId: draftValue || undefined });
    }

    if (editingCell.columnId === 'status' && ticket.rowType !== 'TEXT') {
      updateExecutionRow(ticket.id, {
        status: (STATUS_OPTIONS.includes(draftValue as TicketStatus) ? draftValue : TicketStatus.Todo) as TicketStatus
      });
    }

    setEditingCell(null);
    setDraftValue('');
  };

  const addRow = (rowType: ExecutionRowType) => {
    if (rowType === 'TEXT') {
      addExecutionRow({ rowType: 'TEXT', executionText: 'New text row', title: 'Note' });
    } else {
      addExecutionRow({ rowType: 'TASK', title: 'New Task', status: TicketStatus.Todo });
    }
    setShowAddMenu(false);
    setPendingRowFocus(true);
  };

  const columns = useMemo<ColumnDef<Ticket>[]>(() => [
    {
      id: 'task',
      header: 'Task',
      cell: ({ row }) => {
        const ticket = row.original;
        const isEditing = editingCell?.rowId === ticket.id && editingCell.columnId === 'task';
        const value = getTaskLabel(ticket);

        return (
          <div className="flex items-center gap-2">
            {isEditing ? (
              <input
                autoFocus
                value={draftValue}
                className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                onChange={event => setDraftValue(event.target.value)}
                onBlur={commitDraft}
                onKeyDown={event => {
                  if (event.key === 'Enter') commitDraft();
                  if (event.key === 'Escape') setEditingCell(null);
                }}
              />
            ) : (
              <button
                onClick={() => startEditing(ticket.id, 'task', value)}
                className={`text-left w-full rounded px-1 py-1 ${ticket.rowType === 'TEXT' ? 'italic text-zinc-600' : 'text-zinc-900'} hover:bg-zinc-100`}
              >
                {value || (ticket.rowType === 'TEXT' ? 'Text row' : 'Untitled Task')}
              </button>
            )}
            <button
              onClick={() => deleteExecutionRow(ticket.id)}
              className="text-zinc-400 hover:text-red-600"
              title="Delete row"
            >
              <Icons.Trash className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      }
    },
    {
      id: 'description',
      header: 'Description',
      cell: ({ row }) => {
        const ticket = row.original;
        if (ticket.rowType === 'TEXT') return <span className="text-xs text-zinc-300">--</span>;

        const isEditing = editingCell?.rowId === ticket.id && editingCell.columnId === 'description';
        const value = ticket.description || '';

        return isEditing ? (
          <textarea
            autoFocus
            rows={2}
            value={draftValue}
            className="w-full rounded border border-zinc-300 px-2 py-1 text-sm resize-none"
            onChange={event => setDraftValue(event.target.value)}
            onBlur={commitDraft}
          />
        ) : (
          <button
            onClick={() => startEditing(ticket.id, 'description', value)}
            className="text-left w-full rounded px-1 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            {value || 'Add description'}
          </button>
        );
      }
    },
    {
      id: 'deadline',
      header: 'Deadline',
      cell: ({ row }) => {
        const ticket = row.original;
        if (ticket.rowType === 'TEXT') return <span className="text-xs text-zinc-300">--</span>;

        const isEditing = editingCell?.rowId === ticket.id && editingCell.columnId === 'deadline';
        const value = ticket.dueDate ? ticket.dueDate.slice(0, 10) : '';

        return isEditing ? (
          <input
            autoFocus
            type="date"
            value={draftValue}
            className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
            onChange={event => setDraftValue(event.target.value)}
            onBlur={commitDraft}
          />
        ) : (
          <button
            onClick={() => startEditing(ticket.id, 'deadline', value)}
            className="text-left w-full rounded px-1 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            {value || 'Set date'}
          </button>
        );
      }
    },
    {
      id: 'assigned',
      header: 'Assigned',
      cell: ({ row }) => {
        const ticket = row.original;
        if (ticket.rowType === 'TEXT') return <span className="text-xs text-zinc-300">--</span>;

        const isEditing = editingCell?.rowId === ticket.id && editingCell.columnId === 'assigned';
        const value = ticket.assigneeId || '';
        const assignee = users.find(user => user.id === ticket.assigneeId);

        return isEditing ? (
          <select
            autoFocus
            value={draftValue}
            className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
            onChange={event => setDraftValue(event.target.value)}
            onBlur={commitDraft}
          >
            <option value="">Unassigned</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
        ) : (
          <button
            onClick={() => startEditing(ticket.id, 'assigned', value)}
            className="text-left w-full rounded px-1 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            {assignee?.name || 'Unassigned'}
          </button>
        );
      }
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const ticket = row.original;
        if (ticket.rowType === 'TEXT') return <span className="text-xs text-zinc-300">--</span>;

        const isEditing = editingCell?.rowId === ticket.id && editingCell.columnId === 'status';
        const value = ticket.status;

        return isEditing ? (
          <select
            autoFocus
            value={draftValue}
            className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
            onChange={event => setDraftValue(event.target.value)}
            onBlur={commitDraft}
          >
            {STATUS_OPTIONS.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        ) : (
          <button
            onClick={() => startEditing(ticket.id, 'status', value)}
            className="text-left w-full rounded px-1 py-1 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            {value}
          </button>
        );
      }
    },
    {
      id: 'components',
      header: 'Components',
      cell: ({ row }) => {
        const ticket = row.original;
        const linked = ticket.canvasItemIds || [];

        return (
          <div className="flex items-center gap-2">
            <span className={`text-xs ${linked.length > 0 ? 'text-indigo-600 font-semibold' : 'text-zinc-400'}`}>
              {linked.length > 0 ? `${linked.length} linked` : 'None'}
            </span>
            <button
              onClick={() => setComponentsEditorRowId(ticket.id)}
              className="px-2 py-1 rounded border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-100"
            >
              Manage
            </button>
          </div>
        );
      }
    }
  ], [commitDraft, deleteExecutionRow, draftValue, editingCell, users]);

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
                  onClick={() => addRow('TASK')}
                  className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-zinc-100"
                >
                  Task row
                </button>
                <button
                  onClick={() => addRow('TEXT')}
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
        <ComponentsEditorModal
          ticket={componentsEditorTicket}
          elementOptions={canvasElementOptions}
          initialSelected={componentsEditorTicket.canvasItemIds || []}
          onClose={() => setComponentsEditorRowId(null)}
          onSave={(ids) => {
            updateExecutionRow(componentsEditorTicket.id, { canvasItemIds: ids });
            setComponentsEditorRowId(null);
          }}
        />
      )}
    </div>
  );
};
