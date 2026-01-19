# GTM OS: Project Matrix & Live Execution Architecture

## 1. The Core Problem
Currently, **Projects** function as static metadata containers. They lack execution capabilities (Kanban, ticket creation) and do not integrate visually with the Roadmap timeline. Furthermore, the relationship between a **Project** (Time-bound Initiative) and a **Channel/Bet** (Functional Strategy) is loose.

## 2. The Solution: "The Matrix" Structure
We will enforce a strict matrix relationship where execution happens at the intersection of a **Project** and a **Channel**.

*   **Vertical Axis**: Functions (Channels -> Bets).
*   **Horizontal Axis**: Time/Initiatives (Projects).
*   **Intersection**: **Tickets**.

A Ticket effectively becomes: `Ticket(What: Title, Where: Channel/Bet, Why: Project)`.

---

## 3. Project Dashboard: "Live Execution" Upgrade

The `ProjectDashboard` will be transformed from a static list view into a fully interactive **Command Center**.

### A. Integrated Kanban Board
Instead of a simple list of "Initiatives", we will embed a full **Kanban Board** inside the Project Dashboard.
*   **Scope**: Displays *all* tickets where `ticket.projectId === this.project.id`.
*   **Grouping**: Tickets are grouped by **Channel** lanes within the board to show cross-functional progress.
*   **Interactivity**: Drag-and-drop to update status, click to edit.

### B. Matrix Ticket Creation
When a user clicks "New Ticket" inside the Project Dashboard:
1.  **Project Context**: `projectId` is pre-filled and locked.
2.  **Routing Required**: The user **MUST** select a `Channel` and a `Bet` to house this ticket.
    *   *Why?* Work cannot exist in a vacuum. A "Rebrand" project task (e.g., "Update Homepage Hero") must live in the "Web/SEO" channel under a specific Bet.
3.  **UI Flow**:
    *   Dropdown: Select Channel.
    *   Dropdown: Select Active Bet (filtered by Channel).
    *   Input: Ticket Details.

---

## 4. Roadmap Visualization: "The Strategy Horizon"

To address the requirement of Projects being visible "without having a lane themselves," we will introduce a **"Strategy Horizon"** layer.

### Architectural Decision: The Timeline Overlay
Instead of treating Projects as "Lanes" (which hold cards), we treat them as **Temporal Context**.

1.  **Position**: A dedicated, collapsible fixed area located **between** the Date Header and the Channel Lanes.
2.  **Visualization**:
    *   Projects render as **Gantt-style Bars** spanning from `startDate` to `targetDate`.
    *   **Visual Encoding**:
        *   Color = Project Health (Green/Yellow/Red).
        *   Progress Bar = % of linked tickets complete.
        *   Avatar = Project Lead.
3.  **Interaction**:
    *   Clicking a Project Bar opens the `ProjectDashboard` modal.
    *   This provides an instant "Executive View" of active initiatives without cluttering the tactical drag-and-drop grid below.

### Visual Stack
```text
[ DATE HEADER (Weeks) ]
--------------------------------------------------
[ STRATEGY HORIZON (Projects Gantt) ]  <-- NEW
   [== Project A (Q4 Launch) ======]
         [== Project B (Rebrand) ==]
--------------------------------------------------
[ CHANNEL LANE: Marketing ]
   [ Bet Card ] [ Bet Card ]
[ CHANNEL LANE: Product ]
   [ Bet Card ]
```

---

## 5. Implementation Plan

### Phase 1: Refactor Ticket Logic (`TicketBoard` Component)
*   Extract the Kanban logic from `ExecutionBoard` into a reusable `TicketBoard` component.
*   Add props for `filterByProjectId` and `groupByChannel`.

### Phase 2: Upgrade Project Dashboard (`components/ProjectDashboard.tsx`)
*   Replace the static "Initiatives" list with the new `TicketBoard`.
*   Implement the "Matrix" Ticket Creation Modal (Project + Channel + Bet selectors).

### Phase 3: Implement Strategy Horizon (`components/RoadmapSandbox.tsx`)
*   Create a `ProjectTimeline` sub-component.
*   Insert it at the top of the Roadmap scroll container.
*   Ensure it scrolls horizontally in sync with the grid.

### Phase 4: Data Integrity (`store.tsx`)
*   Ensure deleting a Project unlinks tickets but does not delete them (they remain in their Channel/Bet).
*   Ensure deleting a Bet unlinks tickets from the Project (or warns user).
