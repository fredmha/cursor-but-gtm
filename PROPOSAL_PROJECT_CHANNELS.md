# GTM OS: Project Channels & Rich Metadata Specification

## 1. Overview
We are introducing a distinct **"Project"** entity to the GTM OS. 
Currently, `Channels` are treated primarily as "Departments" (e.g., Marketing, Sales). 
The new **Project Channel** represents finite, high-stakes initiatives (e.g., "GTM Launch Q4", "Rebrand 2025") that require detailed tracking, specific leadership, and target dates.

This feature mimics the **Linear Project View**, providing a "God Mode" view for specific initiatives.

## 2. Data Model Architecture (`types.ts`)

### A. Channel Enhancements
The `Channel` interface will be upgraded to support rich metadata.

```typescript
export type ChannelType = '' | 'PROJECT'; // 'DEPARTMENT' = Ongoing, 'PROJECT' = Finite

export type ProjectHealth = 'On Track' | 'At Risk' | 'Off Track' | 'Completed';

export interface ProjectUpdate {
  id: string;
  date: string;
  authorId: string;
  status: ProjectHealth;
  text: string;
}

export interface Channel {
  id: string;
  name: string;
  type: ChannelType; // NEW: Differentiate between ongoing depts and finite projects
  campaignId: string;
  bets: Bet[];
  
  // NEW: Project-Specific Metadata
  description?: string;
  status?: ProjectHealth;
  priority?: Priority;
  leadId?: string; // Project Lead
  memberIds?: string[]; // Core team
  startDate?: string;
  targetDate?: string;
  updates?: ProjectUpdate[]; // History of status reports
}
```

### B. Hierarchy Mapping
To maintain the "Strict Hierarchy" rule while supporting the "Linear Image" view:
*   **"Project" (Image)** → Maps to **`Channel` (Type: PROJECT)**.
*   **"Initiatives" (Image)** → Maps to **`Bets`**.
*   **"Milestones" (Image)** → Maps to **`RoadmapItems`** (Type: LAUNCH/THEME) linked to this Channel.
*   **"Updates" (Image)** → Maps to new `updates` array on Channel.

## 3. Roadmap Sandbox Enhancements (`RoadmapSandbox.tsx`)

### A. Lane Header Redesign ("Buffed Out Lanes")
The Lane Header (Left Sidebar) will strictly differentiate between types:
1.  **Static Lane**: Simple title (as is).
2.  **Department Lane**: Icon + Name + Bet Count (as is).
3.  **Project Lane (NEW)**:
    *   **Visual**: Richer card-like header.
    *   **Data**: Display Project Status Icon (Green/Yellow/Red), Lead Avatar, and a mini Progress Bar (derived from Ticket completion).
    *   **Interaction**: Clicking the Header opens the **Project Overview Modal**.

### B. Project Overview Modal (The "Linear View")
A high-fidelity modal that exactly matches the provided reference image.
*   **Header**: Icon, Title, Description.
*   **Right Sidebar (Properties)**:
    *   Status (Select: On Track, At Risk...)
    *   Priority (Urgent, High...)
    *   Lead (User Picker)
    *   Members (Multi-user Picker)
    *   Dates (Start -> Target)
*   **Main Body**:
    *   **Latest Update**: Most recent status report with author/date.
    *   **Initiatives (Bets)**: List of linked Bets with their status/progress.
    *   **Milestones**: List of `RoadmapItems` (Type: LAUNCH) linked to this channel, sorted by date.

### C. Creation Flow
*   Update `ChannelCreationModal` to allow selecting **"Department"** (Ongoing) or **"Project"** (Finite).
*   If "Project" is selected, prompt for Lead and Priority immediately.

## 4. Execution Board Enhancements (`ExecutionBoard.tsx`)

### Sidebar Segmentation
The Sidebar will now split the "Strategy Tree" into two distinct sections:
1.  **Active Projects** (High priority, finite initiatives).
2.  **Departments / Operations** (Ongoing buckets like Marketing/Sales).

## 5. Implementation Steps
1.  **Update `types.ts`**: Add `ChannelType`, `ProjectHealth`, `ProjectUpdate` and extend `Channel`.
2.  **Update `store.tsx`**: Add `updateChannel` logic to handle the new fields and `addProjectUpdate`.
3.  **Update `RoadmapSandbox.tsx`**:
    *   **Override Roadmap Lock**.
    *   Refactor `LaneHeader` to support the 3 types.
    *   Implement `ProjectOverviewModal` (The "Linear" View).
    *   Update `ChannelCreationModal`.
4.  **Update `ExecutionBoard.tsx`**: Refactor Sidebar to segment Projects vs Departments.
