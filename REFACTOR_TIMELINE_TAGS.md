# Refactor Plan: Timeline Week Tags

## 1. Analysis of Feedback
The previous implementation incorrectly conflated "Strategic Markers" (Themes/Launches) with "Lane Items" (Tickets).
- **Issue**: Markers were placed inside channel lanes, looking like tickets.
- **Requirement**: Markers must be associated with the **Time (Week)** itself, applicable globally or as a high-level annotation, independent of execution lanes.

## 2. Reversion Steps
1.  **`RoadmapSandbox.tsx`**:
    *   Remove "Strategic Context" mode from the Item Modal.
    *   Revert `RoadmapItemModal` to focus strictly on Ticket/Task creation.
    *   Remove "Tag/Pill" rendering logic from `RoadmapCard`.

## 3. New Architecture

### A. Data Model (`types.ts`)
Introduce `TimelineTag` to store week-level annotations.

```typescript
export interface TimelineTag {
  id: string;
  weekIndex: number; // The column index (e.g., 0 for Week 1)
  label: string;     // e.g., "THEME", "LAUNCH", "HOLIDAY"
  title: string;     // e.g., "Reliability Week", "v2.0 Release"
  color: string;     // Visual badge color
}

// Add to Campaign
export interface Campaign {
  // ...
  timelineTags: TimelineTag[];
}
```

### B. Store Actions (`store.tsx`)
*   `addTimelineTag(tag: TimelineTag)`
*   `deleteTimelineTag(tagId: string)`

### C. UI Implementation (`RoadmapSandbox.tsx`)

#### 1. Interactive Week Headers
The top row of the Roadmap (Timeline Header) will become interactive.
*   **Visual**: Display `TimelineTag` badges vertically stacked below the Date.
*   **Interaction**: Hovering/Clicking the Week Header cell opens the context menu.

#### 2. Week Context Modal
A new modal `WeekContextModal` triggered by clicking a Week Header.
*   **Header**: "Week {N} Context".
*   **List**: Existing tags for this week.
*   **Form**: Add new Tag.
    *   Type (Launch/Theme).
    *   Title.
    *   Color Picker.

## 4. Execution Plan
1.  **Step 1**: Revert `RoadmapSandbox.tsx` to remove incorrect "Lane Item" markers (Done).
2.  **Step 2**: Update `types.ts` with `TimelineTag`.
3.  **Step 3**: Add store actions in `store.tsx`.
4.  **Step 4**: Implement `WeekContextModal` and update Header rendering in `RoadmapSandbox.tsx`.
