# Roadmap Context Markers: Themes & Launches

## 1. Goal
Enable users to add high-level strategic context—specifically **Themes** and **Launches**—directly into Roadmap Week Cells. These serve as visual annotations (Tags) rather than executable work.

## 2. Strict Constraints (Per Requirements)
1.  **Visibility Scope**: These items must **ONLY** be visible as **Tags/Badges** within the specific **Week Cells** on the Roadmap.
2.  **Execution Isolation**: These items must **NEVER** appear in the Execution Board, Ticket Lists, or Project Dashboards. They are purely for the Roadmap view.
3.  **Interaction**: Created by clicking directly into a Week Cell.

## 3. Data Architecture
We will utilize the existing `RoadmapItem` interface with specific field usage for markers.

| Field | Usage for Context Marker | Usage for Standard Ticket |
| :--- | :--- | :--- |
| **`type`** | `'LAUNCH'` or `'THEME'` | `'CONTENT'` |
| **`label`** | The Tag Category (e.g., "Launch") | N/A (usually "Ticket") |
| **`title`** | The Specific Name (e.g., "Adora v1") | Task Title |
| **`linkedBetId`** | **NULL** (No parent strategy required) | **REQUIRED** (Must link to Bet) |
| **`ticketId`** | **NULL** (No execution ticket created) | **REQUIRED** (Links to Ticket) |

## 4. UI/UX Specification

### A. The Unified Item Modal
We will refactor `TicketModal` into a `RoadmapItemModal` with a high-level **Mode Switcher**:

1.  **Mode: Execution Task** (Existing Behavior)
    *   Requires Bet Linkage.
    *   Creates a Ticket.
    *   Renders as a Bar.

2.  **Mode: Context Tag** (New Behavior)
    *   **Fields**:
        *   **Tag Type**: Dropdown/Input (e.g., "Launch", "Theme", "Deadline").
        *   **Title**: Text Input (e.g., "Q4 Freeze").
        *   **Color**: Simple picker.
    *   **Hidden**: Bet Selector, Assignee, Priority, Description (Keep it simple).

### B. Visual Rendering: The "Cell Tag"
Inside `RoadmapSandbox` grid cells, these items will render distinctively:

*   **Style**: A compact, pill-shaped **Badge**.
*   **Format**: `[ICON/LABEL] Title`.
*   **Example**: 
    *   `<Badge class="bg-pink-500">🚀 Launch: Adora v2</Badge>`
    *   `<Badge class="bg-purple-500">🎨 Theme: Reliability</Badge>`
*   **Placement**: They stack alongside ticket bars but are visually distinct (no progress bars, no assignee avatars).

## 5. Implementation Steps

1.  **Rename & Refactor Modal**:
    *   Change `TicketModal` to `RoadmapItemModal`.
    *   Add `isContextMarker` toggle logic.
    *   Allow saving without `linkedBetId` IF `isContextMarker` is true.

2.  **Update `RoadmapCard`**:
    *   Check `item.type`.
    *   **If `LAUNCH/THEME`**: Render the **"Tag View"** (Compact badge, centered text or pill).
    *   **If `CONTENT`**: Render the **"Task View"** (Existing bar with assignee).

3.  **Verify Filters**:
    *   Ensure `store.addRoadmapItem` does NOT create a `Ticket` if `ticketId` is missing/type is context.
    *   Ensure `ExecutionBoard` filters strictly by `ticketId` existence or `type === 'CONTENT'`.
