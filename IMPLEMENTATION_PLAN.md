# Implementation Plan: GTM Dashboard Revamp

## Objective
Align `PlanningView`, `ExecutionBoard`, and `ReviewMode` with the strict **Channel > Bet > Ticket** hierarchy established in the Roadmap Sandbox.

## 1. Planning View (`components/PlanningView.tsx`)
**Goal:** The "Architect's Table". Focus on defining Channels and placing Bets.
*   **Layout:** Horizontal scroll of **Channel Columns**.
*   **Visuals:**
    *   Each column header represents the `Channel`.
    *   Cards within columns represent `Bets`.
    *   **No Tickets** are visible here. This is high-level strategy only.
*   **Logic:**
    *   Adding a Channel here creates a `RoadmapLane` (Type: CHANNEL) automatically.
    *   Adding a Bet here creates a `Bet` entry linked to that Channel.

## 2. Execution View (`components/ExecutionBoard.tsx`)
**Goal:** The "Engineer's Workbench". Focus on closing Tickets within the context of a Bet.
*   **Sidebar Navigation:**
    *   **Grouped List**: Instead of a flat list of Bets, group them under collapsible `Channel` headers.
    *   *Visual*: `Channel Name` (Header) -> `Bet Name` (Item).
*   **Main Board (Kanban)**:
    *   **Header**: Displays the selected **Bet's Hypothesis & Success Criteria**. This reminds the user *why* they are doing the work.
    *   **Columns**: Todo / In Progress / Done.
    *   **Ticket Modal**: Must match the Roadmap's modal fields (`Description`, `Due Date`, `Priority`).

## 3. Review View (`components/ReviewMode.tsx`)
**Goal:** The "Manager's Report". Focus on velocity and strategic health.
*   **Layout:** Vertical stack of **Channel Sections**.
*   **Visuals**:
    *   **Channel Header**: Aggregate stats (Total Bets, Total Tickets closed).
    *   **Bet Rows**: Progress bars showing Ticket completion %.
*   **Logic**:
    *   Allows toggling Bet Status (Active/Paused/Killed).
    *   "Killed" bets stop showing up in Execution/Roadmap.
