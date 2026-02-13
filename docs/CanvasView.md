# CanvasView Implementation Guide

## Purpose
`components/CanvasView.tsx` is the canvas orchestration layer for building and editing campaign visual elements (`EMAIL_CARD`, `CONTAINER`) and their relations (`PARENT`, `EDGE`, `TICKET_LINK`).

It owns runtime UI state and delegates pure logic to `components/canvas/*` helpers.

## Data Flow
```text
store.campaign.canvasScene
  -> mapSceneToState()
  -> ReactFlow nodes/edges + local UI state
  -> user edits (drag/resize/link/block updates)
  -> buildScene()
  -> updateCanvasScene(scene)
  -> store normalizes relations + ticket links
```

## Module Map
- `components/CanvasView.tsx`
- Responsibilities: state ownership, event handlers, commits, keyboard shortcuts, panel rendering.
- `components/canvas/CanvasElementNode.tsx`
- Responsibilities: node UI rendering, block row interactions, drag/drop gutters, inline editing visuals.
- `components/canvas/canvas-scene-mappers.ts`
- Responsibilities: scene <-> ReactFlow mapping, default scene/element creation, absolute position lookup.
- `components/canvas/canvas-email-blocks.ts`
- Responsibilities: template guards, block defaults/normalization, reorder operations, label derivation.
- `components/canvas/canvas-math.ts`
- Responsibilities: finite parsing + clamp primitives.
- `components/canvas/canvas-constants.ts`
- Responsibilities: shared bounds and defaults.
- `components/canvas/canvas-history.ts`
- Responsibilities: history push/reset dedupe and timer cleanup helpers.
- `components/canvas/canvas-types.ts`
- Responsibilities: internal CanvasView-local runtime types.

## Public Contracts To Preserve
- Keep `export const CanvasView: React.FC` unchanged.
- Preserve `CanvasScene` v2 shape when persisting.
- Keep relation semantics:
- `PARENT`: from child element -> to container element.
- `EDGE`: from source element -> target element.
- `TICKET_LINK`: from element -> to ticket id.

## Invariants (Do Not Break)
- History dedupe: identical scenes must not create extra undo frames.
- Viewport throttling: viewport commits are delayed by `VIEWPORT_COMMIT_MS`.
- Parent detach behavior: when removing parent, child must keep absolute screen position.
- Ticket-link dedupe: one element->ticket pair only.
- Email block metric bounds: always normalize/clamp before rendering/editing.
- Selection mode split:
- Non-email selected node: generic element panel controls.
- Email selected node: card mode vs block mode.

## Extension Recipes
### Add a New Email Block Type
1. Update `EmailBlockType` in `types.ts`.
2. Add type into `EMAIL_BLOCK_TYPES` in `canvas-constants.ts`.
3. Add default metrics in `getDefaultBlockMetrics()`.
4. Update UI branches in `CanvasElementNode.tsx` if rendering differs from text/image behavior.
5. Validate panel edit controls in `CanvasView.tsx`.

### Add a New Canvas Tool
1. Extend `CanvasTool` in `types.ts`.
2. Add toolbar button in `CanvasView.tsx`.
3. Handle behavior in `onPaneClick` (or a dedicated handler if non-placement tool).
4. Ensure commit path still ends through `scheduleCommit`/`buildScene`.

### Add a New Relation Type Safely
1. Extend `CanvasRelationType` in `types.ts`.
2. Update mapping in `mapSceneToState()` only if ReactFlow needs it.
3. Update `buildScene()` relation reconstruction/validation.
4. Confirm `store.updateCanvasScene` filtering rules still preserve intended records.

## Debug Checklist
- Node not rendering:
- Verify node `type: 'canvasElement'` and `nodeTypes.canvasElement` mapping.
- Parenting looks wrong:
- Inspect `getAbsolutePosition()` and relation rebuild in `buildScene()`.
- Undo/redo inconsistent:
- Check commit timers and history dedupe path in `canvas-history.ts`.
- Ticket link chips missing:
- Validate `ticketLinks` state and `buildScene()` dedupe/filter behavior.
- Block drag/drop odd ordering:
- Verify midpoint logic in `CanvasElementNode.tsx` and `moveBlock*` helpers.

## Refactor Rules For Future Agents
- Keep pure transforms in `components/canvas/*`; keep orchestration in `CanvasView.tsx`.
- Avoid introducing business logic into JSX branches when helper extraction is possible.
- Prefer named constants over inline numbers.
- Add comments only for non-obvious behavior (ordering semantics, relation rebuilding, timing).
- Run TypeScript checks after any canvas refactor.
