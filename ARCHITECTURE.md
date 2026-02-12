# GTM OS — Architecture (LLM-Oriented)

This document describes how the app and its agent systems work so that LLMs can interpret the codebase and extend it correctly.

---

## 1. High-Level Overview

**GTM OS** is a local-first, strategy-to-execution platform. One **Campaign** is the root of all data. There is no backend: state lives in React Context and persists to **localStorage**. AI is used for strategy generation and a **task agent** that operates over the user’s tickets via tool calls.

- **Entry**: `App.tsx` → `StoreProvider` → `MainLayout`. If no campaign exists, user sees “Initialize Workspace” and a blank `Campaign` is created.
- **Views** (sidebar): `ROADMAP` | `EXECUTION` | `DOCS` | `REVIEW` | `SETTINGS`. Each view is a full-screen component; `currentView` is in store.
- **Single source of truth**: `campaign` (and `users`) in `store.tsx`. All reads/writes go through the store.

---

## 2. Data Model (Source of Truth: `types.ts`)

### Root: `Campaign`

- **Identity**: `id`, `name`, `objective`, `startDate`, `endDate`, `status`.
- **Containers**: `channels[]`, `projects[]`. Work always belongs to one of these.
- **Planning**: `roadmapItems[]`, `timelineTags[]`, `principles[]`.
- **Knowledge**: `docFolders[]`, `docs[]` (ContextDoc). Docs can be linked to tickets via `ticket.linkedDocIds`.
- **Agent state**: `dailyChatHistory?`, `weeklyChatHistory?` (ChatMessage[]), `lastDailyStandup?`, `lastWeeklyReview?`.
- **Meta**: `recentDocIds`, `availableTags`, `sampleData` (for demo data toggle).

### Work Hierarchy (RULES.md: “Work cannot exist in a vacuum”)

- **Channel**: Ongoing lane (e.g. “Paid Social”). Has `tickets[]`, `principles[]`, `tags`, `links`, `notes`, `memberIds`, `plan?: ChannelPlan`.
- **Project**: Time-bound initiative. Has `tickets[]`, `updates[]`, dates, health status.
- **Ticket**: Atomic task. Has `channelId` **or** `projectId` (not both). Also `roadmapItemId` when tied to a roadmap bar. Fields: `title`, `description`, `status` (Backlog | Todo | In Progress | Done | Canceled), `priority`, `assigneeId`, `startDate`, `dueDate`, `linkedDocIds`.

### Roadmap ↔ Ticket Sync

- **RoadmapItem** can have `ticketId`, `channelId`, or `projectId`. When you add a roadmap item with a channel/project, the store can create a corresponding **Ticket** and link it. Updates to ticket status/title/dates are reflected on the roadmap; updates to roadmap item (drag, resize) update the linked ticket. Logic lives in `store.tsx` (`updateTicket`, `updateProjectTicket`, `updateRoadmapItem`).

### Users

- Stored separately: `users: User[]`, `currentUser: User`. Used for assignees and for scoping the review agent to “current user’s tasks.”

---

## 3. State Management (`store.tsx`)

- **Provider**: `StoreProvider` holds `campaign`, `users`, `currentUser`, `currentView`, `pendingTicketLink`, and all mutation functions.
- **Persistence**: `campaign` and `users` are synced to `localStorage` (`gtm-os-campaign`, `gtm-os-users`) in `useEffect`. On load, a migration block normalizes legacy shapes (e.g. ensures `channels[].principles`, `docFolders`, `docs` with `shortId`).
- **Mutations**: No component should replace `campaign` in place. They call store actions (e.g. `addTicket`, `updateDoc`, `updateChatHistory`). The store uses `updateCampaignState(prev => ...)` so the next state is a new object and React re-renders.
- **IDs**: Use `generateId()` from store (or doc `shortId` via `generateDocShortId` where applicable). Do not invent IDs in components.

**Important store actions for agents and AI flows**:

- Tickets: `addTicket(channelId, ticket)`, `updateTicket(channelId, ticketId, updates)`, `deleteTicket(channelId, ticketId)`; same for projects: `addProjectTicket`, `updateProjectTicket`, `deleteProjectTicket`.
- Chat: `updateChatHistory(mode: 'DAILY' | 'WEEKLY', messages)`, `completeReviewSession(mode)`.
- Docs: `addDoc`, `updateDoc`, `deleteDoc`, `linkDocToTicket`.
- Campaign/Channel: `updateChannelPlan(channelId, plan)`, `importAIPlan(channelsData)` (bulk channel + ticket creation).

---

## 4. Agent Architecture

### 4.1 Review / Task Agent (Daily Standup)

- **Purpose**: Act as a “personal task agent” for the current user: list, create, update, delete tasks assigned to them.
- **Where**: `services/reviewAgent.ts` defines tools and system prompt; `components/ReviewMode.tsx` runs the chat and executes tools.

**Context (data in)**:

- `buildCoreContext(campaign, currentUser)` in `reviewAgent.ts` builds a string: today’s date, user name, task counts by status, and a list of the current user’s tickets (from both channels and projects) with `id`, `shortId`, `title`, `status`. The model is instructed to call `show_tasks` when the user asks to see tasks.

**Tools (CORE_TOOLS)**:

| Tool           | Purpose                         | Handler in ReviewMode.tsx |
|----------------|----------------------------------|----------------------------|
| `show_tasks`   | Display tasks as cards in chat  | Renders `ChatKanbanCallout` with `ticketIds`; no store write. |
| `create_task`  | Create a task for current user   | Builds a `Ticket`, calls `addTicket(channelId, newTicket)` (uses first channel if none specified). |
| `update_task`  | Update title, status, or notes   | Resolves ticket → (parentId, type: CHANNEL \| PROJECT), then `updateTicket` or `updateProjectTicket`. |
| `delete_task`  | Delete a task                    | Same resolution, then `deleteTicket` or `deleteProjectTicket`. |

**Flow**:

1. User opens **REVIEW** view. Messages are hydrated from `campaign.dailyChatHistory` if present.
2. On first send, `initChat()` creates a Gemini chat with `CORE_SYSTEM_INSTRUCTION`, `CORE_TOOLS`, and history (including an initial “context” user message with task list).
3. User message is sent via `chat.sendMessage()`. Response is processed in `processResponse()`: model message (and any `functionCall` parts) are appended to local state and `updateChatHistory('DAILY', next)` is called so history persists.
4. For each `functionCall` in the response, `handleToolCall(call)` runs: it maps tool name + args to store actions, then `sendToolResponse(call, response)` sends the tool result back to the model so it can continue (e.g. confirm “Task created.”).

**Data out / platform changes**:

- New or updated or deleted tickets are written through the store; roadmap and execution views update automatically because they read from `campaign`.
- Chat history is written to `campaign.dailyChatHistory`.

**Design note**: RULES.md describes an “approve before commit” pattern (e.g. `AgentTicketCard` with PENDING/APPROVED). The current Review Mode implementation commits create/update/delete immediately. Extending to “propose then approve” would mean having the agent call a different tool (e.g. `propose_task`) and the UI committing only on user approval.

### 4.2 Planning Agent (Spec-Only Today)

- **Where**: `services/planningAgent.ts`.
- **Defines**: `PLANNING_TOOLS` (e.g. `load_plans`, `save_plan`, `list_tasks`, `list_team`, `upload_context`) and `PLANNING_SYSTEM_INSTRUCTION` (readiness gate, no writes without confirmation). `buildPlanningContext(campaign)` exposes objective, channel names, project names.
- **Status**: No UI is wired to run this agent or execute these tools yet. Useful as a contract for a future “planning” chat or weekly-planning flow.

### 4.3 One-Shot AI Services (`geminiService.ts`)

These are **not** chat agents; they take structured input and return JSON. The **caller** (component or hook) is responsible for writing results into the store.

| Function                      | Inputs                                      | Output              | Typical consumer / usage |
|------------------------------|---------------------------------------------|---------------------|---------------------------|
| `generateBetsFromPlan`        | `channelName`, `ChannelPlan`                | `Partial<Ticket>[]` | Channel plan modal: create tickets in that channel. |
| `generateWeeklyActionItems`  | `ethos`, `slippageContext`, `availableContexts` | `{ title, description, contextId }[]` | Weekly review: propose tasks per channel/project (contextId). |
| `generateFullCampaignFromChat` | `transcript: { role, text }[]`            | Full campaign JSON  | Lab onboarding: create campaign + channels + docs from conversation. |
| `generateChannelsAndBets`    | `objective: string`                         | `{ channels: [...] }` | Onboarding: suggest channels and tickets from objective. |

**Data in**: Campaign-derived context (e.g. channel list, project list, plan text, transcript).  
**Data out**: Returned to caller; caller uses `addChannel`, `addTicket`, `addDoc`, `updateChannelPlan`, `importAIPlan`, etc. The agent code never touches the store.

(There is a duplicate `labService.ts` with overlapping functions like `generateBetsFromPlan` and `generateFullCampaignFromChat`; lab components import from `labService`, onboarding from `geminiService`. Unifying or clearly splitting roles would reduce confusion.)

---

## 5. Data In / Data Out / How the Platform Is Modified

### Data in

- **User**: Typing in REVIEW chat, forms (Execution, Roadmap, Docs, Settings), drag-and-drop on roadmap, approving/discarding bulk or proposed tasks.
- **AI**:
  - Review agent: user message + tool calls; tool handlers read `campaign` and `currentUser` and call store actions.
  - One-shot services: inputs from campaign/UI; outputs are applied by the calling component via store.

### Data out

- **Persistence**: `localStorage` (campaign, users). No remote API.
- **Export**: `services/ExportUtils.ts` (e.g. HTML→Markdown, download). Does not change store.
- **UI**: All views read from `useStore()` (campaign, users, currentUser). No separate “API layer”; the store is the only writer.

### How the agent modifies the platform

1. **Review agent**: Invoked only in REVIEW. It modifies the platform by having its **tool calls** implemented in `ReviewMode.tsx` so they call:
   - `addTicket`, `updateTicket`, `updateProjectTicket`, `deleteTicket`, `deleteProjectTicket` → changes `campaign.channels[].tickets` and `campaign.projects[].tickets` (and synced roadmap items).
   - `updateChatHistory('DAILY', messages)` → changes `campaign.dailyChatHistory`.
2. **One-shot flows**: Callers (e.g. onboarding, lab, channel plan modal) call `geminiService`/`labService`, then call store actions with the returned data; the platform is modified only through those store actions.

---

## 6. Structural Decisions (Summary)

| Decision | Rationale |
|----------|-----------|
| Single Campaign, no backend | Local-first; one workspace per browser. |
| Tickets must have channel **or** project | Enforces “context over control”; no orphan tasks. |
| RoadmapItem ↔ Ticket sync in store | “The map is the terrain”; one source of truth, no duplicate work records. |
| All mutations via store actions | Predictable state updates, one place for persistence and migrations. |
| Agent tools implemented in UI (ReviewMode) | Tool semantics (e.g. “create task for current user”, first channel fallback) are app-specific; keep them next to the chat and store. |
| Chat history on Campaign | Daily/weekly review state is part of the workspace and survives reload. |
| Planning agent as spec-only | Clear contract for future planning UI; no direct store access from planning agent until a runner exists. |

---

## 7. File Map (Where to Look)

| Concern | Primary files |
|--------|----------------|
| Types and enums | `types.ts` |
| State and mutations | `store.tsx` |
| Review (task) agent | `services/reviewAgent.ts`, `components/ReviewMode.tsx` |
| Planning agent (spec) | `services/planningAgent.ts` |
| One-shot AI | `services/geminiService.ts`, `services/labService.ts` |
| Roadmap + ticket sync | `store.tsx` (addTicket, updateTicket, updateRoadmapItem, etc.), `components/RoadmapSandbox.tsx` |
| Execution (tickets by channel/project) | `components/ExecutionBoard.tsx`, `ChannelDashboard`, `ProjectDashboard` |
| Docs and ticket linking | `components/DocsView.tsx`, `store.tsx` (addDoc, linkDocToTicket, pendingTicketLink) |
| Agent-proposed task UI (approve/reject) | `components/AgentTicketCard.tsx`, `BulkTaskCallout.tsx` (used where bulk or proposed tasks are approved) |
| Rules and conventions | `RULES.md` |

Use this document together with `types.ts` and `store.tsx` to interpret how data flows, where the agent touches the platform, and how to add new tools or views without breaking the hierarchy or persistence model.
