# GTM OS: "Harvey" Refinement - The Muted Canvas

## 1. Design Philosophy: "Sidebar DNA"
The previous implementation was too rigid (boxes within boxes). The new goal is to extend the visual language of the sidebar—clean, list-based, muted interactions—into the main workspace.

**Core Mantra**: "If it doesn't need a border, remove it. If it doesn't need to be black, make it gray."

### Visual Tenets
*   **Unified Texture**: The distinction between "Sidebar" and "Content" should be subtle. Use `bg-zinc-50` for structure and `bg-white` for active surfaces, but blend them with softer edges.
*   **Softened Boundaries**: Replace `border-zinc-200` (Hard) with `border-zinc-100` (Soft) or remove borders entirely in favor of whitespace.
*   **Muted Typography**:
    *   Primary Text: `text-zinc-800` (instead of `zinc-900`).
    *   Secondary Text: `text-zinc-500`.
    *   Interactive Text: `text-zinc-500` -> `hover:text-zinc-900` (The "Sidebar Hover" effect).
*   **Fluid Lists**: Tables and cards should behave like sidebar menus—interactive rows with rounded corners and subtle background shifts on hover, rather than rigid grids.

## 2. Component Refactor Specifications

### A. Global Layout (`App.tsx`)
*   **Sidebar**:
    *   Make the separator `border-zinc-100`.
    *   Ensure the background is a very subtle `bg-[#fafafa]` (zinc-50/70).
*   **Typography**: Switch global font usage from `font-bold` to `font-medium` or `font-semibold` to reduce visual weight.

### B. Execution Board (`ExecutionBoard.tsx`)
*   **The "Sidebar" Effect**:
    *   The "My Issues" list should lose the heavy table header.
    *   Rows become clickable "List Items" with `rounded-lg` and `hover:bg-zinc-50`.
    *   Status icons become muted (`text-zinc-400`) until hovered or active.
*   **Project Headers**: Remove heavy borders. Use large, clean typography on white.

### C. Review Mode (`ReviewMode.tsx`)
*   **De-Carding**: Remove the `border` from Metric Cards.
    *   New Look: Floating values on the white canvas, or subtle `bg-zinc-50` blocks with *no* border.
*   **Table Refactor**: Convert the "Bet Health Matrix" into a clean list view.
    *   Remove vertical dividers.
    *   Use generous padding.

### D. Roadmap Sandbox (`RoadmapSandbox.tsx`)
*   **Left Headers (Channels)**:
    *   Style them exactly like the Main Sidebar.
    *   Remove the heavy vertical line separating the left panel from the timeline. Use a drop shadow or just whitespace.
*   **Grid**:
    *   Make grid lines `border-zinc-50` (barely visible).
    *   Roadmap Cards: `bg-white`, `shadow-sm`, `border-zinc-100`. Simpler, cleaner bars.

### E. Modals (All)
*   **Backdrop**: Lighter (`bg-white/80 backdrop-blur-xl`).
*   **Container**: `bg-white`, `shadow-2xl`, `border-zinc-100`.
*   **Inputs**: `bg-zinc-50` borderless inputs (Notion style) instead of outlined boxes.

## 3. CSS/Tailwind Token Adjustments
*   **`border-border`**: Re-alias to `zinc-100` (was `zinc-200`).
*   **`text-primary`**: Re-alias to `zinc-800`.
*   **`bg-surface`**: Re-alias to `zinc-50`.

## 4. Execution Steps
1.  **Token Refresh**: Update `index.html` theme config.
2.  **Layout Softening**: Update `App.tsx` sidebar styles.
3.  **View Refactoring**: Systematically apply the "Sidebar List" style to `ExecutionBoard` and `RoadmapSandbox`.
