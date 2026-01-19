# GTM OS: Project Channels Specification (v2)

## 1. Core Concept
We are introducing a **"Project"** distinction to the Roadmap and Execution architecture. 
*   **Standard Channel**: Continuous execution buckets (e.g., "SEO", "Social", "Partnerships").
*   **Project Channel**: Finite, high-stakes initiatives with a start/end date (e.g., "Q4 Launch", "Rebrand").
*   **Static Lane**: Visual-only horizontal grouping (e.g., "Themes").

## 2. Data Model Updates (`types.ts`)

### A. Lane & Channel Types
We will update the `LaneType` and `Channel` interfaces to explicitly support `PROJECT`.

```typescript
export type LaneType = 'STATIC' | 'CHANNEL' | 'PROJECT'; 
// STATIC = Visual only
// CHANNEL = Standard/Ongoing (Legacy behavior)
// PROJECT = Finite, Rich Metadata (New behavior)

export type ProjectHealth = 'On Track' | 'At Risk' | 'Off Track' | 'Completed';

export interface ProjectUpdate {
  id: string;
  date: string;
  authorId: string;
  status: ProjectHealth;
  text: string;
}

export interface Channel {
  // Existing fields...
  type: 'CHANNEL' | 'PROJECT'; // Syncs with LaneType
  
  // NEW: Project Metadata (Only used if type === 'PROJECT')
  description?: string;
  status?: ProjectHealth;
  priority?: Priority;
  leadId?: string;
  memberIds?: string[];
  startDate?: string;
  targetDate?: string;
  updates?: ProjectUpdate[];
}
```

## 3. Roadmap Sandbox Enhancements (`RoadmapSandbox.tsx`)

### A. Lane Header "Buff"
The Left Sidebar (Lane Headers) will render differently based on `LaneType`:

1.  **Static**: Simple Text Title (Existing).
2.  **Channel**: Icon + Name + Bet Count (Existing).
3.  **Project (New)**: A rich "Card" header containing:
    *   **Top Row**: Project Name + Status Icon (Green/Yellow/Red).
    *   **Middle Row**: Lead Avatar + Priority Flag.
    *   **Bottom Row**: A mini progress bar (Calculated from % of Tickets closed in linked Bets).
    *   **Action**: Clicking this header opens the **Project Overview Modal**.

### B. Project Overview Modal ("The Linear View")
This modal matches the reference image and serves as the "Project Dashboard".

*   **Header**: Icon, Title, Description.
*   **Properties Sidebar (Right)**:
    *   **Status**: Dropdown (On Track, At Risk...).
    *   **Priority**: Dropdown.
    *   **Lead**: User Picker.
    *   **Members**: Multi-select User Picker.
    *   **Dates**: Start & Target Date pickers.
*   **Main Content (Left)**:
    *   **Latest Update**: Display the most recent `ProjectUpdate` (or "Post Update" button).
    *   **Initiatives**: A list of **Bets** linked to this Project. Shows Bet Name, Status, and a visual progress bar per Bet.
    *   **Milestones**: A list of **RoadmapItems** (Type: LAUNCH or CONTENT) that exist in this Project's lane, sorted by week.

### C. Lane Creation
*   Update `ChannelCreationModal` to have 3 tabs: **Channel**, **Project**, **Static**.
*   If **Project** is selected: User must define the Name, Lead, and Priority immediately.

## 4. Execution Board Enhancements (`ExecutionBoard.tsx`)

### Sidebar Segmentation
To handle the hierarchy clearly, the Sidebar will separate ongoing work from projects.

*   **Group 1: "Active Projects"**
    *   Lists all Channels where `type === 'PROJECT'`.
    *   Shows Project Health icon next to name.
*   **Group 2: "Channels"**
    *   Lists all Channels where `type === 'CHANNEL'`.
*   **Group 3: "My Issues"** (Existing)

## 5. Implementation Plan
1.  **Update `types.ts`**: Add `LaneType` 'PROJECT' and `ProjectUpdate` interfaces.
2.  **Update `store.tsx`**: Add `addProjectUpdate` action and ensure `addRoadmapLane` handles the Project type correctly.
3.  **Update `RoadmapSandbox.tsx`**: 
    *   **Override Roadmap Lock**.
    *   Refactor `LaneHeader` to support the 3 visual variants.
    *   Implement `ProjectOverviewModal` layout.
4.  **Update `ExecutionBoard.tsx`**: Segment the sidebar list.
