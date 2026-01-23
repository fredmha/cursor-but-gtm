
# Implementation Plan: Manager Execution Views & Team Health

## 1. Objective
Expand the `ExecutionBoard` to support a "Manager Mode". This provides visibility into the entire team's workload, distinct from the individual contributor's "My Issues" view. It includes high-level health metrics to track weekly progress per team member.

## 2. New Features

### A. View Modes
The Execution Board will support two primary scopes:
1.  **My Focus** (Existing): Tickets assigned to `currentUser`.
2.  **Team Pulse** (New): All active tickets across the campaign.

### B. Visualization Types
Within "Team Pulse", the user can toggle between:
1.  **Queue (List)**: High-density table view for triage and prioritization.
2.  **Board (Kanban)**: Visual workflow view to identify bottlenecks.

### C. Team Health Metrics
A dashboard section at the top of "Team Pulse" displaying real-time stats for each team member:
*   **Workload Distribution**: Count of tickets by status (Todo / In Progress / Done).
*   **Weekly Velocity**: Visual progress bar of closed vs. open tickets.

## 3. Component Architecture

### Refactor `ExecutionBoard.tsx`
*   **State Management**:
    *   `scope`: `'MINE' | 'TEAM'`
    *   `viewType`: `'LIST' | 'BOARD'`
*   **Layout Updates**:
    *   **Sidebar**: Add "Team Pulse" navigation item.
    *   **Header**: Add View Toggles (List vs Board) and Filter controls.
    *   **Main Area**:
        *   If `scope === 'TEAM'`, render `<TeamHealthHeader />` before the ticket list/board.

### New Component: `TeamHealthHeader`
*   **Input**: `users`, `allTickets`.
*   **Logic**:
    *   Iterate through `users`.
    *   Filter tickets by `assigneeId`.
    *   Calculate breakdown: `Done` (Green), `In Progress` (Amber), `Todo` (Gray).
*   **Render**: A grid of cards, one per user, showing their avatar and a segmented progress bar.

### Update `TicketBoard` (Kanban)
*   Ensure it can handle "All Tickets" without grouping by Channel if needed (standard status columns).
*   Add ability to Group by Assignee (Swimlanes) - *Optional optimization for later*.

## 4. Execution Steps

1.  **Update `ExecutionBoard.tsx`**:
    *   Introduce `scope` state.
    *   Implement `TeamHealthHeader` inline or as sub-component.
    *   Add conditional rendering for List vs Board views (Reusing `TicketBoard` for Board view).
2.  **Refactor List View**:
    *   Extract the existing table from `MY_ISSUES` into a reusable `TicketList` component.
    *   Add columns for Assignee (if in Team mode).
3.  **Metrics Logic**:
    *   Filter tickets where `status !== 'Backlog'` to focus on active sprint work.

## 5. Visual Design (Harvey Style)
*   **Metrics Cards**: White cards, `shadow-sm`, `border-zinc-100`.
*   **Progress Bars**: Thin, multi-colored lines (`h-1.5`) with rounded ends.
*   **Toggles**: Segmented controls (`bg-zinc-100` p-1 rounded-lg).
