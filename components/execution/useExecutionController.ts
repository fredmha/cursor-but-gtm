import { useEffect, useMemo, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { useStore } from '../../store';
import { ExecutionRowType, Ticket, TicketStatus } from '../../types';
import { buildExecutionColumns } from './execution-columns';
import { getTaskLabel } from './execution-core';
import { useExecutionCellEditor } from './useExecutionCellEditor';
import { ExecutionElementOption } from './executionTable.types';

/**
 * Purpose:
 * - Runtime controller for the Execution tab.
 *
 * Responsibilities:
 * - Wire store data/actions to local feature state.
 * - Own UI-only transient states (add menu, focus intent, modal selection target).
 * - Produce column definitions with all callbacks pre-bound.
 *
 * Must not contain:
 * - top-level page layout markup
 */
export const useExecutionController = () => {
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
  const [componentsEditorRowId, setComponentsEditorRowId] = useState<string | null>(null);
  const [pendingRowFocus, setPendingRowFocus] = useState(false);

  const editor = useExecutionCellEditor({
    rows,
    updateExecutionRow
  });
  const {
    editingCell,
    draftValue,
    setDraftValue,
    startEditing,
    cancelEditing,
    commitDraft
  } = editor;

  useEffect(() => {
    if (!pendingRowFocus || rows.length === 0) return;

    // Focus the newest row only after data insertion commits to state.
    const newest = rows[rows.length - 1];
    startEditing(newest.id, 'task', getTaskLabel(newest));
    setPendingRowFocus(false);
  }, [pendingRowFocus, rows, startEditing]);

  const canvasElementOptions = useMemo<ExecutionElementOption[]>(() => {
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

  const handleAddRow = (rowType: ExecutionRowType) => {
    if (rowType === 'TEXT') {
      addExecutionRow({ rowType: 'TEXT', executionText: 'New text row', title: 'Note' });
    } else {
      addExecutionRow({ rowType: 'TASK', title: 'New Task', status: TicketStatus.Todo });
    }
    setShowAddMenu(false);
    setPendingRowFocus(true);
  };

  const openComponentsEditor = (rowId: string) => {
    setComponentsEditorRowId(rowId);
  };

  const closeComponentsEditor = () => {
    setComponentsEditorRowId(null);
  };

  const saveComponentsLinks = (rowId: string, ids: string[]) => {
    updateExecutionRow(rowId, { canvasItemIds: ids });
    closeComponentsEditor();
  };

  const columns = useMemo<ColumnDef<Ticket>[]>(() => {
    return buildExecutionColumns({
      users,
      editorState: {
        editingCell,
        draftValue
      },
      editorActions: {
        setDraftValue,
        startEditing,
        cancelEditing,
        commitDraft
      },
      rowActions: {
        deleteRow: deleteExecutionRow,
        openComponentsEditor
      }
    });
  }, [
    deleteExecutionRow,
    cancelEditing,
    commitDraft,
    draftValue,
    editingCell,
    setDraftValue,
    startEditing,
    users
  ]);

  return {
    rows,
    columns,
    showAddMenu,
    setShowAddMenu,
    handleAddRow,
    canvasElementOptions,
    componentsEditorTicket,
    closeComponentsEditor,
    saveComponentsLinks
  };
};
