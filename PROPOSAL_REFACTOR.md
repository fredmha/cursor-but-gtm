# Refactor Proposal: GTM OS v2

## 1. Architectural Simplification
**Objective:** Eliminate redundancy and enforce the Roadmap as the single source of truth for strategy.

*   **Remove `PlanningView.tsx`**: The "Architect's Table" view is redundant. Channel and Bet creation now happens natively in the Roadmap Sandbox.
*   **Update Navigation**: Remove the "Planning" tab. The workflow becomes: `Roadmap` (Plan) -> `Execution` (Build) -> `Review` (Optimize).

## 2. Execution Board: "Linear-Style" Workbench
**Objective:** High-density, high-performance issue tracking focused on flow.

*   **View Options**: Introduce a **List / Board Toggle**.
    *   **List View**: Dense rows, showing ID, Title, Assignee, Priority, Status, Due Date. Similar to Linear's default project view.
    *   **Board View**: Existing Kanban, but tightened visuals (smaller cards, distinct status columns).
*   **Visual Overhaul**:
    *   **Typography**: Switch to strictly Monospace for IDs (`T-123`) and Dates.
    *   **Status Icons**: Use standardized SVG icons for Todo (Circle), In Progress (Half Circle), Done (Check Circle).
    *   **Avatars**: Small, overlapping for assignees.
*   **Sidebar Refinement**:
    *   Group Bets by Channel (Keep existing logic).
    *   Add "All My Tickets" view (Aggregation across all bets).

## 3. Review Mode: Strategic Health Check
**Objective:** Actionable insights rather than just data visualization.

*   **Metric Cards**: "Velocity" (Tickets closed this week), "Slippage" (Overdue tickets), "Focus" (Active Bets count).
*   **Bet Health Table**:
    *   A dense table view of all active Bets.
    *   Columns: Bet Name, Channel, Ticket Completion %, Hypotheses Validation (User input field for notes).
    *   **Actions**: "Kill", "Snooze", "Double Down" (Prominent action buttons).

## 4. Implementation Steps
1.  **Delete** `components/PlanningView.tsx`.
2.  **Modify** `App.tsx`: Remove Planning route/tab. Default to `ROADMAP`.
3.  **Refactor** `components/ExecutionBoard.tsx`: Add List View component, update CSS for "Linear" feel.
4.  **Refactor** `components/ReviewMode.tsx`: Implement the Health Table and Metric Cards.
