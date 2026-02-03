
# GTM OS (Go-To-Market Operating System)

> A unified strategy-to-execution platform for high-velocity SaaS teams.

GTM OS replaces the fragmented stack of Google Docs, Jira, and Miro with a single, coherent operating system. It enforces a strict hierarchy where every unit of work (Ticket) is directly linked to a strategic container (Project or Channel) and a specific timeframe.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-stable-green)

---

## 🌟 Core Philosophy

1.  **The Map IS The Terrain**: Planning and execution happen in the same database. A card on the Roadmap *is* a ticket in the backlog.
2.  **Context Over Control**: Every task links to a "Why" (Strategy Doc, Principle, or KPI).
3.  **Finite vs. Infinite**: Work is split into **Projects** (Finite, time-bound initiatives) and **Channels** (Infinite, ongoing operational lanes).

## 🚀 Key Features

### 1. Roadmap Sandbox ("The War Room")
*   **Visual Strategy**: A Gantt-style timeline for high-level planning.
*   **Strategy Horizon**: A dedicated top-layer view for finite Projects.
*   **Contextual Tags**: Week-level markers for "Launches", "Themes", and "Deadlines".
*   **Vertical Auto-Stacking**: Dynamic layout engine handles high-density planning without overlap.

### 2. Execution Board ("Linear-Style")
*   **Team Pulse**: A manager's view of the entire team's velocity and workload distribution.
*   **My Focus**: An IC (Individual Contributor) view filtering out noise.
*   **Project Command**: Dedicated dashboards for specific initiatives with embedded Kanban boards.
*   **Strict Hierarchy**: Tickets cannot exist in a vacuum; they must belong to a Channel or Project.

### 3. Knowledge Base ("Notion-Lite")
*   **Rich Text & Canvas**: Integrated WYSIWYG editor and infinite Canvas/Whiteboard.
*   **Direct Linkage**: Documents can be "pinned" to specific Tickets to provide immediate context (PRDs, designs, briefs).
*   **Folder Organization**: Dynamic folder structures for Strategy, Personas, Brand, etc.

### 4. Strategy Lab (AI)
*   **Conversational Architect**: A Gemini-powered agent that interviews you to generate full GTM strategies.
*   **Review Agent**: A Daily/Weekly AI companion that runs standups, identifies slippage, and proposes schedule adjustments.

---

## 🛠 Tech Stack

*   **Framework**: React 18 (ESM)
*   **Styling**: Tailwind CSS (Custom "Harvey" Light Theme)
*   **Icons**: Hand-coded SVGs (Lucide-style) for zero-dependency weight.
*   **State Management**: React Context + LocalStorage (Local-first architecture).
*   **AI**: Google Gemini API (`@google/genai`).

---

## 🚦 Getting Started

### Prerequisites
*   Node.js (v18+)
*   A Google Gemini API Key (Paid tier recommended for Veo/Imagen features, though standard text models work on free tier).

### Installation

1.  **Clone & Install**
    ```bash
    npm install
    ```

2.  **Environment Setup**
    Create a `.env` file in the root:
    ```env
    API_KEY=your_google_gemini_api_key
    ```

3.  **Run Development Server**
    ```bash
    npm start
    ```

4.  **Reset / Initialize**
    Upon first load, click **"Initialize Workspace"** to seed the local database with a blank campaign structure.

---

## 📂 Project Structure

```text
/
├── components/
│   ├── ExecutionBoard.tsx    # Main issue tracking & Team Pulse
│   ├── RoadmapSandbox.tsx    # Visual timeline & Strategy Horizon
│   ├── DocsView.tsx          # Knowledge base & Editors
│   ├── ReviewMode.tsx        # AI Agent chat interface
│   ├── ProjectDashboard.tsx  # "God Mode" view for Projects
│   └── ...
├── services/
│   ├── geminiService.ts      # AI Logic for Strategy Generation
│   └── reviewAgent.ts        # AI Logic for Core Task Agent
├── store.tsx                 # Central State (Context + LocalStorage)
├── types.ts                  # TypeScript Definitions (The Source of Truth)
└── constants.tsx             # Icons & Static Configs
```

## 🎨 Visual Design System ("Harvey")

The application uses a **Strict Light Mode** aesthetic designed for focus.

*   **Surface**: `zinc-50` / `#fafafa` (Sidebar, Backgrounds)
*   **Card**: `white` / `#ffffff` (Active elements)
*   **Border**: `zinc-100` / `#f4f4f5` (Subtle separation)
*   **Text**: `zinc-900` (Headings), `zinc-500` (Meta)
*   **Accents**: Pastel backgrounds with saturated text (e.g., `bg-indigo-50 text-indigo-600`).

---

## 🤝 Contributing

1.  **Read `RULES.md`**: Strictly adhere to the architectural constraints.
2.  **No Business Logic in UI**: Move complex state mutations to `store.tsx`.
3.  **Preserve the Hierarchy**: Ensure `Project > Ticket` or `Channel > Ticket` relationships are never broken.

---

*Built with ❤️ for the GTM Engineers.*
