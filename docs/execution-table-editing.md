# Execution Table Editing QA Guide

See also: `docs/ExecutionView.md` and `docs/execution-refactor-file-map.md`.

## Preconditions
- Open the app with at least one campaign loaded.
- Navigate to the `Execution` view.
- Ensure there are both task rows and text rows in the table.
- Ensure at least one task row has a legacy status (`Backlog` or `Canceled`), which can be created via non-execution views.

## Regression Checklist
1. Edit a task row description, click outside, and confirm value persists.
2. Edit description on row A, then click status on row B, and confirm row B starts with its own value.
3. Change status from `Todo` to `In Progress` and confirm it persists after rerender.
4. Open status editor on a `Backlog` or `Canceled` row and verify no automatic change to `Todo`.
5. On a legacy status row, open and blur status without changing selection; verify no status update happens.
6. On a legacy status row, explicitly choose `Todo`; verify it updates and remains stable.
7. While editing task, description, and status cells, press `Escape`; confirm edits are canceled.
8. Run `npm run build` and verify it succeeds.

## Expected Examples

### Description commit
- Before: `description = ""`
- Action: type `Need final copy approval`, blur textarea
- After: `description = "Need final copy approval"`

### Legacy status display
- Before: `status = "Backlog"`
- Action: open status cell editor
- After: select shows `Backlog` + execution options, no write on blur unless changed

### Explicit legacy conversion
- Before: `status = "Canceled"`
- Action: select `Todo`
- After: `status = "Todo"`

### Escape cancel behavior
- Before: `description = "Current note"`
- Action: type `Unsaved change`, press `Escape`
- After: `description = "Current note"`
