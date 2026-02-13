import { useCallback, useState } from 'react';
import { Ticket } from '../../types';
import { EditingCell, ExecutionEditableColumn } from './executionTable.types';
import { resolveStatusCommit } from './executionStatus';
import { buildTicketUpdateFromCommit } from './execution-core';

type UseExecutionCellEditorParams = {
  rows: Ticket[];
  updateExecutionRow: (ticketId: string, updates: Partial<Ticket>) => void;
};

type StartEditingFn = (rowId: string, columnId: ExecutionEditableColumn, value: string) => void;

export const useExecutionCellEditor = ({ rows, updateExecutionRow }: UseExecutionCellEditorParams) => {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [draftValue, setDraftValue] = useState('');

  /**
   * State-machine reset transition:
   * editing -> idle
   *
   * Invariant:
   * - cancel and commit must both clear draft to prevent cross-row leakage.
   */
  const clearEditingState = useCallback(() => {
    setEditingCell(null);
    setDraftValue('');
  }, []);

  const startEditing: StartEditingFn = useCallback((rowId, columnId, value) => {
    setEditingCell({ rowId, columnId });
    setDraftValue(value);
  }, []);

  const cancelEditing = useCallback(() => {
    clearEditingState();
  }, [clearEditingState]);

  /**
   * Commit transition:
   * editing -> commit/no-op -> idle
   *
   * Edge-case handling:
   * - Missing row (stale edit pointer after data change) becomes safe no-op + reset.
   * - Status writes only happen when resolution layer accepts draft.
   * - Payload assembly is delegated to `execution-core` to keep this hook focused on session state.
   */
  const commitDraft = useCallback(() => {
    if (!editingCell) return;

    const ticket = rows.find(row => row.id === editingCell.rowId);
    if (!ticket) {
      clearEditingState();
      return;
    }

    const resolvedStatus = editingCell.columnId === 'status'
      ? resolveStatusCommit(ticket.status, draftValue)
      : undefined;
    const updates = buildTicketUpdateFromCommit({
      row: ticket,
      columnId: editingCell.columnId,
      draftValue,
      resolvedStatus: resolvedStatus === null ? undefined : resolvedStatus
    });

    if (updates) updateExecutionRow(ticket.id, updates);

    clearEditingState();
  }, [clearEditingState, draftValue, editingCell, rows, updateExecutionRow]);

  return {
    editingCell,
    draftValue,
    setDraftValue,
    startEditing,
    cancelEditing,
    commitDraft
  };
};
