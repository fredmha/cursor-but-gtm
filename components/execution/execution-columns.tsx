import React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Icons } from '../../constants';
import { Ticket } from '../../types';
import { getStatusSelectOptions } from './executionStatus';
import { getTaskLabel, isTextRow } from './execution-core';
import { ExecutionColumnFactoryParams } from './executionTable.types';

/**
 * Purpose:
 * - Factory for execution table column definitions.
 *
 * Why this exists:
 * - Keeps `ExecutionBoard` thin by moving JSX-heavy cell rendering into a focused UI module.
 * - Keeps all per-column keyboard and edit-mode behavior in one location.
 *
 * Must not contain:
 * - store access
 * - campaign-level orchestration
 */
export const buildExecutionColumns = ({
  users,
  editorState,
  editorActions,
  rowActions
}: ExecutionColumnFactoryParams): ColumnDef<Ticket>[] => {
  const { editingCell, draftValue } = editorState;
  const { setDraftValue, startEditing, cancelEditing, commitDraft } = editorActions;

  return [
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
                  // Enter commits single-line edits; Escape cancels without persisting draft.
                  if (event.key === 'Enter') commitDraft();
                  if (event.key === 'Escape') cancelEditing();
                }}
              />
            ) : (
              <button
                onClick={() => startEditing(ticket.id, 'task', value)}
                className={`text-left w-full rounded px-1 py-1 ${isTextRow(ticket) ? 'italic text-zinc-600' : 'text-zinc-900'} hover:bg-zinc-100`}
              >
                {value || (isTextRow(ticket) ? 'Text row' : 'Untitled Task')}
              </button>
            )}
            <button
              onClick={() => rowActions.deleteRow(ticket.id)}
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
        if (isTextRow(ticket)) return <span className="text-xs text-zinc-300">--</span>;

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
            onKeyDown={event => {
              if (event.key === 'Escape') cancelEditing();
            }}
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
        if (isTextRow(ticket)) return <span className="text-xs text-zinc-300">--</span>;

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
            onKeyDown={event => {
              if (event.key === 'Escape') cancelEditing();
            }}
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
        if (isTextRow(ticket)) return <span className="text-xs text-zinc-300">--</span>;

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
            onKeyDown={event => {
              if (event.key === 'Escape') cancelEditing();
            }}
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
        if (isTextRow(ticket)) return <span className="text-xs text-zinc-300">--</span>;

        const isEditing = editingCell?.rowId === ticket.id && editingCell.columnId === 'status';
        const value = ticket.status;

        return isEditing ? (
          <select
            autoFocus
            value={draftValue}
            className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
            onChange={event => setDraftValue(event.target.value)}
            onBlur={commitDraft}
            onKeyDown={event => {
              if (event.key === 'Escape') cancelEditing();
            }}
          >
            {getStatusSelectOptions(value).map(status => (
              // Legacy statuses are intentionally included when needed to avoid hidden coercion.
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
              onClick={() => rowActions.openComponentsEditor(ticket.id)}
              className="px-2 py-1 rounded border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-100"
            >
              Manage
            </button>
          </div>
        );
      }
    }
  ];
};
