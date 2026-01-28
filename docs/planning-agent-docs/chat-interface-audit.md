# Chat Interface Audit (Review Mode + Docs)

## Scope
This audit focuses on how the current chat interface works, where slash commands and planning workflows should hook in, and how the Docs system can store planning artifacts.

## Key Files and Responsibilities
- `components/ReviewMode.tsx`
  - Main chat UI, input handling, tool call parsing, and action cards.
  - Runs Gemini via `GoogleGenAI`, keeps local chat state, and persists chat history in store.
  - Houses mention resolver and @ picker; most command routing should live here.
- `components/AgentTicketCard.tsx`
  - Renders tool proposals like `propose_ticket` and `create_task`.
- `components/ChatKanbanCallout.tsx`
  - Renders `show_tasks` results as a kanban-like callout.
- `components/BulkTaskCallout.tsx`
  - Renders `propose_bulk_tasks` results for batch approval.
- `services/reviewAgent.ts`
  - Defines tools (`show_tasks`, `propose_ticket`, `propose_bulk_tasks`, `resolve_references`, etc.).
  - Builds Daily/Weekly context strings and sets system instructions.
- `fixtures/reviewAgentFixture.ts`
  - Test campaign data for Review Mode.
- `components/DocsView.tsx`
  - Notion-style workspace for folders and docs.
  - Supports favorites, recents, tags, and RAG indexing toggles.
- `store.tsx`
  - Global state (campaign, docs, folders, tickets, chat history).
  - LocalStorage persistence.
- `types.ts`
  - Shared data shapes, including `ContextDoc` and `DocFolder`.

## Current Chat Architecture (ReviewMode)
1) Input capture and local state
   - Input is a single-line text field with `handleInputChange` and `handleInputKeyDown`.
   - @ mentions: built-in detection via `updateMentionState()` and a mention dropdown UI.
2) Dispatch and tool handling
   - `handleSend()` sends user message to LLM unless intercepted.
   - Tool calls from the model are parsed into `pendingActions` and rendered as cards.
   - `propose_bulk_tasks` creates a BulkTaskCallout flow.
3) Reference resolution
   - `resolve_references` and `fetch_reference_context` are implemented in ReviewMode via local indexing.
   - Reference index spans tickets, docs, channels, projects, and users.
4) Persistence
   - Daily/Weekly chat history stored in `campaign.dailyChatHistory` and `campaign.weeklyChatHistory`.

## Docs Workspace (Planning Storage Target)
- Docs and folders are first-class (`ContextDoc`, `DocFolder`).
- `DocsView.tsx` already supports:
  - Folder hierarchy and ordering
  - Recents/favorites
  - Tagging
  - RAG indexing toggles (`toggleRagIndexing`)
- This is the intended storage layer for planning artifacts.

## Existing Command System Work
- See `implementationplans/agentic-command-system-plan.md` for `/task`, `/plan`, and general command routing.
- The same path should be extended for:
  - `/start daily plan`
  - `/start weekly plan`
  - `/start quarterly plan`
  - `/set sprint plan`
- The router belongs in `ReviewMode.tsx` before the LLM call.

## Gaps vs. Desired Planning Workflow
1) No slash command picker UI
   - Only @ mention dropdown exists.
   - Need a Notion-style `/` menu integrated into the input field.
2) No file upload in chat
   - DocsView can store docs, but chat lacks file ingestion and upload.
3) No planning data model
   - Planning artifacts must be saved as `ContextDoc` in Docs workspace.
4) No planning agent/service
   - Daily/Weekly agents exist. Planning agents and SOPs are not wired into tool schema or UI state.

## Integration Points for Planning
- `ReviewMode.tsx`
  - Add slash command router + picker.
  - On `/start *` commands, invoke planning SOP state machine before LLM.
  - Use `resolve_references` and `fetch_reference_context` for context gathering.
- `services/reviewAgent.ts`
  - Add planning tools and system instructions or create a `planningAgent.ts` service.
  - Reuse the tool pipeline already present.
- `DocsView.tsx` + `store.tsx`
  - Create Planning folder tree if missing.
  - Save planning artifacts as docs in `Planning/*` folders.
  - Use `isRagIndexed` for planning + uploads.

## Recommended Next Steps
- Implement a slash command picker alongside the existing @ mention picker.
- Add planning folder bootstrap in store migration (create `Planning`, `Daily`, `Weekly`, `Quarterly`, `Sprint`, `Context`, `Uploads`).
- Add a lightweight file upload path in ReviewMode:
  - Create a `ContextDoc` in `Planning/Uploads`.
  - Mark `isRagIndexed: true` by default.
- Introduce a Planning agent service modeled after `reviewAgent.ts`.

