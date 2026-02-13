import { Ticket, User } from '../../types';

/**
 * Purpose:
 * - Shared execution-table contracts used by controller, editor hook, and column factory.
 *
 * Must not contain:
 * - React imports/hooks
 * - store wiring
 * - rendering concerns
 */
export type ExecutionEditableColumn = 'task' | 'description' | 'deadline' | 'assigned' | 'status';

export interface EditingCell {
  rowId: string;
  columnId: ExecutionEditableColumn;
}

export interface CommitContext {
  row: Ticket;
  columnId: ExecutionEditableColumn;
  draftValue: string;
  resolvedStatus?: Ticket['status'];
}

export interface ExecutionElementOption {
  id: string;
  label: string;
  kind: string;
}

export interface ExecutionCellEditorState {
  editingCell: EditingCell | null;
  draftValue: string;
}

export interface ExecutionCellEditorActions {
  setDraftValue: (value: string) => void;
  startEditing: (rowId: string, columnId: ExecutionEditableColumn, value: string) => void;
  cancelEditing: () => void;
  commitDraft: () => void;
}

export interface ExecutionRowActions {
  deleteRow: (rowId: string) => void;
  openComponentsEditor: (rowId: string) => void;
}

export interface ExecutionColumnFactoryParams {
  users: User[];
  editorState: ExecutionCellEditorState;
  editorActions: ExecutionCellEditorActions;
  rowActions: ExecutionRowActions;
}
