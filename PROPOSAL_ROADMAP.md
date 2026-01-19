# GTM OS: Roadmap Architecture Proposal

## 1. System Definition
The **Roadmap Sandbox** is a high-fidelity, time-based planning surface. It functions as the bridge between "High Level Strategy" (Objectives) and "Tactical Execution" (Tickets).

### Core Philosophy: "The Map is Not the Terrain... until it is."
- **Sandbox Mode**: Users can drag "Cards" onto lanes freely (Themes, Ideas, Placeholders).
- **Execution Sync**: Specific cards can be "promoted" or "linked" to actual Execution Objects (Bets/Tickets).
- **Two-Way Binding**: Moving a linked card on the Roadmap updates the timeline of the underlying Bet.

## 2. Data Structure Updates (`types.ts`)

### A. Lanes (`RoadmapLane`)
Lanes are no longer just strings. They are smart containers.
- **Type `STATIC`**: Free-form lanes (e.g., "Market Events", "Company Themes").
- **Type `CHANNEL`**: Bound to a specific `ChannelID`. Automations apply here.

### B. Items (`RoadmapItem`)
Items are the atomic units on the grid.
- **`type`**: 
  - `NOTE` (Yellow sticky, text only)
  - `THEME` (Spans multiple weeks, high-level container)
  - `BET` (Linked to a `Bet` object)
  - `LAUNCH` (Milestone/Flag)
- **`resourceId`**: The UUID of the linked Bet/Channel if applicable.
- **`weekDuration`**: How many weeks this item spans (for the UI bar width).

## 3. Sync Logic & Automation

### Scenario A: Creating a Lane
1. User selects "Add Lane".
2. System asks: "Connect to Channel?"
   - **Yes**: User selects "LinkedIn". Lane is created. Existing Active Bets for LinkedIn auto-populate as Cards.
   - **No**: Creates a "Theme" lane.

### Scenario B: The "Promotion" Flow
1. User drops a generic `NOTE` card: "Launch AI Feature".
2. User decides to execute. Clicks "Promote to Bet".
3. System:
   - Creates a new `Bet` in `Channel: Product`.
   - Links `RoadmapItem.resourceId` to `Bet.id`.
   - Card style changes to "Execution Style" (shows status indicators).

## 4. Interaction Design (Linear-Style)

### Visuals
- **Grid**: 1 Week columns.
- **Lanes**: Collapsible? (MVP: No).
- **Cards**: 
  - Rounded corners (4px).
  - Subtle gradients for Launches.
  - Solid borders for Bets.
  - Dashed borders for Drafts.

### Controls
- **Click-to-Add**: Clicking an empty cell opens a "Quick Command" input (like Linear's `C` menu).
- **Drag-to-Move**: Updating `weekIndex` updates the database.
- **Resize**: (Post-MVP) Drag edge to extend duration.

## 5. Implementation Phases
1. **Phase 1 (Data Layer)**: Update Store to handle `linkedChannelId` and `resourceId`.
2. **Phase 2 (UI Shell)**: Render the grid dynamically based on Start/End dates.
3. **Phase 3 (Interactivity)**: Drag-and-drop mechanics and "Quick Add" modal.

## 6. Success Criteria
- A user can plan a "Theme" for October.
- A user can see that "LinkedIn" has a "Webinar" bet in Week 2 of October.
- The UI feels "solid" (no layout shifts, instant feedback).
