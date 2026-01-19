# Codebase Rules

## 1. Immutable Files
**`components/RoadmapSandbox.tsx`** is considered "Gold Master". 
- **DO NOT MODIFY** this file unless the prompt explicitly contains the phrase: *"Override Roadmap Lock"*.
- Any changes to logic or UI must happen in `store.tsx` or other components to accommodate the Roadmap, not the other way around.

## 2. Hierarchy Enforcement
The application follows a strict data hierarchy. All UI views must reflect this relationship:
1.  **Channel** (Parent Container)
2.  **Bet** (Strategic Child)
3.  **Ticket** (Execution Grandchild)

## 3. Data Integrity
- A Ticket **must** belong to a Bet.
- A Bet **must** belong to a Channel.
- Deleting a Channel cascades to Bets.
- Deleting a Bet cascades to Tickets.
