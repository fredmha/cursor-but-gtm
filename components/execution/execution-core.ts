import { Ticket } from '../../types';
import { CommitContext, ExecutionEditableColumn } from './executionTable.types';

/**
 * Purpose:
 * - Pure execution-table helpers used by the editor/controller layer.
 *
 * Inputs:
 * - Ticket rows and primitive draft values.
 *
 * Outputs:
 * - Normalized values and mutation payloads for store update calls.
 *
 * Must not contain:
 * - React hooks/components
 * - direct store access
 * - side effects
 */

/**
 * Invariant:
 * - TEXT rows are note-like rows that only support "task" column editing.
 */
export const isTextRow = (ticket: Ticket): boolean => ticket.rowType === 'TEXT';

/**
 * Invariant:
 * - Non-TEXT rows are treated as TASK rows for execution editing behavior.
 */
export const isTaskRow = (ticket: Ticket): boolean => !isTextRow(ticket);

/**
 * Returns the visible task label used in table cells and modal subtitle.
 * For TEXT rows we prioritize executionText, then title as fallback.
 */
export const getTaskLabel = (ticket: Ticket): string => {
  if (isTextRow(ticket)) {
    return ticket.executionText || ticket.title || '';
  }
  return ticket.title;
};

/**
 * Normalizes raw draft text before commit payload assembly.
 *
 * Notes:
 * - Description keeps exact user text (including intentional leading/trailing spaces).
 * - Date/assignee/status are trimmed so accidental whitespace does not produce invalid writes.
 * - Task column keeps original draft for executionText but title fallback uses trim in payload builder.
 */
export const normalizeDraftForColumn = (columnId: ExecutionEditableColumn, draftValue: string): string => {
  if (columnId === 'description' || columnId === 'task') return draftValue;
  return draftValue.trim();
};

/**
 * Builds the minimal ticket update payload for one committed cell edit.
 *
 * Contracts:
 * - Returns `null` for no-op/unsupported transitions.
 * - Never mutates input row.
 * - Enforces TEXT-row constraints for non-task columns.
 */
export const buildTicketUpdateFromCommit = (context: CommitContext): Partial<Ticket> | null => {
  const { row, columnId, draftValue, resolvedStatus } = context;
  const normalizedDraft = normalizeDraftForColumn(columnId, draftValue);

  if (columnId === 'task') {
    if (isTextRow(row)) {
      return {
        executionText: normalizedDraft,
        title: normalizedDraft.trim() || 'Note',
        rowType: 'TEXT'
      };
    }

    return {
      title: normalizedDraft.trim() || 'Untitled Task',
      rowType: 'TASK'
    };
  }

  if (isTextRow(row)) {
    // Non-task edits are intentionally blocked for TEXT rows.
    return null;
  }

  if (columnId === 'description') {
    return { description: normalizedDraft };
  }

  if (columnId === 'deadline') {
    return { dueDate: normalizedDraft || undefined };
  }

  if (columnId === 'assigned') {
    return { assigneeId: normalizedDraft || undefined };
  }

  if (columnId === 'status') {
    if (!resolvedStatus) return null;
    return { status: resolvedStatus };
  }

  return null;
};
