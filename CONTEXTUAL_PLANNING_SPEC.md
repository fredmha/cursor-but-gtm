# Contextual Planning UI Specification

## 1. Concept: "The Strategy HUD"
When a user moves from **Step 2 (Principles)** to **Step 3 (Roadmap Sandbox)**, the context defined in previous steps must remain visible. The Roadmap Sandbox should not be an isolated grid; it should be a "Heads Up Display" where execution (the map) is built directly against strategy (the rules).

## 2. Layout Architecture
We will refactor the `RoadmapSandbox` layout from a single flex column to a **3-Pane Dashboard**.

### A. The "North Star" Header (Top Pane)
*   **Position**: Fixed at the top, below the main nav/breadcrumb.
*   **Height**: Compact (~64px).
*   **Content**:
    *   **Left**: Campaign Name (e.g., "Q4 Expansion").
    *   **Center/Right**: The North Star Objective, displayed prominently in `text-zinc-100`.
*   **Visuals**: `border-b border-white/5 bg-[#09090b]/90 backdrop-blur`.

### B. The "Rules of Engagement" Sidebar (Left Pane)
*   **Position**: Fixed Left, full height below Header.
*   **Width**: 
    *   **Expanded**: 280px.
    *   **Collapsed**: 48px (Icon only mode).
*   **Behavior**: Collapsible to maximize Grid space.
*   **Content**: 
    *   List of Operating Principles grouped by Category (Buckets).
    *   can edit reference cards.
*   **Visuals**: `border-r border-white/5 bg-[#09090b]`.

### C. The Roadmap Grid (Main Pane)
*   **Position**: Fills remaining space. should take up 80% of teh page still or more, it is the focal point
*   **Behavior**: Horizontal Scroll (`overflow-x-auto`).
*   **Content**: The existing Lanes + Weeks grid.

## 3. UI Implementation Details

### Sidebar Component: `ContextSidebar`
*   **Groups**: Render `principles` grouped by `category`.
*   **Cards**: Minimalist versions of the Step 2 cards.
    *   `text-xs` font.
    *   Truncated description.
    *   Hover reveals full text (Tooltip or expansion).
*   **Styling**:
    ```tsx
    <div className="w-72 border-r border-white/5 bg-zinc-950 flex flex-col">
      <div className="p-4 font-mono text-xs uppercase text-zinc-500 font-bold flex justify-between">
         <span>Principles</span>
         <button onClick={toggleCollapse}><Icons.Sidebar /></button>
      </div>
      <div className="overflow-y-auto flex-1 p-3 space-y-4">
         {/* Categories */}
         <div className="space-y-2">
            <h4 className="text-[10px] text-pink-500 font-bold uppercase">Customer</h4>
            <div className="bg-zinc-900/50 p-3 rounded border border-white/5 text-xs text-zinc-300">
               Always ship on Fridays
            </div>
         </div>
      </div>
    </div>
    ```

### Integration Logic
1.  **Read Data**: `RoadmapSandbox` already consumes `campaign`.
2.  **Pass Data**: Extract `campaign.objective` and `campaign.principles`.
3.  **Render**:
    *   Wrap existing Grid logic in a `<div className="flex flex-1 overflow-hidden">`.
    *   Insert `ContextSidebar` before the Grid div.
    *   Insert `NorthStarHeader` above the flex container.

## 4. User Experience Flow
1.  User finishes defining principles in Step 2.
2.  User clicks "Continue".
3.  **Transition**: The Principles canvas fades out.
4.  **Arrival**: The Roadmap Grid appears.
    *   The Principles just created slide into the Left Sidebar.
    *   The Objective slides into the Top Header.
5.  **Action**: User drags a "Bet" card onto the grid. They glance left to ensure it adheres to the "Principles".

## 5. Future Extensibility (Post-MVP)
*   **Drag-to-Link**: Drag a Principle from the sidebar onto a Roadmap Item to "Tag" it (e.g., "This launch enforces the 'Speed over Perfection' principle").
*   **Constraint Checking**: AI analyzes the Roadmap against the Principles in the sidebar.
