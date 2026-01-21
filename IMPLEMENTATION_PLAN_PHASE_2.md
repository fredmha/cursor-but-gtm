# Refactor Plan: Phase 2 - Completing the "Muted Canvas"

## 1. Audit Findings
The following components are currently **Legacy Dark Mode** (`bg-[#09090b]`, `text-white`, `border-zinc-800`) and must be refactored to match the new **Light Mode** (`bg-white`, `text-zinc-900`, `border-zinc-100`).

### High Priority (Major Views)
1.  **`ChannelDashboard.tsx`**: Currently a dark "Command Center". Needs to align with the new clean `ProjectDashboard.tsx` (White card, gray sidebar).
2.  **`PrinciplesCanvas.tsx`**: Currently a dark void. Needs to become a clean "Miro-lite" surface (Dot grid on `bg-zinc-50`).
3.  **`LabOnboarding.tsx`**: Currently a dark terminal style. Needs to resemble a modern chat interface (e.g., ChatGPT Light Mode / Notion AI).

### Medium Priority (Modals)
4.  **`TicketModal.tsx`**: Hardcoded dark theme.
5.  **`BetCreationModal.tsx`**: Hardcoded dark theme.
6.  **`ChannelSetupModal.tsx`**: Hardcoded dark theme.
7.  **`ChannelPlanModal.tsx`**: Hardcoded dark theme.

---

## 2. Design Specification: "The Paper Layer"

### A. Modals (Global Pattern)
*   **Container**: `bg-white` (was `bg-zinc-950`).
*   **Border**: `border border-zinc-100` (was `border-zinc-800`).
*   **Shadow**: `shadow-2xl shadow-zinc-200/50` (Soft, diffused).
*   **Backdrop**: `bg-white/80 backdrop-blur-xl` (Frosted glass) or `bg-zinc-900/10 backdrop-blur-sm` (Subtle dim).
*   **Inputs**:
    *   **Bg**: `bg-white` or `bg-zinc-50`.
    *   **Border**: `border-zinc-200` -> `focus:border-indigo-500`.
    *   **Text**: `text-zinc-900` (Input), `text-zinc-400` (Placeholder).

### B. Channel Dashboard
*   **Structure**: Identical to `ProjectDashboard`.
*   **Left Sidebar (Strategy)**: `bg-zinc-50/50`, `border-r border-zinc-100`.
*   **Center (Execution)**: `bg-white`.
*   **Right Sidebar (Resources)**: `bg-zinc-50/50`, `border-l border-zinc-100`.
*   **Typography**: Headers `font-bold text-zinc-900`, Subtext `text-zinc-500`.

### C. Lab / AI Chat
*   **Canvas**: `bg-white`.
*   **Bubbles**:
    *   **AI**: `bg-zinc-50` text `zinc-800` (borderless).
    *   **User**: `bg-white` text `zinc-900` border `zinc-200` shadow-sm.
*   **Input Area**: Floating white bar with heavy shadow (`shadow-xl`), located at the bottom.

### D. Principles Canvas (Whiteboard)
*   **Background**: `bg-zinc-50` with a subtle CSS radial-gradient dot pattern (opacity 0.3).
*   **Buckets (Columns)**: `bg-zinc-100/50` -> `hover:bg-zinc-100`.
*   **Cards**: `bg-white`, `border-zinc-200`, `shadow-sm`, `hover:shadow-md`.

---

## 3. Implementation Steps

1.  **Refactor `TicketModal.tsx` & `BetCreationModal.tsx`**:
    *   Strip dark classes.
    *   Apply standard "Paper Modal" styling.
2.  **Refactor `ChannelDashboard.tsx`**:
    *   Invert colors to match the layout of `ProjectDashboard`.
    *   Ensure the Gantt chart renders correctly on light backgrounds.
3.  **Refactor `PrinciplesCanvas.tsx`**:
    *   Switch to light gray buckets on a dotted background.
4.  **Refactor `LabOnboarding.tsx` & `ChannelPlanModal.tsx`**:
    *   Convert to "Notion AI" style light interface.

## 4. Approval Request
Please confirm to proceed with **Phase 2 Refactor** to unify the visual language.
