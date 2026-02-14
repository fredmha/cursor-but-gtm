
# GTM OS

A local-first GTM coordination workspace with two core surfaces:

- `Execution`: a structured ticket table for delivery tracking.
- `Canvas`: a visual whiteboard for modeling artifacts (email cards, containers) and linking them to execution tickets.

The product model is simple: create on canvas, track in execution, and keep links between both in sync.

## Current Scope

This repo currently focuses on:

- Execution table (`TASK` and `TEXT` row types).
- Canvas workspace (`EMAIL_CARD` and `CONTAINER` elements).
- Bidirectional bridge between canvas elements and ticket rows.

It does **not** currently include the older docs/review/AI surfaces referenced in legacy docs.

## Key Features

- Execution table with inline editing, add/delete rows, assignee/priority/status fields.
- Canvas workspace with pan/zoom, connectable nodes, parent-child containers, and element selection.
- Email card builder on canvas with block-based composition (`H1`, `H2`, `H3`, `BODY`, `IMAGE`).
- Drag-and-drop block reorder and per-block editing (text, alignment, spacing, dimensions, image URL/upload).
- Ticket-to-canvas linking via modal pickers in both views.
- Local persistence to browser storage with schema normalization/migration for canvas scene data.

## Architecture Overview

### App Shell

- `App.tsx` mounts `StoreProvider` and renders either `ExecutionBoard` or `CanvasView`.
- Sidebar controls active view and user switching.

### State and Persistence

- `store.tsx` is the central state layer (React Context).
- Campaign/users persist in localStorage (`gtm-os-campaign`, `gtm-os-users`).
- In dev mode, storage resets on reload (`import.meta.env.DEV`).
- Canvas scene is persisted as `CanvasScene` (`version: 2`) and normalized on load.

### Canvas Runtime

- `components/CanvasView.tsx` hosts React Flow and inspector/tooling UI.
- `components/canvas/useCanvasController.tsx` owns canvas runtime state, undo/redo history, and commit scheduling.
- `components/canvas/CanvasElementNode.tsx` renders the visual card UI, including email block rows.
- `components/canvas/canvas-core.ts` contains scene mapping helpers and email block/template utilities.

### Execution Runtime

- `components/ExecutionBoard.tsx` is the table shell.
- `components/execution/useExecutionController.ts` coordinates row actions and editing state.
- `components/execution/execution-columns.tsx` defines table columns and cell behavior.

## Data Model Notes

- Core types live in `types.ts`.
- `CanvasEmailTemplate` is currently block-based:
  - `version: 1`
  - `blocks: CanvasEmailBlock[]`
- There is no HTML/MJML export pipeline in this repo; canvas email cards are rendered directly from block data.

## Tech Stack

- React 19 + TypeScript
- Vite 6
- React Context + localStorage (local-first state)
- `@xyflow/react` (canvas graph/editor runtime)
- `@tanstack/react-table` (execution table)
- `@dnd-kit/*` (email block DnD)
- Vitest + Testing Library (`jsdom`) for tests

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Environment

Create `.env` in project root:

```env
GEMINI_API_KEY=your_key_here
```

`vite.config.ts` exposes `GEMINI_API_KEY` to both `process.env.GEMINI_API_KEY` and `process.env.API_KEY`.

### Run

```bash
npm run dev
```

Open the app, then click **Initialize Workspace** on first load.

## Scripts

- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run preview` - preview production build
- `npm run test` - run tests once
- `npm run test:watch` - run tests in watch mode

## Project Map

```text
/
├── App.tsx
├── store.tsx
├── types.ts
├── components/
│   ├── CanvasView.tsx
│   ├── ExecutionBoard.tsx
│   ├── canvas/
│   │   ├── useCanvasController.tsx
│   │   ├── CanvasElementNode.tsx
│   │   ├── CanvasInspectorPanel.tsx
│   │   └── canvas-core.ts
│   └── execution/
│       ├── useExecutionController.ts
│       ├── execution-columns.tsx
│       └── execution-core.ts
└── components/canvas/canvas-core.test.ts
```

## Testing

- Current focused test coverage is in `components/canvas/canvas-core.test.ts`.
- Run tests with `npm run test`.
