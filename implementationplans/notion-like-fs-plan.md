# Notion-Like File System Plan (Simple to Implement, Deep in Use)

## Goal
Deliver a Notion-like organization system that feels powerful but is trivial to hook up to a backend: minimal interaction surface area, minimal data model complexity, and predictable behavior.

## Design Constraints
- Keep the data model boring and stable.
- Keep drag-and-drop rules few and obvious.
- Prefer “one good way” over many modes.
- Preserve feature depth via composition, not complexity.

## Minimal Feature Set (High Value, Low Complexity)
These features deliver most of the value without complex infrastructure:
- Sidebar tree with nesting, reorder, and move.
- Pages that can contain other pages and files.
- Drag-and-drop in the sidebar only (initially).
- `@` mentions that reference any node by stable ID.
- Favorites, Recent, Search, and Breadcrumbs.
- Undo for move/reorder.

Defer for later (not needed to be useful):
- Complex databases and custom fields.
- Multiple drag/drop modes across many surfaces.
- Cross-workspace permissions or sharing models.

## Simple, Durable Data Model
Use a single `nodes` table/collection.

### Node shape
- id: string (UUID)
- title: string
- type: `page | folder | file`
- parentId: string | null
- order: number (integer sort key)
- isArchived: boolean
- createdAt: timestamp
- updatedAt: timestamp

Optional but useful:
- icon: string | null
- slug: string | null (short id for mentions/URLs)

This keeps the backend trivial: a plain adjacency list with ordering.

## Ordering Strategy (Keep It Simple)
Avoid fractional indexing at first.

### Approach
- Use integer `order` values.
- When inserting between two items, choose the midpoint if there’s room.
- If there’s no room, reindex that sibling list.

### Practical convention
- Initialize order in large gaps (e.g., 1000, 2000, 3000).
- Reindex only the affected sibling list when needed.

This is easy to implement and maintain.

## Backend API (Trivial to Hook Up)
Keep the API small and task-based.

### Endpoints / actions
- `createNode({ title, type, parentId, order? })`
- `renameNode({ id, title })`
- `moveNode({ id, parentId, order })`
- `archiveNode({ id, isArchived })`
- `listChildren({ parentId })`
- `getNode({ id })`
- `searchNodes({ query, limit })`
- `listRecent({ limit })` (can be derived later)
- `listFavorites()` / `setFavorite({ id, value })` (can be a tiny table)

That’s enough to power the whole UX.

## Drag-and-Drop Plan (Minimal Interaction Surface)
To keep implementation simple and reliable:
- Support drag-and-drop in the sidebar tree only (Phase 1).
- Defer drag-and-drop on the canvas/editor until the tree is solid.

### Allowed operations
- Reorder among siblings.
- Move into a page/folder.
- Move to root.

### Hard rules
- No dropping into self or descendants.
- Files cannot have children.
- Pages and folders can have children.

### UX behaviors
- Clear insertion line for reorder.
- Clear highlight for “drop into”.
- On drop: optimistic update + toast with Undo.

## `@` Mentions (Simple but Robust)
Mentions should be simple on the backend and resilient on the frontend.

### Storage rule
Always store mention references by `id`, never by title.

### Mention token shape (conceptual)
- display: `@Title`
- stored: `{ id: "node-id" }`

### Lookup
- `@` opens a picker.
- Picker uses `searchNodes(query)` + recent/favorites.
- Render uses live title resolution from `getNode(id)` or cached data.

This stays valid after rename/move.

## Steady UI Flow (Calm and Predictable)
Prioritize clarity over modes.

### Layout
- Left: Sidebar tree + Search + Favorites + Recent.
- Top: Breadcrumbs.
- Center: Page canvas.
- Right panel: omit initially unless already present.

### Navigation rules
- Sidebar selection drives canvas.
- Breadcrumbs always visible.
- “Create” is available in both sidebar and canvas.

## Folder and File System Organization (Implementation)
Organize by feature, but keep it shallow.

### Top-level
- `implementationplans/`
- `src/`
- `src/domain/`
- `src/features/`
- `src/components/`
- `src/state/`
- `src/lib/`
- `src/types/`
- `src/tests/`

### Feature folders (minimal and focused)
- `src/features/nodes/`
- `src/features/nodes/tree/`
- `src/features/nodes/dnd/`
- `src/features/nodes/mentions/`
- `src/features/nodes/navigation/`

### Responsibility split
- `src/domain/nodes/`: core types + move/reorder rules.
- `src/features/nodes/tree/`: sidebar tree UI.
- `src/features/nodes/dnd/`: drop rules + resolution.
- `src/features/nodes/mentions/`: `@` picker + tokens.
- `src/state/`: fetching, caching, optimistic updates.

## Implementation Phases (Bias Toward Shipping)

### Phase 1: Foundation + Tree
- Implement `nodes` model and basic APIs.
- Render sidebar tree from `parentId` + `order`.
- Add create, rename, archive.
- Add breadcrumbs + recent/favorites (basic).

### Phase 2: Sidebar Drag-and-Drop
- Implement reorder and move in the tree only.
- Add move validation rules in domain layer.
- Add optimistic updates + Undo.
- Ensure no “lost node” states.

### Phase 3: `@` Mentions in Chat + Editor
- Implement mention picker using search + recent.
- Store mention tokens by node id.
- Render mentions with live title resolution.
- Support mentions in chat interface.

### Phase 4: Depth Without Complexity
- Add link/embed behavior on the canvas (non-DnD).
- Add backlinks (derived from mention/link records if available).
- Improve search ranking using recency + favorites.

## Acceptance Criteria

### Simplicity
- Backend can be implemented with a single `nodes` table.
- Move/reorder uses one endpoint: `moveNode`.

### Usability
- Users can organize everything from the sidebar.
- Drag-and-drop always shows clear targets.
- Undo always restores prior position.

### Mentions
- `@` references any node quickly.
- Mentions survive rename and move.

## Why This Stays Deep
Feature depth comes from composition:
- Nesting + linking + mentions + search creates most of the Notion feel.
- You can add databases later as a specialized node type without reworking the core model.

## Next Step After Approval
- I will align the codebase structure to this plan.
- Then I’ll scaffold the minimal nodes domain, tree UI, DnD rules, and mention picker in that order.
