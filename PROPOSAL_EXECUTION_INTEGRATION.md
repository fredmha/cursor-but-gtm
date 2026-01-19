# Implementation Proposal: Unified Execution Interface

## 1. Objective
Ensure every data point defined in the Roadmap (Projects, Metadata, Updates, Bets) is fully accessible and actionable within the Execution Board.

## 2. Navigation Architecture (Sidebar)
Refactor the Execution Sidebar into a strictly hierarchical tree that allows selecting Parents (Projects) as well as Children (Bets).

*   **Section 1: Workspace**
    *   "My Issues" (Aggregate view)
*   **Section 2: Active Projects** (Finite Initiatives)
    *   *Clicking the Project Name* opens the **Project Dashboard** (The "God Mode" view).
    *   *Expanding the Project* reveals **Bets** (Initiatives).
    *   *Clicking a Bet* opens the **Ticket Board** (The "Workbench" view).
*   **Section 3: Departments** (Ongoing Channels)
    *   *Clicking the Department Name* opens the **Channel Summary**.
    *   *Expanding* reveals **Bets**.

## 3. The "Project Dashboard" View (New)
We will refactor the internal logic of the Roadmap's `ProjectOverviewModal` into a reusable component that can serve as a full-screen view in the Execution Board.

**What you see:**
1.  **Header**: Project Title, Description, Health Status (Editable), Priority.
2.  **Right Rail**: Meta-data (Lead, Dates, Team).
3.  **Main Feed**:
    *   **Status Updates**: Read and Post new updates (syncs to Roadmap).
    *   **Initiatives (Bets)**: High-level progress bars. Clicking one navigates to the Ticket Board for that Bet.
    *   **Roadmap Milestones**: Read-only view of high-level milestones (Launches) linked to this project.

## 4. The "Bet Workbench" View (Enhanced)
The existing Ticket Board will be enhanced to allow editing the "Bet" container itself, not just the tickets within it.

1.  **Header**: Display Hypothesis & Success Criteria.
2.  **Actions**: "Edit Bet Details" button (allows editing the Description/Hypothesis originally defined in Roadmap).
3.  **Context**: Breadcrumbs clearly showing `Project > Bet`.

## 5. Technical Implementation Steps
1.  **Extract Component**: Extract the content of `ProjectOverviewModal` from `RoadmapSandbox.tsx` into a new reusable component `components/ProjectDashboard.tsx`.
2.  **Refactor `ExecutionBoard.tsx`**:
    *   **State**: Track `selectedView`: `'MY_ISSUES' | { type: 'PROJECT', id: string } | { type: 'BET', id: string }`.
    *   **Sidebar**: Update click handlers to set the specific view type.
    *   **Render**: Switch between `ProjectDashboard` (High Level) and `TicketBoard` (Low Level) based on selection.
3.  **Data Sync**: Ensure editing the "Health Status" in the Project Dashboard updates the store, which immediately reflects on the Roadmap Lane header.

This approach ensures zero data loss between views and allows a Project Lead to manage the entire initiative without ever leaving the Execution tab.