# Roadmap Sandbox: UI & Interaction Specification

## 1. Visual Design Philosophy
The Roadmap Sandbox acts as the "War Room" canvas. It aligns with the GTM OS "Dark Mode Industrial" aesthetic using `zinc-950` backgrounds and `zinc-900` surfaces.

### Card Aesthetics
- **Container**: Glassmorphism base (`bg-zinc-900/80` or `bg-surface/80`, `backdrop-blur-md`) with subtle 1px borders (`border-white/5` or `border-border`).
- **Typography**: 
  - Titles: `font-sans`, `font-semibold`, `text-zinc-200`, `leading-tight`.
  - Meta: `font-mono`, `text-[9px]`, `uppercase`, `tracking-wider`.
- **States**:
  - **Default**: Clean, low noise. High legibility against the grid.
  - **Hover**: Subtle lift (`scale-[1.01]`), border glow (`border-zinc-500`), shadow (`shadow-xl`).
  - **Dragging**: Reduced opacity (60%), scaling down (`scale-95`), distinct shadow (`shadow-2xl`).
- **Color Coding**: 
  - Use **Accent Bars** (left border `border-l-2`) to indicate type (Bet=Indigo, Content=Zinc, Launch=Pink).
  - Avoid full background colors to maintain the "Glass" feel.

### Avatar Stack
- **Multi-User**: Supports `ownerIds` (array).
- **Visuals**: Overlapping circles (`-space-x-2`), `border-surface` to separate them. 
- **Limit**: Max 3 displayed, then `+N` counter.

## 2. Interaction Design

### Drag & Drop
- **Granularity**: 1-week snap grid.
- **Feedback**: 
  - Drop zones highlight slightly (`bg-white/[0.03]`) when hovering with a card.
  - The card being dragged follows the cursor precisely.

### Editing (Modal)
- **Trigger**: Single click on any card.
- **User Selection**: Multi-select Toggle Chips.
- **Live Preview**: Changes reflect immediately in state, but explicit "Save" closes the modal.

## 3. Data Structure (Aligned with `types.ts`)
- **`RoadmapItem`**:
  - `ownerIds: string[]` (Primary source of truth for visual assignment).
  - `linkedBetId?: string` (For bets).

## 4. Design Tokens Map
- **Background**: `bg-[#09090b]` (Canvas)
- **Surface**: `bg-[#18181b]` (Cards/Lanes)
- **Border**: `border-[#27272a]` (Grid lines)
- **Primary Text**: `text-[#f4f4f5]`
- **Secondary Text**: `text-[#a1a1aa]`
