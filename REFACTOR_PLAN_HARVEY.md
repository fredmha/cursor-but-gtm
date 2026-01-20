# GTM OS: "Harvey" Aesthetic Redesign Plan

## 1. Design Philosophy
**Objective**: Invert the current "Dark Industrial" interface to a "Modern Productivity" aesthetic inspired by Harvey AI, Linear Light Mode, and Notion.
**Core Vibe**: Calm, Professional, Focused, High-Key (White/Light Grey).

### Visual Tenets
*   **Canvas**: Pure White (`#ffffff`) is the default background. Dark mode is removed.
*   **Structure**: Light Gray (`#f4f4f5` / `zinc-100` or `#fafafa` / `zinc-50`) defines structural areas (Sidebars, Headers).
*   **Separation**: Heavy contrast borders are replaced with subtle hairline borders (`#e4e4e7` / `zinc-200`).
*   **Typography**:
    *   Headings: `zinc-900` (Near Black).
    *   Body: `zinc-700`.
    *   Meta/Secondary: `zinc-500`.
*   **Accent & Status**:
    *   Status badges move from "Dark bg + Neon text" (e.g., `bg-emerald-900 text-emerald-400`) to "Pastel bg + Darker text" (e.g., `bg-emerald-50 text-emerald-700` with `border-emerald-200`).
*   **Shadows**: Use of `shadow-sm` and `shadow-md` (soft, diffused) to create depth on white cards against white/gray backgrounds, replacing 1px borders as the primary separator.

## 2. Navigation & Layout Architecture

### A. The Shell (`App.tsx`)
*   **Sidebar (Left)**:
    *   **Background**: `bg-zinc-50` or `bg-[#f9f9fb]`.
    *   **Width**: Fixed 260px.
    *   **Border**: Right border `border-zinc-200`.
    *   **Menu Items**: Simple text with icons. Active state is a subtle rounded rectangle (`bg-zinc-200/50` text `zinc-900`).
    *   **Organization**:
        1.  **Top**: Workspace/User Dropdown (Minimal).
        2.  **Primary**: Roadmap, Execution, Knowledge, Review.
        3.  **Bottom**: Settings / Impersonation.

### B. The Landing Page
*   **Trigger**: Displayed when `campaign === null` (User has not loaded/created a plan).
*   **Design**:
    *   Centered content on a white canvas.
    *   **Hero**: "GTM Operating System" in large, tracking-tight serif or sans-serif.
    *   **Subtext**: Muted gray.
    *   **CTA**: "Get Started" button (Solid Black `bg-zinc-900` text `white` rounded-md).

## 3. Component Refactor Specifications

### 3.1 Roadmap Sandbox (`RoadmapSandbox.tsx`)
*   **Background**: White.
*   **Timeline Header**: White background, bottom border `zinc-200`.
*   **Lanes**:
    *   Alternating backgrounds removed.
    *   Row dividers: Thin `zinc-100` lines.
*   **Cards (Task Bars)**:
    *   White background.
    *   Border `zinc-200`.
    *   Left accent strip remains but is thinner.
    *   Text: `zinc-700`.

### 3.2 Execution Board (`ExecutionBoard.tsx`)
*   **Sidebar**: Matches the global sidebar style (`bg-zinc-50`).
*   **Kanban Board**:
    *   Columns: Transparent backgrounds (or very subtle `bg-zinc-50/50`).
    *   Cards: White, `shadow-sm`, `border border-zinc-200`.
    *   Hover effects: `shadow-md`, `border-zinc-300`.
*   **List View**:
    *   Clean table rows with `border-b border-zinc-100`.
    *   Hover: `bg-zinc-50`.

### 3.3 Docs View (`DocsView.tsx`)
*   **Editor**: Paper-like experience.
    *   Pure white container centered on a light gray background.
    *   Typography: Serif for body (optional) or clean Sans.
    *   No visible borders on the editor canvas itself, just shadow.

### 3.4 Onboarding Wizard (`OnboardingWizard.tsx`)
*   **Transition**: Move away from the "Dark Card in Center" modal.
*   **New Style**: Full-screen white/gray split or a large, clean modal with ample whitespace.
*   **Progress Bar**: Thin, minimal line at top.

## 4. Color Token Mapping (Tailwind Config)

We will update `index.html` tailwind config:

| Token Name | New Value (Light Mode) | Old Value (Dark Mode) |
| :--- | :--- | :--- |
| `background` | `#ffffff` | `#09090b` |
| `surface` | `#fafafa` (Zinc-50) | `#18181b` |
| `surfaceHighlight` | `#f4f4f5` (Zinc-100) | `#27272a` |
| `border` | `#e4e4e7` (Zinc-200) | `#27272a` |
| `primary` | `#18181b` (Zinc-900) | `#f4f4f5` |
| `secondary` | `#71717a` (Zinc-500) | `#a1a1aa` |

## 5. Execution Strategy

1.  **Step 1: Foundation**: Update `index.html` with new color palette and `body` styles.
2.  **Step 2: Shell**: Rewrite `App.tsx` to implement the new Sidebar and Landing Page.
3.  **Step 3: Component Sweeps**:
    *   **Sweep A**: `RoadmapSandbox` (The core view).
    *   **Sweep B**: `ExecutionBoard` & `ProjectDashboard`.
    *   **Sweep C**: `DocsView` & `ReviewMode`.
4.  **Step 4**: Polish (Shadows, Transitions, Hover states).
