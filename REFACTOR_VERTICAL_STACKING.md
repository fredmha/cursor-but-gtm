# Refactor Plan: Dynamic Vertical Stacking for Roadmap Items

## 1. The Problem
Currently, `RoadmapCard` items are rendered with absolute positioning using a hardcoded `top` value (`top-2`). 
- **Conflict**: If multiple tickets (e.g., 5 LinkedIn posts) exist in the same Channel and Week, they render strictly on top of each other.
- **Result**: Users cannot see or interact with individual items when they overlap.

## 2. The Solution: Vertical Auto-Layout Engine
We will implement a lightweight layout algorithm (common in Gantt charts) that assigns a "Vertical Slot" to each item based on its collision with other items.

### A. Visual Behavior
1.  **Vertical Stacking**: Items in the same week will stack vertically (Slot 0, Slot 1, Slot 2...).
2.  **Dynamic Row Height**: The Channel Row (and its Sidebar counterpart) will automatically expand to fit the stack. If there are 5 tickets, the row grows taller.
3.  **Slot Logic**: 
    - A 1-week item in Slot 0.
    - A overlapping 1-week item goes to Slot 1.
    - A subsequent item in Week 2 checks Slot 0; if free, it takes it (compact packing).

### B. Technical Implementation

#### 1. The Layout Algorithm (`calculateLaneLayout`)
We will introduce a helper function in `RoadmapSandbox` that processes items per channel before rendering.

```typescript
interface LayoutItem extends RoadmapItem {
  layout: {
    slotIndex: number; // 0, 1, 2...
    top: number;       // Calculated pixel offset
    height: number;    // Fixed item height (e.g., 32px)
  }
}

function calculateLaneLayout(items: RoadmapItem[]): { items: LayoutItem[], maxSlots: number } {
  // 1. Sort items by Start Week, then Duration
  // 2. Iterate and assign the first available visual "row" (slot) for that time range
  // 3. Return enriched items and the total height needed
}
```

#### 2. Component Updates (`RoadmapSandbox.tsx`)

*   **Row Container**:
    *   Remove `min-h-[160px]` fixed constraint.
    *   Set height dynamically: `style={{ height: Math.max(160, (maxSlots * ITEM_HEIGHT) + PADDING) }}`.
    *   Apply this height to **both** the Left Sidebar (Channel Header) and the Right Grid (Lane) to keep them synced.

*   **RoadmapCard**:
    *   Remove fixed `top-2 bottom-2` positioning.
    *   Accept `top` and `height` from props.
    *   Style update: Thinner bars (~32px) to allow higher density.

## 3. User Experience Outcome
*   **"LinkedIn Content Blast" Scenario**: If you create 5 tickets in Week 1, they will appear as a neat vertical list of 5 bars in that week's cell. The entire row will expand to accommodate them.
*   **Visual Clarity**: No hidden items. Every ticket is clickable and draggable.
*   **Consistency**: Matches the "Bet Stack" list style in the sidebar, but spread across the timeline.
