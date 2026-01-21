# Implementation Plan: Remove "Bet" Logic

## 1. Objective
Simplify the GTM OS architecture by removing the "Bet" (Hypothesis/Experiment) layer.
**New Hierarchy:** `Channel` → `Ticket` OR `Project` → `Ticket`.
Tickets will reside directly within Channels or Projects.

## 2. Schema Changes (`types.ts`)

### A. Remove `Bet` Interface
*   Delete the `Bet` interface entirely.
*   Remove `Status` enum usage related to Bets (Keep it if used for Projects/Roadmap, otherwise clean up).

### B. Update `Channel`
*   **Remove**: `bets: Bet[]`
*   **Add**: `tickets: Ticket[]` (Tickets now live directly on the Channel).

### C. Update `Ticket`
*   **Remove**: `betId?: string`.
*   **Retain**: `channelId?: string` and `projectId?: string` as the primary parents.

### D. Update `RoadmapItem`
*   **Remove**: `linkedBetId?: string`.
*   **Logic**: Roadmap Items now link directly to `ticketId` or exist as standalone descriptors.

## 3. Store Refactor (`store.tsx`)

### A. State Structure
*   Update initial state to hold `tickets` array inside `Channel` objects.
*   Migration: Any existing state initialization that creates dummy Bets must be removed.

### B. Actions
*   **Remove**: `addBet`, `updateBet`.
*   **Update**: `addTicket`, `updateTicket`, `deleteTicket`.
    *   Logic must now find the Channel and push/update the ticket in the `channel.tickets` array directly.
*   **Update**: `addRoadmapItem`. Remove logic trying to find a parent Bet.

## 4. Component Refactor

### A. `ChannelDashboard.tsx`
*   **Strategy Column**: Remove "Active Bets" list. Keep Principles and Team.
*   **Execution Column**: 
    *   Remove "Strategy Lock" overlay.
    *   Display all tickets belonging to the Channel.
    *   Remove groupings by Bet. Group by Status or Priority instead.
*   **Modals**: Remove `BetCreationModal` trigger.

### B. `RoadmapSandbox.tsx`
*   **Sidebar**: 
    *   Remove "Bets" nested under Channels.
    *   Show "Unscheduled Tickets" or just the Channel Header.
*   **Grid**: 
    *   Roadmap Cards no longer link to Bets.
    *   Drag-and-drop creates a Ticket directly in the Channel.
*   **Modals**: Remove `BetCreationModal` import/usage.

### C. `ExecutionBoard.tsx`
*   **Sidebar**: Remove "Bet" nested nodes in the tree view.
*   **Breadcrumbs**: Update to `Channel > Ticket` instead of `Channel > Bet > Ticket`.

### D. `TicketModal.tsx`
*   **Context Section**: Remove "Strategic Bet" dropdown.
*   **Logic**: Ticket simply belongs to a Channel or Project.

### E. `ReviewMode.tsx`
*   **Metrics**: Remove "Focus" (Active Bets).
*   **Health Matrix**: Remove. Replace with a "High Priority Tickets" or "Channel Velocity" view.

## 5. Service/Lab Refactor

### A. `labService.ts` & `geminiService.ts`
*   **Prompts**: Update AI to generate `Tickets` directly for a Channel, skipping the "Hypothesis/Bet" step.
*   **Output Schema**: Flatten JSON structure to return a list of tasks/tickets.

## 6. Deletions
*   Delete `components/BetCreationModal.tsx`.
*   Delete `components/ChannelGantt.tsx` (or heavily refactor if we want a Ticket Gantt, but likely safer to remove for now to simplify).

## 7. Approval Request
Please confirm to proceed with **Removing the Bet Layer** to flatten the architecture.
