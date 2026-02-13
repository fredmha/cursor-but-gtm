# Canvas Refactor File Map

## Architecture Map

```text
CanvasView.tsx
  -> useCanvasController.ts
    -> CanvasElementNode.tsx
    -> CanvasInspectorPanel.tsx
    -> CanvasToolbar.tsx
    -> CanvasTicketLinkModal.tsx
    -> canvas-core.ts
```

## File Ownership

| File | Purpose | Exact Exports | Must Never Contain | Dependency Direction |
|---|---|---|---|---|
| `components/CanvasView.tsx` | Thin composition root for canvas workspace UI. | `CanvasView` | Scene mutation logic, large business handlers, store mutation details. | Imports controller + presentational components only. |
| `components/canvas/useCanvasController.ts` | Single source of runtime behavior/state/commands for canvas feature. | `useCanvasController`, `CanvasController`, `ContainerOption` | JSX-heavy inspector/modal/toolbar markup. | Imports `canvas-core` + store + node renderer. |
| `components/canvas/CanvasElementNode.tsx` | ReactFlow node renderer with email-block interactions. | `CanvasElementNode`, `CanvasElementNodeProps` | Store calls, campaign-level orchestration. | Imports only core helpers and icons. |
| `components/canvas/CanvasInspectorPanel.tsx` | Right-side selection editor UI. | `CanvasInspectorPanel` | Store access, scene commit internals. | Receives everything via props from controller. |
| `components/canvas/CanvasToolbar.tsx` | Bottom tool/undo/zoom/delete control bar. | `CanvasToolbar` | Mutation logic beyond callback invocation. | Receives callbacks/state via props only. |
| `components/canvas/CanvasTicketLinkModal.tsx` | Ticket-link chooser modal UI. | `CanvasTicketLinkModal` | Campaign querying, relation persistence logic. | Receives ticket list + handlers via props. |
| `components/canvas/canvas-core.ts` | Essential shared core: constants, types, math, scene mapping, block helpers, history/timer utilities. | multiple named helper exports | React component render markup or store access. | Imported by controller and UI components. |

## Function Inventory By File

### `components/CanvasView.tsx`
- `CanvasWorkspace()`
- Purpose: Compose ReactFlow canvas + panel + toolbar + modal.
- Inputs: none.
- Output: workspace JSX.
- Invariant: does not own heavy behavior logic.
- `CanvasView()`
- Purpose: Provide ReactFlow context wrapper.
- Inputs: none.
- Output: provider-wrapped workspace.
- Invariant: public API remains stable.

### `components/canvas/useCanvasController.ts`
- `useCanvasController()`
- Purpose: Own all state, derived data, handlers, and commit flow.
- Inputs: none.
- Output: controller object consumed by orchestrator and child components.
- Invariant: behavior parity with prior monolithic implementation.
- internal command groups (inside hook):
- Scene commits/history: `commitScene`, `scheduleCommit`, `scheduleViewportCommit`, `applyScene`, `flushPendingCommits`.
- Element lifecycle: `createElementFromTool`, `updateSelectedElement`, `removeSelection`, `duplicateSelection`, `assignSelectedParent`.
- Email blocks: `updateSelectedEmailTemplate`, `addEmailBlock`, `updateEmailBlock`, `deleteEmailBlock`, `handleEmailBlockUpload`, drag/drop + resize handlers.
- Linking: `openLinkPanel`, `saveTicketLinks`.
- History controls: `undo`, `redo`.
- ReactFlow handlers: `onNodesChange`, `onEdgesChange`, `onConnect`, `onPaneClick`, `onMoveEnd`.
- View helpers: `zoomIn`, `zoomOut`, `resetViewport`.

### `components/canvas/CanvasElementNode.tsx`
- `CanvasElementNode()`
- Purpose: Render one node frame including block editor interactions.
- Inputs: Node props + callbacks.
- Output: node JSX.
- Invariant: drag/drop and resize semantics remain unchanged.

### `components/canvas/CanvasInspectorPanel.tsx`
- `CanvasInspectorPanel()`
- Purpose: Render/edit current selection (card or block mode).
- Inputs: selected element data, options, callbacks.
- Output: inspector JSX.
- Invariant: no direct state/store mutation.

### `components/canvas/CanvasToolbar.tsx`
- `CanvasToolbar()`
- Purpose: Render tool switching + history + zoom controls.
- Inputs: toolbar state + action callbacks.
- Output: toolbar JSX.
- Invariant: no behavior beyond invoking provided callbacks.

### `components/canvas/CanvasTicketLinkModal.tsx`
- `CanvasTicketLinkModal()`
- Purpose: Render and control ticket selection modal.
- Inputs: open state, search text, ticket list, draft IDs, callbacks.
- Output: modal JSX or null.
- Invariant: state changes go through callbacks only.

### `components/canvas/canvas-core.ts`
- Numeric helpers: `toFiniteNumber`, `clampNumber`.
- Email block helpers: `getDefaultBlockMetrics`, `normalizeBlockMetrics`, `ensureEmailTemplate`, `createEmailBlock`, `deriveEmailCardLabel`, `moveBlock`, `moveBlockToIndex`.
- Scene helpers: `createDefaultCanvasScene`, `makeDefaultElement`, `mapSceneToState`, `buildScene`, `getAbsolutePosition`.
- History/timer helpers: `pushSceneHistory`, `resetSceneHistory`, `clearScheduledTimer`.
- Constants/types: Canvas-local runtime types and bounds.

## Edit Guide

- Add a toolbar action:
- Edit `components/canvas/CanvasToolbar.tsx` for UI button.
- Edit `components/canvas/useCanvasController.ts` to add callback behavior.

- Add a new email block type:
- Edit `types.ts` (`EmailBlockType`).
- Edit `components/canvas/canvas-core.ts` block constants/defaults/normalization.
- Edit `components/canvas/CanvasElementNode.tsx` render branch if new visuals are required.
- Edit `components/canvas/CanvasInspectorPanel.tsx` controls if new settings are needed.

- Change relation behavior:
- Edit relation mapping/rebuild in `components/canvas/canvas-core.ts` (`mapSceneToState`, `buildScene`).
- Validate integration path in `store.tsx` `updateCanvasScene`.

- Change keyboard shortcuts:
- Edit key handlers in `components/canvas/useCanvasController.ts` only.

## Culling Checklist

- Is this logic used by a currently shipped behavior?
- Can this remain inside `useCanvasController.ts` instead of creating a new file?
- Does a new file remove one full UI or logic concern from another file?
- Does this change preserve existing behavior semantics?
- Does this change improve editability without increasing indirection?
