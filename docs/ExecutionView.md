# ExecutionView Implementation Guide

## Purpose
`components/ExecutionBoard.tsx` is the execution orchestration layer for editing and managing task/text rows across channels, projects, and standalone execution work.

It owns layout composition and delegates runtime behavior to `components/execution/*` modules.

## Data Flow
```text
store.getExecutionRows()
  -> useExecutionController()
  -> buildExecutionColumns()
  -> user edits / row actions
  -> useExecutionCellEditor()
  -> execution-core + executionStatus
  -> store.updateExecutionRow(...)
```

## Module Map
- `components/ExecutionBoard.tsx`
- Responsibilities: page shell, table mount, add-row menu mount, components modal mount.
- `components/execution/useExecutionController.ts`
- Responsibilities: runtime state ownership, store wiring, add-row flow, columns factory wiring, modal commands.
- `components/execution/execution-columns.tsx`
- Responsibilities: render-only table column definitions and interaction event wiring.
- `components/execution/useExecutionCellEditor.ts`
- Responsibilities: edit session state machine (`idle -> editing -> commit/cancel -> idle`).
- `components/execution/execution-core.ts`
- Responsibilities: pure row/draft/commit payload helpers.
- `components/execution/executionStatus.ts`
- Responsibilities: execution status policy and legacy-safe status commit resolution.
- `components/execution/ExecutionComponentsModal.tsx`
- Responsibilities: presentational canvas-link modal and local checkbox draft state.
- `components/execution/executionTable.types.ts`
- Responsibilities: execution-local interfaces and contracts shared across modules.

## Public Contracts To Preserve
- Keep `export const ExecutionBoard: React.FC` unchanged.
- Preserve store APIs used by execution tab:
- `getExecutionRows`
- `addExecutionRow`
- `updateExecutionRow`
- `deleteExecutionRow`
- Preserve execution UX:
- inline edit commit on blur/Enter
- Escape cancels edits
- TEXT rows only editable in task column

## Invariants (Do Not Break)
- No hidden status coercion on non-status edits.
- Legacy statuses must remain visible when status cell opens.
- Cross-row edit draft must be cleared on commit/cancel.
- Components-link save must only persist valid canvas element ids.
- New row auto-focus must happen after row materializes in state.

## Extension Recipes
### Add a New Editable Column
1. Extend `ExecutionEditableColumn` in `components/execution/executionTable.types.ts`.
2. Extend `buildTicketUpdateFromCommit()` in `components/execution/execution-core.ts`.
3. Add UI branch in `buildExecutionColumns()` in `components/execution/execution-columns.tsx`.
4. Verify keyboard handling and cancel semantics.

### Extend Status Model
1. Update `EXECUTION_STATUS_OPTIONS` in `components/execution/executionStatus.ts`.
2. Review `resolveStatusCommit()` rules for legacy/no-op behavior.
3. Validate store sanitization rules in `store.tsx` execution methods.

### Add New Row Action
1. Add action contract in `components/execution/executionTable.types.ts`.
2. Implement command in `useExecutionController.ts`.
3. Wire UI trigger in `execution-columns.tsx`.

## Debug Checklist
- Draft leaks between rows:
- inspect `clearEditingState` transitions in `useExecutionCellEditor.ts`.
- Status unexpectedly changes:
- inspect `resolveStatusCommit()` and `updateExecutionRow()` conditional sanitization.
- Components link save missing:
- inspect `saveComponentsLinks` in `useExecutionController.ts` and canvas relation sync in `store.tsx`.
- New row not auto-focused:
- inspect `pendingRowFocus` lifecycle in `useExecutionController.ts`.

## Related Docs
- `docs/execution-refactor-file-map.md`
- `docs/execution-table-editing.md`
