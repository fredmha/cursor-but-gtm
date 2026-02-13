# Execution Refactor File Map

## Architecture Map

```text
ExecutionBoard.tsx
  -> useExecutionController.ts
    -> execution-columns.tsx
    -> useExecutionCellEditor.ts
      -> execution-core.ts
      -> executionStatus.ts
    -> ExecutionComponentsModal.tsx
```

## File Ownership

| File | Purpose | Exact Exports | Must Never Contain | Dependency Direction |
|---|---|---|---|---|
| `components/ExecutionBoard.tsx` | Thin composition root for execution workspace. | `ExecutionBoard` | Cell mutation branching, store orchestration details. | Imports controller + modal only. |
| `components/execution/useExecutionController.ts` | Runtime behavior owner for execution tab. | `useExecutionController` | Full page layout JSX. | Imports store + column factory + editor hook + core helpers. |
| `components/execution/execution-columns.tsx` | Table column rendering factory. | `buildExecutionColumns` | Store calls and campaign resolution logic. | Imports UI-safe helpers and callback contracts. |
| `components/execution/useExecutionCellEditor.ts` | Inline edit session state machine. | `useExecutionCellEditor` | JSX rendering and store entity lookup. | Imports `execution-core` + `executionStatus`. |
| `components/execution/execution-core.ts` | Pure row and commit-payload helpers. | `isTextRow`, `isTaskRow`, `getTaskLabel`, `normalizeDraftForColumn`, `buildTicketUpdateFromCommit` | React/store side effects. | Imported by controller, columns, editor hook. |
| `components/execution/executionStatus.ts` | Status policy for execution table. | `EXECUTION_STATUS_OPTIONS`, `isExecutionStatus`, `isLegacyExecutionStatus`, `getStatusSelectOptions`, `resolveStatusCommit` | UI rendering and store writes. | Imported by columns + editor hook. |
| `components/execution/ExecutionComponentsModal.tsx` | Presentational canvas-link modal. | `ExecutionComponentsModal` | Store access and persistence logic. | Receives props from controller. |
| `components/execution/executionTable.types.ts` | Shared execution contracts and interfaces. | multiple named interfaces/types | React imports and runtime logic. | Shared by execution modules. |

## Function Inventory By File

### `components/ExecutionBoard.tsx`
- `ExecutionBoard()`
- Purpose: compose table shell + add-row menu + components modal.
- Inputs: none.
- Output: execution workspace JSX.
- Invariant: no business mutation branching.

### `components/execution/useExecutionController.ts`
- `useExecutionController()`
- Purpose: own execution runtime state/commands and wire store + UI modules.
- Inputs: none.
- Output: controller object for `ExecutionBoard`.
- Invariant: command boundaries remain stable and explicit.

### `components/execution/execution-columns.tsx`
- `buildExecutionColumns()`
- Purpose: produce `ColumnDef<Ticket>[]` with all edit handlers wired.
- Inputs: typed editor state/actions + row actions + users.
- Output: table column definitions.
- Invariant: no direct store writes.

### `components/execution/useExecutionCellEditor.ts`
- `useExecutionCellEditor()`
- Purpose: manage edit session lifecycle and commit/cancel transitions.
- Inputs: row list + row update callback.
- Output: editing state + handlers.
- Invariant: always clears draft on commit/cancel.

### `components/execution/execution-core.ts`
- `isTextRow()`, `isTaskRow()`, `getTaskLabel()`
- Purpose: row semantics helpers.
- `normalizeDraftForColumn()`
- Purpose: column-aware draft normalization.
- `buildTicketUpdateFromCommit()`
- Purpose: deterministic payload generation for one cell commit.

### `components/execution/executionStatus.ts`
- `getStatusSelectOptions()`
- Purpose: legacy-safe option rendering.
- `resolveStatusCommit()`
- Purpose: allow explicit 3-state transitions, reject unsafe/no-op paths.

### `components/execution/ExecutionComponentsModal.tsx`
- `ExecutionComponentsModal()`
- Purpose: render and stage local checkbox selection draft.
- Invariant: persistence only through `onSave`.

## Edit Guide

- Add a column:
- Edit `executionTable.types.ts` column union.
- Edit `execution-core.ts` payload builder.
- Edit `execution-columns.tsx` render branch.

- Change edit-state behavior:
- Edit only `useExecutionCellEditor.ts`.
- Keep `idle -> editing -> commit/cancel -> idle` transitions.

- Change status policy:
- Edit only `executionStatus.ts`.
- Re-run execution regression checklist in `docs/execution-table-editing.md`.

- Change canvas link modal behavior:
- Edit visual behavior in `ExecutionComponentsModal.tsx`.
- Edit persistence flow in `useExecutionController.ts`.

## Culling Checklist

- Is this behavior execution-tab-specific?
- If yes, keep under `components/execution/*`.
- Is this logic pure and reusable across execution modules?
- If yes, place in `execution-core.ts` or `executionStatus.ts`.
- Does a new file remove one complete concern from a larger file?
- If no, avoid extra indirection.
- Does the change preserve execution-table behavior semantics?
- If no, update docs + regression checklist in same change.
