# GTM OS: Data Symmetry & Sync Specification

## 1. The Core Problem
Currently, **Roadmap Items** (Visual Timeline) and **Execution Tickets** (Kanban/List) exist as separate data silos.
- Creating a "Task" on the Roadmap does not create a Ticket in the Execution Board.
- Completing a Ticket in Execution does not update the Roadmap visual status.

## 2. The Solution: "Quantum Entanglement" (Sync)
We will enforce a 1:1 relationship between `RoadmapItem` (Type: CONTENT) and `Ticket`.

### A. Data Structure Updates (`types.ts`)
1.  **`RoadmapItem`**: Add `ticketId?: string`.
2.  **`Ticket`**: Add `roadmapItemId?: string`.

### B. Store Logic (`store.tsx`)
1.  **Creation Sync (Roadmap -> Execution)**
    *   When a User creates a Roadmap Item and selects a **Linked Bet**:
        *   System automatically calls `addTicket` with the Item's title, owner, and timeline (due date = end of week).
        *   The new Ticket ID is saved to the Roadmap Item.
    *   *Result*: The item immediately appears in the Execution Board.

2.  **Status Sync (Execution <-> Roadmap)**
    *   **Execution Board**: When a Ticket moves to `Done`:
        *   Find the linked `RoadmapItem`.
        *   Update its `status` to `Completed`.
        *   Visual: The Roadmap card turns Green.
    *   **Roadmap Sandbox**: When a Roadmap Item color/status is changed manually:
        *   Update the linked Ticket's status.

3.  **Orphan Handling**
    *   Tickets created directly in Execution (via "New Ticket" button) start without a Roadmap Item (Backlog).
    *   *Future Feature*: "Plan Backlog" drawer in Roadmap to drag these onto the timeline.

## 3. Hierarchy Enforcement (Execution View)
To satisfy the strict hierarchy requirement (**Channel > Bet > Ticket**), the Execution Board will be restructured:

### A. Sidebar Navigation (Tree View)
```text
▼ [Channel Icon] Marketing (Channel)
    ▼ SEO Optimization (Bet)
    ▼ Content Engine (Bet)
▼ [Channel Icon] Sales (Channel)
    ▼ Outbound Q4 (Bet)
```

### B. Main Workbench Header (Breadcrumbs)
Always display the full context path:
`Marketing` / `SEO Optimization` / `**Tickets**`

### C. Visual Grouping
If viewing "All My Tickets", rows will be grouped visually:
*   **Header**: Channel Name
*   **Sub-Header**: Bet Name
*   **Rows**: Tickets

## 4. Implementation Checklist
1.  **Modify `types.ts`**: Add linking fields.
2.  **Update `store.tsx`**:
    *   Modify `addRoadmapItem` to handle ticket generation.
    *   Modify `updateTicket` to sync back to Roadmap.
3.  **Update `RoadmapSandbox.tsx`**: Ensure `TicketModal` creates the link.
4.  **Refactor `ExecutionBoard.tsx`**: Implement the strict Tree View sidebar and Breadcrumb header.
