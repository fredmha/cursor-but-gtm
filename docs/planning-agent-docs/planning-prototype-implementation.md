# Planning Prototype Implementation Roadmap (Frontend-First)

## Objective
Deliver a fully functional planning prototype in the existing chat interface before any backend integration. All data persists via the current client-side store/localStorage and Docs workspace.

## Prototype Constraints
- No backend calls or server persistence.
- All planning artifacts are stored as `ContextDoc` in Docs workspace.
- Planning workflows run in the current chat UI (`ReviewMode`).

## Decisions Needed Before Build
1) Planning execution path: add `PLANNING` mode in `ReviewMode` vs a separate planning chat engine.
2) Planning folder bootstrap: create on first planning command vs at app init (store migration).
3) File upload representation: new `DocFormat` vs `TEXT` doc with embedded metadata.

## Step-by-Step Build (Prototype)

### Step 1: Slash Command UI + Parser
- Add Notion-style `/` command picker to `ReviewMode`.
- Update slash parser to support multi-word commands (e.g., `/start daily plan`).
- Add command list: `/start daily plan`, `/start weekly plan`, `/start quarterly plan`, `/set sprint plan`, `/plan`, `/task`, `/help`.

### Step 2: Planning Agent Service
- Create `services/planningAgent.ts` (parallel to `reviewAgent.ts`).
- Define planning tools and system instructions.
- Build planning context from:
  - Current objectives
  - Recent plans (Docs)
  - Active tasks and projects
  - Uploaded context docs

### Step 3: Planning Flow State Machine
- Implement readiness gate (confirm status, blockers, capacity, backlog alignment).
- Implement SOPs for daily/weekly/quarterly/sprint.
- Draft plan -> user confirm -> finalize.

### Step 4: Planning Storage in Docs
- Ensure Planning folder tree exists in Docs workspace.
- Save plan artifacts as `ContextDoc` in `Planning/*` folders.
- Embed structured JSON payload in the doc body.
- Update "Index" docs (Latest, Recent Daily/Weekly/Quarterly).

### Step 5: File Uploads in Chat
- Add upload control in ReviewMode input.
- Save uploaded files to `Planning/Uploads` as docs.
- Mark planning docs and uploads as `isRagIndexed: true` by default.

### Step 6: Token-Aware Subagent Stubs
- For prototype, simulate subagents as ordered LLM calls (no parallel infra).
- Add token budget guard: if context is large, summarize and reduce inputs.

### Step 7: QA & UX Validation
- Verify all slash commands resolve correctly.
- Confirm plans can be created, saved, and retrieved from Docs.
- Validate task proposals and approvals still work in ReviewMode.
- Ensure daily/weekly review flows are not broken.

## Prototype Definition of Done
- `/start daily plan`, `/start weekly plan`, `/start quarterly plan`, `/set sprint plan` all run through SOPs and save plans to Docs.
- Plans are visible in `Docs > Planning/*` and can be reopened.
- Uploaded files appear in `Docs > Planning/Uploads` and are indexed for context.
- ReviewMode daily/weekly flows remain functional.

## Deferred Until Backend
- Multi-user concurrency and permissions.
- Server-side indexing / RAG.
- File storage beyond local browser limits.
- Cross-device sync and search.

