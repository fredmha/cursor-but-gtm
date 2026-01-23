
# Implementation Plan: Weekly Review Ticket Controls

## 1. Objective
Enhance the **Weekly Review Wizard** (Act III: The Draft) to give users granular control over the tickets being generated. This includes editing AI suggestions and **manually adding new tickets** that were missed.

## 2. Component Refactor (`WeeklyReviewWizard.tsx`)

### A. State Updates
Update `GeneratedTicket` interface to include editable fields (already done).
Ensure validation logic exists for AI-generated Context IDs to prevent invalid references.

### B. UI Updates (Act III: Draft)
1.  **Ticket Card Controls**:
    *   **Context Selector**: Dropdown for Channel/Project.
    *   **Assignee Selector**: Dropdown for User.
    *   **Priority Selector**: Dropdown/Badge for Priority.
2.  **Manual Addition**:
    *   Add a **"Add Item"** button at the top or bottom of the list.
    *   This creates a blank ticket template in the list for the user to fill out.

### C. Logic Updates
1.  **Validation**: When mapping AI results, check if `contextId` exists in the campaign. If not, fallback to the first available Channel.
2.  **Finalization**: Ensure all selected tickets (AI + Manual) are created correctly.

## 3. Visual Design
*   **Card Style**: Clean, white cards with subtle borders (`border-zinc-200`).
*   **Controls**: Compact row at the bottom of the card (`bg-zinc-50`).
*   **Add Button**: Dashed border card acting as a button.

## 4. Execution Steps
1.  **Update `handleGeneratePlan`**: Add ID validation.
2.  **Implement `handleAddManualTicket`**: Logic to push empty ticket to state.
3.  **Update Render**: Render the "Add Item" button in the grid.
