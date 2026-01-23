
# GTM OS Codebase Rules

This document serves as the architectural constitution for the GTM Operating System. 
**Violation of these rules will result in regression of the system's core value proposition.**

---

## 1. Architectural Integrity

### The Hierarchy of Work
Work **cannot** exist in a vacuum. The database enforces a strict parent-child relationship:
1.  **Root**: `Campaign` (The overarching container).
2.  **Context**: 
    *   `Channel` (Infinite/Ongoing, e.g., "SEO")
    *   **OR**
    *   `Project` (Finite/Time-bound, e.g., "Q4 Rebrand")
3.  **Atomic Unit**: `Ticket` (The actual task).

*Rule*: A `Ticket` MUST have either a `channelId` OR a `projectId`. It cannot have both, and it cannot have neither (unless momentarily in a simplified backlog, but UI should prevent this).

### The "No Bet" Rule
*   **Deprecated**: The concept of "Bets" (Hypotheses) has been flattened.
*   **Current State**: Strategies are defined via `Principles` and `Docs`. Execution is defined via `Tickets`. Do not re-introduce "Bets" as an intermediate layer.

---

## 2. Visual Design System ("Harvey" Aesthetic)

The UI follows a strict **"Muted Canvas"** philosophy. 

### Color Tokens (Tailwind)
*   **Background**: `bg-white` (Main content).
*   **Sidebar/Structure**: `bg-zinc-50` (Navigation, Panels).
*   **Borders**: `border-zinc-100` (Primary divider). **Never** use `border-zinc-300` or darker for structural borders.
*   **Shadows**: Use `shadow-sm` or `shadow-lg` (diffused) instead of heavy borders to create depth.

### Component Styling
*   **Lists**: Rows should look like interactive list items (`rounded-lg`, `hover:bg-zinc-50`), not rigid grid cells.
*   **Modals**: `bg-white`, `shadow-2xl`, `backdrop-blur-xl`.
*   **Typography**: Use `text-zinc-500` for labels and `text-zinc-900` for data. Avoid pure black (`#000`).

---

## 3. Component Rules

### `RoadmapSandbox.tsx` (Gold Master)
*   **Status**: This is the most complex component. It handles the virtualized grid, drag-and-drop logic, and SVG rendering.
*   **Rule**: Changes to the Grid Layout engine (`calculateLaneLayout`) must be tested against "Vertical Stacking" scenarios (e.g., 5 overlapping tickets in one week).

### `ExecutionBoard.tsx`
*   **View Modes**: Must always support both `scope='MINE'` and `scope='TEAM'`.
*   **Grouping**: When in "Project" mode, tickets must be grouped by "Channel" to show cross-functional dependencies.

### `DocsView.tsx`
*   **Editor**: Use the custom `RichTextEditor` component. Do not import `ReactQuill` or `Draft.js`.
*   **Linkage**: Document creation flows should always check for `pendingTicketLink` in the store to automatically associate new docs with the originating ticket.

---

## 4. State Management (`store.tsx`)

### No API Calls in Components
*   All data mutation logic resides in `store.tsx`.
*   Components only call `addTicket`, `updateProject`, etc.
*   **Exception**: AI Service calls (`geminiService.ts`) are invoked by components (usually `LabOnboarding` or `ReviewMode`), but the *result* is committed via the Store.

### ID Generation
*   Always use the exported `generateId()` helper from `store.tsx`. Do not use `Math.random()` directly in components.

### Persistence
*   The Store automatically syncs `campaign` and `users` to `localStorage`.
*   **Migration Rule**: If changing the schema (e.g., adding `docFolders`), you must add a migration check in the `useState` initializer within `StoreProvider`.

---

## 5. AI Integration Guidelines

### Model Selection
*   **Strategic Planning**: Use `gemini-3-flash-preview` for speed and context window.
*   **Creative Generation**: Use `gemini-3-flash-preview` or specialized models if available.

### Tool Use
*   The `ReviewMode` agent uses **Function Calling** (`propose_ticket`, `propose_reschedule`).
*   **Rule**: The Agent **NEVER** modifies the store directly. It emits a tool call, which the UI renders as a "Pending Action" card (`AgentTicketCard`). The User must explicitly "Approve" the action to commit it to the Store.

---

## 6. Directory Structure

*   `components/`: Presentational and Container components.
*   `services/`: Pure functions for API calls (Gemini).
*   `hooks/`: Reusable logic (e.g., `useOnboarding`).
*   `store.tsx`: The Brain.
*   `types.ts`: The DNA.

---

*Adhere to these rules to maintain a maintainable, high-performance, and aesthetically pleasing operating system.*