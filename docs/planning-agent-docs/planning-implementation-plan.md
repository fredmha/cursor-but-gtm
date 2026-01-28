# Planning Agent Implementation Plan

## Dependencies
- Command router for slash commands with Notion-style picker in chat input.
- Planning storage inside Docs workspace (DocFolder + ContextDoc).
- Task management primitives (create/update tasks, owners, due dates, statuses).
- User and team directory (names, roles, time zones).
- File upload ingestion (documents, spreadsheets, notes).
- Optional: web search tool (research support).

## Current Interface Constraints (from ReviewMode)
- `ReviewMode` only supports `DAILY | WEEKLY` system instructions, tools, and chat history.
- Slash command parser only recognizes single-token commands (e.g., `/plan`), so `/start daily plan` will not route correctly until updated.
- `WeeklyReviewWizard.tsx` is deleted; planning must attach to `ReviewMode` or a new Planning view.

## Constraints
- Must be usable for 1-50 person SaaS teams (small-team workflows, limited process overhead).
- Plans must align to goals and north star objective.
- Avoid over-automation: require explicit confirmation before writing tasks.
- Data privacy: store only user-provided content and keep access scoped to org.
- Time zone awareness and date boundaries.
- Subagent selection must be token-budget aware (use only what is needed per session).

## Subagents (Proposed)
1) Context Retriever
   - Loads recent plans, active tasks, and org profile.
2) Blocker & Dependency Checker
   - Detects stalled tasks and cross-team dependencies.
3) Plan Synthesizer
   - Turns goals and constraints into structured plans.
4) Researcher (Optional)
   - Uses web search to gather benchmarks or best practices for the domain.
5) Ops Coordinator
   - Ensures ownership, dates, and calendar alignment.
6) Token Governor
   - Decides which subagents to spawn based on token budget, horizon, and context size.

## Tools (Proposed)
- `load_plans(horizon, range)`
- `save_plan(horizon, data)`
- `list_tasks(filters)`
- `update_task(id, fields)`
- `create_task(data)`
- `list_team()`
- `upload_context(file)`
- `web_search(query)`

## Best Path: Phased Delivery

### Phase 0: Data Model + Storage
- Implement Planning folder tree in Docs workspace.
- Define plan schema and embed JSON payloads in plan docs.
- Add Index docs for "Latest" and "Recent" lists.

### Phase 1: Command Routing + SOP Engine
- Update slash parser to support multi-word commands (e.g., `/start daily plan`).
- Map planning commands to SOPs with Notion-style slash picker UI.
- Implement readiness gate logic.
- Add plan summaries and confirmations.
- Decide planning execution path:
  - Option A: Add a `PLANNING` mode to `ReviewMode`.
  - Option B: Create a separate Planning chat engine.

### Phase 2: Task and Team Integrations
- Wire task creation and updates.
- Add team roster and capacity inputs.
- Add file upload to chat for context docs (auto-saved to Planning/Uploads).

### Phase 3: Subagent Orchestration
- Parallelize context retrieval, blocker scan, and plan synthesis.
- Add consistency checks (goal-to-task coverage).
- Enforce token-aware subagent selection.

### Phase 4: Research Augmentation
- Add web search for market/competitor benchmarks.
- Maintain a citation log in planning artifacts.

### Phase 5: Quality and Analytics
- Track plan adherence and carryover rates.
- Provide weekly and quarterly retro summaries.

## Risks and Mitigations
- Risk: Over-collecting context slows planning.
  - Mitigation: enforce a strict readiness gate and short prompts.
- Risk: Goals drift from tasks.
  - Mitigation: require goal-to-task linkage before plan finalization.
- Risk: Tool dependency failures.
  - Mitigation: fallback to manual plan capture.
- Risk: Planning uses wrong system instruction.
  - Mitigation: introduce a planning-specific mode or a separate planning agent.

## Open Questions
- What is the minimum viable set of tools for Phase 1?
- How should multi-owner tasks be represented?
- What file types should be supported for uploads (PDF, CSV, DOCX)?
- Which planning execution path do we want (new mode vs separate engine)?

